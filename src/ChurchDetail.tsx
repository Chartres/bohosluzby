// Church detail — the full weekly schedule set like a printed ordo (grouped by
// day, times aligned), one-off services in their own rubric section, parish +
// contacts, and an honest data-freshness line. docs/DESIGN-BRIEF.md governs.
import { type RefObject, type TouchEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  decodeShard,
  type Church,
  type ChurchServices,
  type ExtraService,
  type Service,
} from './domain/data'
import { nextOccurrences, pragueToday, recentOccurrence } from './domain/occurrences'
import { noteUncertain, parseNote } from './domain/notes'
import { parseConfessionFromNote } from './domain/confession'
import { fmtDateCz, isStale, withReferral } from './domain/format'
import { logError, track } from './analytics'
import { isNative } from './lib/native'
import { loadData } from './lib/dataStore'
import { addToCalendar, scheduleMassReminder, REMINDER_LEAD_MIN } from './lib/native-actions'
import { aggregateFor, divergentChips, loadAggregates, rankChurchTags } from './lib/feedbackStore'
import { recordExpectedAttendance } from './lib/feedbackLedger'
import { massKey, occurrenceOf, oneOffKey, riteOf, slotKey, type Aggregate } from './domain/feedback'
import { WitnessPills } from './WitnessPills'
import { NavSheet } from './NavSheet'
import { confirmedByPilgrims, t, langLabel, reminderScheduledMsg, staleWarning, type Key } from './i18n'

// A church viewed within this window after a Mass started seeds the after-Mass
// ledger — the "recent viewers" cohort (docs/PILGRIM-WITNESS-PLAN.md).
const RECENT_VIEW_MIN = 150

// Liturgical week: Sunday first, like a printed ordo.
const DAY_ORDER = [7, 1, 2, 3, 4, 5, 6] as const
const DAY_NAME_KEY: Record<number, Key> = {
  1: 'wd_mon',
  2: 'wd_tue',
  3: 'wd_wed',
  4: 'wd_thu',
  5: 'wd_fri',
  6: 'wd_sat',
  7: 'day_sunday_full',
}

export function Chip({ label }: { label: string }) {
  // inline-block + nowrap: a chip is atomic — "Greek Catholic" split across
  // two lines read as two broken half-boxes on device
  return (
    <span className="inline-block rounded-sm border border-hairline px-1.5 py-0.5 text-xs whitespace-nowrap text-ink-faded">
      {label}
    </span>
  )
}

/** Service note, set like the rubric it is: conditions the parser can't verify
 * ("1x za 14 dní", "dle ohlášení") print in rubric red so nobody treats an
 * unverified time as a promise. Parsed/descriptive notes stay quiet. Its own
 * tight-leading line under the service type — a long note ("…v červenci a srpnu
 * se bohoslužby nekonají…") then flows cleanly instead of wrapping the type row
 * tall with a ragged gap beside the time. */
export function NoteText({ note }: { note: string }) {
  if (!note) return null
  return (
    <p className={`text-sm leading-snug ${noteUncertain(note) ? 'font-semibold text-rubric' : 'text-ink-faded'}`}>
      {note}
    </p>
  )
}

/** The primary testimony for a church: what pilgrims most mention across every
 * Mass here, as read-only witness pills. Ranked by distinctiveness and capped at
 * three (docs/PILGRIM-WITNESS-PLAN.md — no stars, no score); the aggregate count
 * follows. This is the church-level-first block; individual Masses only speak up
 * when they diverge (MassDiverges). */
function ChurchWitness({ chips, witnesses }: { chips: { id: string; count: number }[]; witnesses: number }) {
  if (chips.length === 0) return null
  return (
    <section aria-label={t('fb_church_often')} className="mt-6 border-t border-hairline pt-4">
      <p className="text-sm text-ink-faded">{t('fb_church_often')}:</p>
      <div className="mt-2">
        <WitnessPills chips={chips} />
      </div>
      <p className="mt-1.5 text-xs text-ink-faded">{confirmedByPilgrims(witnesses)}</p>
    </section>
  )
}

/** A specific Mass's own note — only when it diverges from the church block
 * (a tag strong here that the church-level pills don't already carry). Keeps the
 * schedule quiet: no per-Mass repetition of the church's testimony. */
function MassDiverges({ chips }: { chips: { id: string; count: number }[] }) {
  if (chips.length === 0) return null
  return (
    <p className="mt-1 text-sm text-ink-faded">
      {t('fb_mass_diverges')}: <WitnessPills chips={chips} />
    </p>
  )
}

const linkCls = 'underline decoration-hairline underline-offset-2 hover:text-ink'
// meta links when they sit OVER the photo hero: paper text on the scrim,
// decoration brightening on hover instead of darkening to ink (which would
// vanish against the dark image).
const heroLinkCls = 'underline decoration-paper/40 underline-offset-2 hover:decoration-paper'

function contactHref(type: string, value: string): string | null {
  if (type === 'www') return value
  if (type === 'email') return `mailto:${value}`
  if (type === 'phone') return `tel:+420${value.replace(/\s/g, '')}`
  return null
}

const isoToday = (): string => {
  const { y, m, d } = pragueToday(new Date())
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Per-service actions: add to calendar (native share sheet / web download) and,
 * on native only, schedule a local reminder before the next occurrence. */
function ServiceActions({ church, service }: { church: Church; service: Service | ExtraService }) {
  const [msg, setMsg] = useState<string | null>(null)
  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2500)
  }

  const onCalendar = () => {
    track('key_action', { action: 'ics', church: church.id })
    addToCalendar(church, service).catch((err) => logError(err, { where: 'calendar', id: church.id }))
  }

  const onRemind = async () => {
    const r = await scheduleMassReminder(church, service)
    track('key_action', { action: 'reminder', church: church.id, result: r })
    flash(
      r === 'scheduled'
        ? reminderScheduledMsg(REMINDER_LEAD_MIN)
        : r === 'denied'
          ? t('remind_denied')
          : r === 'failed'
            ? t('remind_failed')
            : t('remind_none'),
    )
  }

  return (
    <div className="flex shrink-0 items-baseline gap-3">
      {/* the flash is VISIBLE (and stays one persistent aria-live region) — a
          scheduled reminder the user can't see happened reads as a broken
          button; it briefly replaces the verbs so the row never overflows */}
      <span
        className={msg ? 'text-xs font-semibold text-rubric' : 'sr-only'}
        role="status"
        aria-live="polite"
      >
        {msg ?? ''}
      </span>
      {!msg && (
        <>
          {isNative && (
            <button type="button" className={`text-xs text-ink-faded ${linkCls}`} onClick={onRemind}>
              {t('remind')}
            </button>
          )}
          <button type="button" className={`text-xs text-ink-faded ${linkCls}`} onClick={onCalendar}>
            {t('add_calendar')}
          </button>
        </>
      )}
    </div>
  )
}

/** Share the church's /kostel/<id>/ URL. Native: the Capacitor Share plugin
 * (WKWebView has no navigator.share — the old code silently did nothing).
 * Web: Web Share API, then clipboard with a VISIBLE confirmation. */
function ShareLink({ church, linkClassName = linkCls }: { church: Church; linkClassName?: string }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = `${location.origin}/kostel/${church.id}/`
    track('key_action', { action: 'share', church: church.id })
    try {
      if (isNative) {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: church.name, url })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: church.name, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  }
  return (
    <>
      <button type="button" onClick={share} className={linkClassName}>
        {t('share')}
      </button>
      <span
        className={copied ? 'text-xs font-semibold text-rubric' : 'sr-only'}
        role="status"
        aria-live="polite"
      >
        {copied ? t('link_copied') : ''}
      </span>
    </>
  )
}

/** Remote church photo from Wikimedia Commons — url is a ≤480px thumbnail, never
 * bundled ($0 app-size). credit/license are the required attribution. */
interface ChurchPhoto {
  url: string
  credit: string
  license: string
}

/** Church name + city + the meta action row (mapa · navigace · sdílet · web
 * farnosti · bezbariérový). Rendered plain on paper when there's no photo, or
 * OVER the photo hero (hero=true) — paper text on the scrim, light link
 * decoration — like a Booking/Airbnb property header. One block, two skins, so
 * the title and its links never drift between the two layouts. */
function DetailHeading({
  church,
  headingRef,
  onNavigate,
  hero,
}: {
  church: Church
  headingRef: RefObject<HTMLHeadingElement | null>
  onNavigate: () => void
  hero: boolean
}) {
  const text = hero ? 'text-paper' : 'text-ink-faded'
  const link = hero ? heroLinkCls : linkCls
  return (
    <>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className={`font-display text-2xl leading-tight font-bold outline-none ${hero ? 'text-paper' : 'mt-4'}`}
      >
        {church.name}
      </h2>
      {church.city && <p className={`mt-1 text-sm ${text}`}>{church.city}</p>}
      {/* one meta row of actions under the title — map · navigate · share · web
          farnosti. Bundled (not a separate block) so the schedule stays primary. */}
      <p className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${text}`}>
        <a
          className={link}
          href={`https://mapy.cz/zakladni?q=${church.lat}%2C${church.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          {t('map_link')}
        </a>
        {/* geo: is an Android scheme — iOS ignored it; the chooser works everywhere */}
        <button type="button" className={link} onClick={onNavigate}>
          {t('detail_navigate')}
        </button>
        <ShareLink church={church} linkClassName={link} />
        {church.www && (
          <a
            href={withReferral(church.www)}
            target="_blank"
            rel="noreferrer"
            className={hero ? link : `rubric ${link}`}
          >
            {t('detail_parish_web')}
          </a>
        )}
        {church.barrierFree && <span className={text}>{t('wheelchair_label')}</span>}
      </p>
    </>
  )
}

export function ChurchDetail({ church, onBack }: { church: Church; onBack: () => void }) {
  const [svc, setSvc] = useState<ChurchServices | null>(null)
  const [failed, setFailed] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [photo, setPhoto] = useState<ChurchPhoto | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const prev = document.title
    document.title = `${church.name} — ${t('detail_title_suffix')} | Bohoslužby`
    return () => {
      document.title = prev
    }
  }, [church])

  // Land the screen reader in the detail, not back at the page top.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [church])

  useEffect(() => {
    let cancelled = false
    setSvc(null)
    setFailed(false)
    fetch(`/data/services/${church.cell}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`shard ${r.status}`))))
      .then((shard) => {
        if (cancelled) return
        const s = decodeShard(shard).get(church.id)
        if (s) setSvc(s)
        else setFailed(true)
      })
      .catch((err) => {
        logError(err, { where: 'load-detail', id: church.id })
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [church])

  // Church photo (Wikimedia Commons): loaded via the OTA/offline data gateway,
  // keyed by church id. Absent map, offline, or no entry → render nothing.
  useEffect(() => {
    let cancelled = false
    setPhoto(null)
    void loadData<Record<string, ChurchPhoto>>('photos.json')
      .then((map) => {
        if (!cancelled) setPhoto(map[church.id] ?? null)
      })
      .catch(() => {
        /* no photos.json / offline — the page just shows no photo */
      })
    return () => {
      cancelled = true
    }
  }, [church])

  // Witness aggregates for this church: prefetch from Supabase (localStorage
  // mirror offline) on mount, then read the synchronous cache. aggTick bumps
  // when a load resolves so the ordo witness lines paint.
  const [aggTick, setAggTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    void loadAggregates([church.id]).then(() => {
      if (!cancelled) setAggTick((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [church.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agg = useMemo(() => aggregateFor(church.id), [church.id, aggTick])
  // Church-level-first: the primary block ranks the church-wide tier by
  // distinctiveness (top 3) against every loaded church; per-Mass rows only
  // surface tags that diverge from these.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const churchTags = useMemo(() => rankChurchTags(church.id), [church.id, aggTick])
  const churchTopIds = useMemo(() => churchTags.map((c) => c.id), [churchTags])

  // "recent viewers": opening a church near a Mass time records an expected
  // attendance, so the after-Mass card can ask on the next app open.
  useEffect(() => {
    if (!svc) return
    const now = new Date()
    for (const s of svc.regular) {
      const start = recentOccurrence({ days: s.days, time: s.time }, now, RECENT_VIEW_MIN)
      if (!start) continue
      recordExpectedAttendance({
        churchId: church.id,
        massKey: massKey(church.id, s, start),
        startISO: start.toISOString(),
        churchName: church.name,
        type: s.type || t('service_fallback'),
        ...occurrenceOf(s, start),
      })
    }
  }, [svc, church])

  const extras = svc ? svc.extra.filter((x) => x.date >= isoToday()) : []

  // Confession coverage: the ~6 churches with a typed "svátost smíření" row PLUS
  // times mined from Mass notes for the ~37 that only mention confession in free
  // text. De-duplicated by day+time; the Mass note still shows on its own row
  // above — this section only additionally surfaces the parsed confession time.
  const confessions = useMemo(() => {
    if (!svc) return []
    const rows: { days: string; time: string; note: string }[] = svc.confession.map((c) => ({
      days: c.days,
      time: c.time,
      note: c.note,
    }))
    const seen = new Set(rows.map((r) => `${r.days}|${r.time}`))
    for (const s of svc.regular) {
      const parsed = parseConfessionFromNote(s.note, s.time, s.days)
      if (!parsed) continue
      const key = `${parsed.days}|${parsed.time}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(parsed)
    }
    return rows
  }, [svc])

  // iOS-style edge swipe: a drag that STARTS near the left screen edge and moves
  // decisively rightward goes back. Guarded so plain vertical scrolling and taps
  // are untouched — only an edge-anchored, horizontal-dominant drag triggers, and
  // we never preventDefault, so the browser's own scroll/tap handling is intact.
  const swipe = useRef<{ x: number; y: number; live: boolean } | null>(null)
  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    const p = e.touches[0]
    swipe.current = { x: p.clientX, y: p.clientY, live: p.clientX <= 24 }
  }
  const onTouchMove = (e: TouchEvent<HTMLElement>) => {
    const s = swipe.current
    if (!s || !s.live) return
    const p = e.touches[0]
    const dx = p.clientX - s.x
    const dy = p.clientY - s.y
    if (dx > 60 && Math.abs(dy) < dx * 0.7) {
      s.live = false
      onBack()
    }
  }
  const onTouchEnd = () => {
    swipe.current = null
  }

  return (
    <article
      className="mt-5"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* the back link stays reachable while scrolling a long ordo — sticky just
          below the app header, paper-backed so scrolled text never shows through.
          The top offset mirrors the header's height (safe-area pad + wordmark). */}
      <p
        className="sticky z-20 -mx-5 bg-paper px-5 py-1 sm:-mx-8 sm:px-8"
        style={{ top: 'calc(max(0.75rem, env(safe-area-inset-top)) + 2.25rem)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className={`rubric inline-flex min-h-11 items-center ${linkCls}`}
        >
          {t('back_to_list')}
        </button>
      </p>
      {/* Photo present → a Booking/Airbnb-style HERO: the church name + meta row
          sit OVER the image on a bottom scrim. object-top keeps the tower (church
          photos are tall) instead of a landscape band cropping it off. No photo →
          the plain paper header. The hero bleeds full-width (-mx) like the back bar. */}
      {photo ? (
        <figure className="relative mt-4 -mx-5 overflow-hidden sm:-mx-8">
          <img
            src={photo.url}
            alt={church.name}
            loading="lazy"
            decoding="async"
            className="block h-[46vh] max-h-[26rem] min-h-[15rem] w-full object-cover object-top"
          />
          {/* bottom scrim for legibility of the overlaid title — a warm-ink
              gradient, not a box-shadow (docs/DESIGN-BRIEF.md: no shadows) */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />
          <figcaption className="absolute inset-x-0 bottom-0 px-5 pt-10 pb-4 sm:px-8">
            <DetailHeading church={church} headingRef={headingRef} onNavigate={() => setNavOpen(true)} hero />
            <p className="mt-2 text-xs text-paper/80">
              {t('photo_credit_prefix')}{' '}
              {[photo.credit, photo.license, 'Wikimedia Commons'].filter(Boolean).join(' · ')}
            </p>
          </figcaption>
        </figure>
      ) : (
        <DetailHeading
          church={church}
          headingRef={headingRef}
          onNavigate={() => setNavOpen(true)}
          hero={false}
        />
      )}

      <ChurchWitness chips={churchTags} witnesses={agg.church.witnesses} />

      {failed && (
        <p className="mt-8 text-ink-faded" role="alert">
          {t('detail_load_error')}
        </p>
      )}
      {!failed && !svc && (
        <p className="mt-8 text-ink-faded" role="status">
          {t('detail_loading')}
        </p>
      )}

      {svc && (
        <>
          {/* a decade-stale entry buried in a footnote sent a real user to a
              mass that wasn't held — extreme staleness warns BEFORE the
              schedule, where the go/no-go decision is made */}
          {svc.updated && isStale(svc.updated) && (
            <p className="mt-6 border-l-2 border-rubric pl-3 text-sm font-semibold text-rubric">
              {staleWarning(fmtDateCz(svc.updated))}
              {church.www && (
                <>
                  {' '}
                  <a
                    href={withReferral(church.www)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-rubric underline-offset-2"
                  >
                    {t('detail_parish_web')} →
                  </a>
                </>
              )}
            </p>
          )}
          <section aria-label={t('schedule_title')} className="mt-7">
            <h3 className="rubric border-b border-hairline pb-1">{t('schedule_title')}</h3>
            {svc.regular.length === 0 && (
              <p className="mt-3 text-sm text-ink-faded">{t('no_regular_services')}</p>
            )}
            {DAY_ORDER.map((day) => {
              const rows = svc.regular
                .filter((s) => s.days.includes(String(day)))
                .sort((a, b) => a.time.localeCompare(b.time))
              if (rows.length === 0) return null
              return (
                <div key={day} className="mt-4">
                  <h4 className="rubric text-[0.7rem]">{t(DAY_NAME_KEY[day])}</h4>
                  <ul>
                    {rows.map((s, i) => (
                      <li key={i}>
                        <ServiceRow
                          s={s}
                          church={church}
                          slot={agg.slots.get(slotKey(church.id, day, s.time, riteOf(s), s.lang))}
                          churchTopIds={churchTopIds}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </section>

          {/* Svátost smíření — an auxiliary section, not a Mass: the registry
              gives these as time WINDOWS (e.g. "08:30 - 11:30"), shown verbatim.
              No calendar/reminder — a window is not a single event. Grouped by
              day and styled like the ordo above (rubric day headers, hairlines). */}
          {confessions.length > 0 && (
            <section aria-label={t('confession_title')} className="mt-7">
              <h3 className="rubric border-b border-hairline pb-1">{t('confession_title')}</h3>
              {DAY_ORDER.map((day) => {
                const rows = confessions
                  .filter((s) => s.days.includes(String(day)))
                  .sort((a, b) => a.time.localeCompare(b.time))
                if (rows.length === 0) return null
                return (
                  <div key={day} className="mt-4">
                    <h4 className="rubric text-[0.7rem]">{t(DAY_NAME_KEY[day])}</h4>
                    <ul>
                      {rows.map((s, i) => (
                        <li key={i} className="flex items-baseline gap-4 border-b border-hairline py-2">
                          <p className="font-display shrink-0 text-base font-semibold tabular-nums">
                            {s.time}
                          </p>
                          <div className="min-w-0 flex-1">
                            <NoteText note={s.note} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </section>
          )}

          {extras.length > 0 && (
            <section aria-label={t('extras_title')} className="mt-7">
              <h3 className="rubric border-b border-hairline pb-1">{t('extras_title')}</h3>
              <ul>
                {extras.map((x, i) => (
                  <li key={i} className="flex items-baseline gap-4 border-b border-hairline py-2">
                    <p className="font-display w-24 shrink-0 text-base font-semibold whitespace-nowrap">
                      {fmtDateCz(x.date)}
                    </p>
                    <p className="font-display w-14 shrink-0 text-base font-semibold tabular-nums">
                      {x.time}
                    </p>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{x.type || t('service_fallback')}</p>
                      <NoteText note={x.note} />
                      <MassDiverges
                        chips={divergentChips(
                          agg.slots.get(oneOffKey(church.id, x.date, x.time, riteOf(x), x.lang)),
                          churchTopIds,
                        )}
                      />
                    </div>
                    <ServiceActions church={church} service={x} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(svc.parish || svc.parishAddress || svc.contacts.length > 0) && (
            <section aria-label={t('parish_title')} className="mt-7">
              <h3 className="rubric border-b border-hairline pb-1">{t('parish_title')}</h3>
              {svc.parish && <p className="mt-3 text-sm">{svc.parish}</p>}
              {svc.parishAddress && <p className="mt-0.5 text-sm text-ink-faded">{svc.parishAddress}</p>}
              {svc.contacts.length > 0 && (
                <p className="mt-1.5 space-x-3 text-sm">
                  {svc.contacts.map(([type, value], i) => {
                    const href = contactHref(type, value)
                    const label = type === 'www' ? value.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : value
                    return href ? (
                      <a key={i} className={linkCls} href={type === 'www' ? withReferral(href) : href} target={type === 'www' ? '_blank' : undefined} rel="noreferrer">
                        {label}
                      </a>
                    ) : (
                      <span key={i}>{label}</span>
                    )
                  })}
                </p>
              )}
            </section>
          )}

          <p className="mt-8 text-xs text-ink-faded">
            {t('data_source_note')}
            {svc.updated && (
              <span className={isStale(svc.updated) ? 'text-rubric' : undefined}>
                {`, ${t('last_verified')} ${fmtDateCz(svc.updated)}`}
              </span>
            )}
          </p>
        </>
      )}

      {navOpen && (
        <NavSheet
          target={{ name: church.name, lat: church.lat, lng: church.lng }}
          onClose={() => setNavOpen(false)}
        />
      )}
    </article>
  )
}

function ServiceRow({
  s,
  church,
  slot,
  churchTopIds,
}: {
  s: Service
  church: Church
  slot?: Aggregate
  churchTopIds: string[]
}) {
  // P6 Věra: a service whose note provably excludes EVERY upcoming occurrence
  // in the next five weeks ("kromě července a srpna" read in July) mutes —
  // the absence has a visible reason. Checked against the service's own
  // occurrence dates, not today: "1. sobota v měsíci" always has a first
  // Saturday within five weeks, so recurrence-pattern notes never mute.
  // Uncertain notes never mute either — they already print loud instead.
  const pausedNow = (() => {
    if (!s.note) return false
    const rule = parseNote(s.note)
    if (rule.uncertain) return false
    const upcoming = nextOccurrences({ days: s.days, time: s.time }, new Date(), 35)
    return (
      upcoming.length > 0 &&
      upcoming.every((start) => {
        const w = pragueToday(start)
        return !rule.runsOn(w.y, w.m, w.d)
      })
    )
  })()
  return (
    <div
      data-paused={pausedNow || undefined}
      className={`flex items-baseline gap-4 border-b border-hairline py-2 ${pausedNow ? 'opacity-70' : ''}`}
    >
      <p className="font-display w-14 shrink-0 text-xl font-semibold tabular-nums">{s.time}</p>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {s.type || t('service_fallback')}
          {pausedNow && <span className="font-semibold text-rubric"> · {t('now_paused')}</span>}
        </p>
        <NoteText note={s.note} />
        <p className="mt-0.5 space-x-2 text-sm empty:hidden">
          {s.lang !== 'česky' && <Chip label={langLabel(s.lang)} />}
          {s.greek && <Chip label={t('greek_chip')} />}
        </p>
        <MassDiverges chips={divergentChips(slot, churchTopIds)} />
      </div>
      <ServiceActions church={church} service={s} />
    </div>
  )
}

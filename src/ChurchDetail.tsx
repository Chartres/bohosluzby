// Church detail — the full weekly schedule set like a printed ordo (grouped by
// day, times aligned), one-off services in their own rubric section, parish +
// contacts, and an honest data-freshness line. docs/DESIGN-BRIEF.md governs.
import { useEffect, useRef, useState } from 'react'
import {
  decodeShard,
  type Church,
  type ChurchServices,
  type ExtraService,
  type Service,
} from './domain/data'
import { nextOccurrences, pragueToday } from './domain/occurrences'
import { noteUncertain, parseNote } from './domain/notes'
import { fmtDateCz } from './domain/format'
import { logError, track } from './analytics'
import { isNative } from './lib/native'
import { addToCalendar, scheduleMassReminder, REMINDER_LEAD_MIN } from './lib/native-actions'
import { NavSheet } from './NavSheet'
import { t, langLabel, reminderScheduledMsg, type Key } from './i18n'

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
  return (
    <span className="rounded-sm border border-hairline px-1.5 py-0.5 text-xs text-ink-faded">
      {label}
    </span>
  )
}

/** Service note, set like the rubric it is: conditions the parser can't verify
 * ("1x za 14 dní", "dle ohlášení") print in rubric red so nobody treats an
 * unverified time as a promise. Parsed/descriptive notes stay quiet. */
export function NoteText({ note }: { note: string }) {
  if (!note) return null
  return noteUncertain(note) ? (
    <span className="font-semibold text-rubric"> — {note}</span>
  ) : (
    <span className="text-ink-faded"> — {note}</span>
  )
}

const linkCls = 'underline decoration-hairline underline-offset-2 hover:text-ink'

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

/** Older than 18 months → "naposledy ověřeno" reads as a verify-before-you-go
 * warning rather than a quiet footnote. */
const isStale = (iso: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return false
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 18)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) < cutoff
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
function ShareLink({ church }: { church: Church }) {
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
      <button type="button" onClick={share} className={linkCls}>
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

export function ChurchDetail({ church, onBack }: { church: Church; onBack: () => void }) {
  const [svc, setSvc] = useState<ChurchServices | null>(null)
  const [failed, setFailed] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
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

  const extras = svc ? svc.extra.filter((x) => x.date >= isoToday()) : []

  return (
    <article className="mt-5">
      <p>
        <button
          type="button"
          onClick={onBack}
          className={`rubric inline-flex min-h-11 items-center -my-3 ${linkCls}`}
        >
          {t('back_to_list')}
        </button>
      </p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display mt-4 text-2xl leading-tight font-bold outline-none"
      >
        {church.name}
      </h2>
      <p className="mt-1 text-sm text-ink-faded">
        {church.city && `${church.city} · `}
        <a
          className={linkCls}
          href={`https://mapy.cz/zakladni?q=${church.lat}%2C${church.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          {t('map_link')}
        </a>
        {' · '}
        {/* geo: is an Android scheme — iOS ignored it; the chooser works everywhere */}
        <button type="button" className={linkCls} onClick={() => setNavOpen(true)}>
          {t('detail_navigate')}
        </button>
        {' · '}
        <ShareLink church={church} />
        {church.barrierFree && ` · ${t('wheelchair_label')}`}
      </p>

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
                        <ServiceRow s={s} church={church} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </section>

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
                    <p className="min-w-0 flex-1 text-sm">
                      {x.type || t('service_fallback')}
                      <NoteText note={x.note} />
                    </p>
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
                      <a key={i} className={linkCls} href={href} target={type === 'www' ? '_blank' : undefined} rel="noreferrer">
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

function ServiceRow({ s, church }: { s: Service; church: Church }) {
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
          <NoteText note={s.note} />
          {pausedNow && <span className="font-semibold text-rubric"> · {t('now_paused')}</span>}
        </p>
        <p className="mt-0.5 space-x-2 text-sm empty:hidden">
          {s.lang !== 'česky' && <Chip label={langLabel(s.lang)} />}
          {s.greek && <Chip label={t('greek_chip')} />}
        </p>
      </div>
      <ServiceActions church={church} service={s} />
    </div>
  )
}

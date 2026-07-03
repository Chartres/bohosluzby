// Church detail — the full weekly schedule set like a printed ordo (grouped by
// day, times aligned), one-off services in their own rubric section, parish +
// contacts, and an honest data-freshness line. docs/DESIGN-BRIEF.md governs.
import { useEffect, useState } from 'react'
import {
  decodeShard,
  type Church,
  type ChurchServices,
  type ExtraService,
  type Service,
} from './domain/data'
import { pragueToday } from './domain/occurrences'
import { fmtDateCz } from './domain/format'
import { buildICS } from './domain/ics'
import { logError, track } from './analytics'

// Liturgical week: Sunday first, like a printed ordo.
const DAY_ORDER = [7, 1, 2, 3, 4, 5, 6] as const
const DAY_NAME: Record<number, string> = {
  1: 'pondělí',
  2: 'úterý',
  3: 'středa',
  4: 'čtvrtek',
  5: 'pátek',
  6: 'sobota',
  7: 'neděle',
}

export function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-sm border border-hairline px-1.5 py-0.5 text-xs text-ink-faded">
      {label}
    </span>
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

/** "Přidat do kalendáře": download a VEVENT (weekly RRULE for regular services). */
function downloadICS(church: Church, service: Service | ExtraService) {
  const ics = buildICS(church, service, new Date())
  if (!ics) return
  track('key_action', { action: 'ics', church: church.id })
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `bohosluzby-${church.id}-${service.time.replace(':', '')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

/** Share the church's /kostel/<id>/ URL — Web Share API, clipboard fallback. */
function ShareLink({ church }: { church: Church }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = `${location.origin}/kostel/${church.id}/`
    track('key_action', { action: 'share', church: church.id })
    try {
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
    <button type="button" onClick={share} className={linkCls} aria-live="polite">
      {copied ? 'odkaz zkopírován' : 'sdílet'}
    </button>
  )
}

export function ChurchDetail({ church, onBack }: { church: Church; onBack: () => void }) {
  const [svc, setSvc] = useState<ChurchServices | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const prev = document.title
    document.title = `${church.name} — pořad bohoslužeb | Bohoslužby`
    return () => {
      document.title = prev
    }
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
        <button type="button" onClick={onBack} className={`rubric ${linkCls}`}>
          ‹ zpět na seznam
        </button>
      </p>
      <h2 className="font-display mt-4 text-2xl leading-tight font-bold">{church.name}</h2>
      <p className="mt-1 text-sm text-ink-faded">
        {church.city && `${church.city} · `}
        <a
          className={linkCls}
          href={`https://mapy.cz/zakladni?q=${church.lat}%2C${church.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          mapa
        </a>
        {' · '}
        <a className={linkCls} href={`geo:${church.lat},${church.lng}`}>
          navigace
        </a>
        {' · '}
        <ShareLink church={church} />
        {church.barrierFree && ' · bezbariérový přístup'}
      </p>

      {failed && (
        <p className="mt-8 text-ink-faded" role="alert">
          Rozpis bohoslužeb se nepodařilo načíst. Zkuste to prosím znovu.
        </p>
      )}
      {!failed && !svc && (
        <p className="mt-8 text-ink-faded" role="status">
          Načítám rozpis…
        </p>
      )}

      {svc && (
        <>
          <section aria-label="Pořad bohoslužeb" className="mt-7">
            <h3 className="rubric border-b border-hairline pb-1">Pořad bohoslužeb</h3>
            {svc.regular.length === 0 && (
              <p className="mt-3 text-sm text-ink-faded">
                Rejstřík pro tento kostel neuvádí žádné pravidelné bohoslužby.
              </p>
            )}
            {DAY_ORDER.map((day) => {
              const rows = svc.regular
                .filter((s) => s.days.includes(String(day)))
                .sort((a, b) => a.time.localeCompare(b.time))
              if (rows.length === 0) return null
              return (
                <div key={day} className="mt-4">
                  <h4 className="rubric text-[0.7rem]">{DAY_NAME[day]}</h4>
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
            <section aria-label="Mimořádné bohoslužby" className="mt-7">
              <h3 className="rubric border-b border-hairline pb-1">Mimořádné bohoslužby</h3>
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
                      {x.type || 'bohoslužba'}
                      {x.note && <span className="text-ink-faded"> — {x.note}</span>}
                    </p>
                    <button
                      type="button"
                      className={`shrink-0 text-xs text-ink-faded ${linkCls}`}
                      onClick={() => downloadICS(church, x)}
                    >
                      do kalendáře
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(svc.parish || svc.parishAddress || svc.contacts.length > 0) && (
            <section aria-label="Farnost" className="mt-7">
              <h3 className="rubric border-b border-hairline pb-1">Farnost</h3>
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
            údaje z rejstříku ČBK
            {svc.updated && `, naposledy ověřeno ${fmtDateCz(svc.updated)}`}
          </p>
        </>
      )}
    </article>
  )
}

function ServiceRow({ s, church }: { s: Service; church: Church }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-hairline py-2">
      <p className="font-display w-14 shrink-0 text-xl font-semibold tabular-nums">{s.time}</p>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {s.type || 'bohoslužba'}
          {s.note && <span className="text-ink-faded"> — {s.note}</span>}
        </p>
        <p className="mt-0.5 space-x-2 text-sm empty:hidden">
          {s.lang !== 'česky' && <Chip label={s.lang} />}
          {s.greek && <Chip label="řeckokatolická" />}
        </p>
      </div>
      <button
        type="button"
        className={`shrink-0 text-xs text-ink-faded ${linkCls}`}
        onClick={() => downloadICS(church, s)}
      >
        do kalendáře
      </button>
    </div>
  )
}

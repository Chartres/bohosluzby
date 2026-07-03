// The one stage-1 journey: geolocate (or pick a city) → "Nejbližší bohoslužby",
// ranked by which service you can still make (docs/DESIGN-BRIEF.md sets the look:
// printed ordo — hairline rules, rubric labels, seasonal accent).
import { useEffect, useMemo, useRef, useState } from 'react'
import { decodeIndex, decodeShard, type Church, type ChurchServices, type IndexRow } from './domain/data'
import { haversineKm } from './domain/distance'
import { rankUpcoming, type Upcoming } from './domain/ranking'
import { currentLiturgicalDay, type LiturgicalDay } from './domain/liturgical'
import { fmtDistance, fmtTime, fmtUntil, dayLabel } from './domain/format'
import { track, conversion, logError } from './analytics'

const NEARBY_KM = 30
const NEARBY_CAP = 120

const SEASON_LABEL: Record<LiturgicalDay['season'], string> = {
  ordinary: 'liturgické mezidobí',
  advent: 'doba adventní',
  christmas: 'doba vánoční',
  lent: 'doba postní',
  easter: 'doba velikonoční',
}
const SEASON_VAR: Record<LiturgicalDay['color'], string> = {
  green: 'var(--color-season-green)',
  violet: 'var(--color-season-violet)',
  gold: 'var(--color-season-gold)',
  red: 'var(--color-season-red)',
}

type Origin = { lat: number; lng: number; source: 'geo' | 'city'; label?: string }

export default function App() {
  const [index, setIndex] = useState<Church[] | null>(null)
  const [dataError, setDataError] = useState(false)
  const [geoDenied, setGeoDenied] = useState(false)
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [rows, setRows] = useState<Upcoming[] | null>(null)
  const season = useMemo(() => currentLiturgicalDay(), [])
  const convertedRef = useRef(false)

  useEffect(() => {
    document.documentElement.style.setProperty('--season', SEASON_VAR[season.color])
    track('page_view', { season: season.season })
  }, [season])

  useEffect(() => {
    fetch('/data/churches.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`churches.json ${r.status}`))))
      .then((rows: IndexRow[]) => setIndex(decodeIndex(rows)))
      .catch((err) => {
        logError(err, { where: 'load-index' })
        setDataError(true)
      })
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoDenied(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'geo' }),
      () => setGeoDenied(true),
      { timeout: 12_000, maximumAge: 300_000 },
    )
  }, [])

  useEffect(() => {
    if (!index || !origin) return
    let cancelled = false
    setRows(null)
    const nearby = index
      .map((c) => ({ c, d: haversineKm(origin.lat, origin.lng, c.lat, c.lng) }))
      .filter(({ d }) => d <= NEARBY_KM)
      .sort((a, b) => a.d - b.d)
      .slice(0, NEARBY_CAP)
      .map(({ c }) => c)
    const cells = [...new Set(nearby.map((c) => c.cell))]
    Promise.all(
      cells.map((cell) =>
        fetch(`/data/services/${cell}.json`)
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
      ),
    )
      .then((shards) => {
        if (cancelled) return
        const byId = new Map<string, ChurchServices>()
        for (const shard of shards) for (const [id, s] of decodeShard(shard)) byId.set(id, s)
        const ranked = rankUpcoming(new Date(), origin, nearby, byId)
        setRows(ranked)
        if (origin.source === 'geo' && ranked.length > 0 && !convertedRef.current) {
          convertedRef.current = true
          conversion({ results: ranked.length })
        }
      })
      .catch((err) => {
        logError(err, { where: 'load-shards' })
        if (!cancelled) setDataError(true)
      })
    return () => {
      cancelled = true
    }
  }, [index, origin])

  const loading = !dataError && !index ? true : Boolean(origin) && rows === null

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 sm:px-8">
      <header className="border-b-2 pt-6 pb-3" style={{ borderColor: 'var(--season)' }}>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">Bohoslužby</h1>
          <p className="text-sm font-semibold" style={{ color: 'var(--season)' }}>
            {SEASON_LABEL[season.season]}
          </p>
        </div>
        <p className="rubric mt-1">mše svatá poblíž, právě teď</p>
      </header>

      <main className="flex-1 pb-10">
        {dataError && (
          <p className="mt-10 text-ink-faded" role="alert">
            Data se nepodařilo načíst. Zkuste to prosím znovu.
          </p>
        )}

        {!dataError && loading && (
          <div className="mt-14 text-center" role="status">
            <p className="font-display text-xl">Hledám bohoslužby poblíž…</p>
            <p className="mt-2 text-sm text-ink-faded">Načítám data a zjišťuji polohu.</p>
          </div>
        )}

        {!dataError && !loading && !origin && geoDenied && index && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Bez přístupu k poloze</h2>
            <p className="mt-2 max-w-prose text-ink-faded">
              Poloha slouží jen k nalezení nejbližších kostelů — nikam se neodesílá. Povolte ji
              v prohlížeči, nebo zvolte obec ručně.
            </p>
            <CityPicker index={index} onPick={(o) => setOrigin(o)} />
          </section>
        )}

        {!dataError && !loading && origin && rows && rows.length === 0 && index && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">V okolí nic nenacházím</h2>
            <p className="mt-2 max-w-prose text-ink-faded">
              Do {NEARBY_KM} km od {origin.label ? `obce ${origin.label}` : 'vaší polohy'} není
              v rejstříku žádná bohoslužba. Zkuste jinou obec.
            </p>
            <CityPicker index={index} onPick={(o) => setOrigin(o)} />
          </section>
        )}

        {!dataError && !loading && origin && rows && rows.length > 0 && (
          <section aria-label="Nejbližší bohoslužby">
            <div className="mt-5 flex items-baseline justify-between gap-3">
              <h2 className="rubric">Nejbližší bohoslužby</h2>
              <p className="text-sm text-ink-faded">
                {origin.label ? origin.label : 'podle vaší polohy'}
                {' · '}
                <button
                  type="button"
                  className="underline decoration-hairline underline-offset-2 hover:text-ink"
                  onClick={() => {
                    setOrigin(null)
                    setRows(null)
                    setGeoDenied(true) // reopens the picker
                  }}
                >
                  změnit
                </button>
              </p>
            </div>
            <ServiceList rows={rows} />
          </section>
        )}
      </main>

      <footer className="border-t border-hairline py-4 text-sm text-ink-faded">
        Data: rejstřík{' '}
        <a
          className="underline decoration-hairline underline-offset-2 hover:text-ink"
          href="https://bohosluzby.cirkev.cz"
        >
          bohosluzby.cirkev.cz
        </a>
        {' · '}zdarma, bez reklam
      </footer>
    </div>
  )
}

function ServiceList({ rows }: { rows: Upcoming[] }) {
  const now = new Date()
  let lastDay = ''
  return (
    <ol className="mt-2">
      {rows.map((r) => {
        const day = dayLabel(now, r.start)
        const showDay = day !== lastDay
        lastDay = day
        return (
          <li key={`${r.church.id}-${r.start.getTime()}`}>
            {showDay && <p className="rubric mt-6 mb-1">{day}</p>}
            <div className="flex items-baseline gap-4 border-t border-hairline py-3">
              <p className="font-display w-14 shrink-0 text-2xl font-semibold tabular-nums">
                {fmtTime(r.start)}
              </p>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[1.05rem] leading-snug font-semibold">
                  {r.church.name}
                </p>
                <p className="mt-0.5 text-sm text-ink-faded">
                  {r.church.city && `${r.church.city} · `}
                  {fmtDistance(r.distanceKm)} · {r.service.type}
                  {r.service.note && ` — ${r.service.note}`}
                </p>
                <p className="mt-0.5 space-x-2 text-sm empty:hidden">
                  {r.service.lang && r.service.lang !== 'česky' && <Chip label={r.service.lang} />}
                  {r.service.greek && <Chip label="řeckokatolická" />}
                  {r.church.barrierFree && <Chip label="bezbariérový přístup" />}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold whitespace-nowrap">
                {fmtUntil(now, r.start)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-sm border border-hairline px-1.5 py-0.5 text-xs text-ink-faded">
      {label}
    </span>
  )
}

function CityPicker({ index, onPick }: { index: Church[]; onPick: (o: Origin) => void }) {
  const [value, setValue] = useState('')
  const cities = useMemo(
    () => [...new Set(index.map((c) => c.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs')),
    [index],
  )

  const pick = (name: string) => {
    const churches = index.filter((c) => c.city === name)
    if (churches.length === 0) return false
    const lat = churches.reduce((s, c) => s + c.lat, 0) / churches.length
    const lng = churches.reduce((s, c) => s + c.lng, 0) / churches.length
    track('key_action', { action: 'city_selected', city: name })
    onPick({ lat, lng, source: 'city', label: name })
    return true
  }

  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault()
        pick(value)
      }}
    >
      <label className="rubric block" htmlFor="city">
        Zvolte obec
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="city"
          list="city-list"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (cities.includes(e.target.value)) pick(e.target.value)
          }}
          placeholder="např. Brno"
          autoComplete="off"
          className="min-h-11 w-full max-w-xs rounded-sm border border-hairline bg-white/60 px-3 text-base"
        />
        <button
          type="submit"
          className="min-h-11 rounded-sm border border-ink px-4 text-base font-semibold"
        >
          Hledat
        </button>
      </div>
      <datalist id="city-list">
        {cities.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </form>
  )
}

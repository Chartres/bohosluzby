// The one stage-1 journey: geolocate (or pick a city) → "Nejbližší bohoslužby",
// ranked by which service you can still make (docs/DESIGN-BRIEF.md sets the look:
// printed ordo — hairline rules, rubric labels, seasonal accent).
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  decodeIndex,
  decodeShard,
  type Church,
  type ChurchServices,
  type ExtraService,
  type IndexRow,
  type Service,
} from './domain/data'
import { haversineKm } from './domain/distance'
import { ordoForDay, rankUpcoming, type Upcoming } from './domain/ranking'
import { pragueToday } from './domain/occurrences'
import { currentLiturgicalDay, liturgicalDay, type LiturgicalDay } from './domain/liturgical'
import { fmtDistance, fmtTime, fmtUntil, dayLabel } from './domain/format'
import { aggregateCities, findCity, searchPlaces, type City } from './domain/cities'
import { ChurchDetail, Chip, NoteText } from './ChurchDetail'
import { FeedbackCard } from './FeedbackCard'
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

type Origin = { lat: number; lng: number; source: 'geo' | 'city' | 'last'; label?: string }

// Last known position — the offline/denied fallback (a pilgrim in a tunnel
// still gets her list). Saved on every successful location fix or city pick.
const LAST_ORIGIN_KEY = 'bohosluzby:lastOrigin'

function loadLastOrigin(): Origin | null {
  try {
    const raw = localStorage.getItem(LAST_ORIGIN_KEY)
    if (!raw) return null
    const { lat, lng, label } = JSON.parse(raw)
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    return { lat, lng, label, source: 'last' }
  } catch {
    return null
  }
}

const onlineStore = {
  subscribe(cb: () => void) {
    window.addEventListener('online', cb)
    window.addEventListener('offline', cb)
    return () => {
      window.removeEventListener('online', cb)
      window.removeEventListener('offline', cb)
    }
  },
  snapshot: () => navigator.onLine,
}

// ---- Filters (persisted; rubric-styled toggles, not a Material chip bar) ----

export interface Filters {
  lang: string | null
  greek: boolean
  barrierFree: boolean
  massOnly: boolean
}

const FILTERS_KEY = 'bohosluzby:filters'
const NO_FILTERS: Filters = { lang: null, greek: false, barrierFree: false, massOnly: false }

function loadFilters(): Filters {
  try {
    return { ...NO_FILTERS, ...JSON.parse(localStorage.getItem(FILTERS_KEY) ?? '{}') }
  } catch {
    return NO_FILTERS
  }
}

// ---- Day picker: 'now' = soonest you can make; 0–6 = the day's full ordo ----

export type DayChoice = 'now' | number

const WEEKDAY_SHORT = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'] // Date.getUTCDay order

/** The liturgical day for a day-picker choice ('now' = today). */
export function litForChoice(now: Date, day: DayChoice): LiturgicalDay {
  const today = pragueToday(now)
  const t = new Date(Date.UTC(today.y, today.m - 1, today.d) + (day === 'now' ? 0 : day) * 86_400_000)
  return liturgicalDay(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Picker options for the next week: hned · dnes · zítra · short weekday names
 * (Sunday spelled out — "kdy je v neděli mše?" is the planning question).
 * Feast days carry their name + color for the quiet picker highlight. */
export function dayOptions(now: Date): { key: DayChoice; label: string; lit: LiturgicalDay }[] {
  const today = pragueToday(now)
  const base = Date.UTC(today.y, today.m - 1, today.d)
  const out: { key: DayChoice; label: string; lit: LiturgicalDay }[] = [
    { key: 'now', label: 'hned', lit: litForChoice(now, 'now') },
    { key: 0, label: 'dnes', lit: litForChoice(now, 0) },
    { key: 1, label: 'zítra', lit: litForChoice(now, 1) },
  ]
  for (let off = 2; off <= 6; off++) {
    const dow = new Date(base + off * 86_400_000).getUTCDay()
    out.push({ key: off, label: dow === 0 ? 'neděle' : WEEKDAY_SHORT[dow], lit: litForChoice(now, off) })
  }
  return out
}

// ponytail: registry types are free text; "mass" = anything named mše/liturgie.
const isMass = (type: string) => /mše|liturgi/i.test(type)

const serviceMatches =
  (f: Filters) =>
  (s: Service | ExtraService): boolean =>
    (!f.lang || s.lang === f.lang) && (!f.greek || s.greek) && (!f.massOnly || isMass(s.type))

/** Filter each church's services before ranking, so a church falls back to its
 * next matching service instead of disappearing with its earliest one. */
export function applyFilters(
  byId: ReadonlyMap<string, ChurchServices>,
  f: Filters,
): ReadonlyMap<string, ChurchServices> {
  if (f === NO_FILTERS || (!f.lang && !f.greek && !f.massOnly)) return byId
  const pred = serviceMatches(f)
  const out = new Map<string, ChurchServices>()
  for (const [id, svc] of byId) {
    out.set(id, { ...svc, regular: svc.regular.filter(pred), extra: svc.extra.filter(pred) })
  }
  return out
}

// Minimal history routing (GH Pages serves 404.html = the app for deep links).
type Route = { view: 'home' } | { view: 'church'; id: string } | { view: 'city'; slug: string }

export function parseRoute(path: string): Route {
  const kostel = /^\/kostel\/([^/]+)\/?$/.exec(path)
  if (kostel) return { view: 'church', id: decodeURIComponent(kostel[1]) }
  const mesto = /^\/mesto\/([^/]+)\/?$/.exec(path)
  if (mesto) return { view: 'city', slug: decodeURIComponent(mesto[1]) }
  return { view: 'home' }
}

function useRoute(): { route: Route; navigate: (to: string) => void } {
  const [path, setPath] = useState(() => location.pathname)
  useEffect(() => {
    const onPop = () => setPath(location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (to: string) => {
    history.pushState(null, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }
  return { route: parseRoute(path), navigate }
}

export default function App() {
  const [index, setIndex] = useState<Church[] | null>(null)
  const [dataError, setDataError] = useState(false)
  const [geoDenied, setGeoDenied] = useState(false)
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [data, setData] = useState<{ nearby: Church[]; byId: Map<string, ChurchServices> } | null>(null)
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [day, setDay] = useState<DayChoice>('now')
  const [picking, setPicking] = useState(false) // "změnit": search panel over the list, origin kept
  const season = useMemo(() => currentLiturgicalDay(), [])
  const convertedRef = useRef(false)
  const { route, navigate } = useRoute()

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

  // geolocate → last known position → the picker (also re-run by "moje poloha")
  const locate = () => {
    const fallback = () => {
      const last = loadLastOrigin()
      if (last) setOrigin(last)
      else setGeoDenied(true)
    }
    if (!navigator.geolocation) {
      fallback()
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'geo' }),
      fallback,
      { timeout: 12_000, maximumAge: 300_000 },
    )
  }

  useEffect(() => {
    // a /mesto/<slug>/ landing sets its own origin — don't prompt for location
    if (parseRoute(location.pathname).view === 'city') return
    locate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  // remember the position for the offline / denied fallback
  useEffect(() => {
    if (!origin || origin.source === 'last') return
    try {
      localStorage.setItem(
        LAST_ORIGIN_KEY,
        JSON.stringify({ lat: origin.lat, lng: origin.lng, label: origin.label }),
      )
    } catch {
      // private mode
    }
  }, [origin])

  const online = useSyncExternalStore(onlineStore.subscribe, onlineStore.snapshot)

  // /mesto/<slug>/ — the city's centroid becomes the origin (SEO landing pages)
  const citySlug = route.view === 'city' ? route.slug : null
  useEffect(() => {
    if (!citySlug || !index) return
    const city = findCity(index, citySlug)
    if (city) {
      setOrigin({ lat: city.lat, lng: city.lng, source: 'city', label: city.name })
      document.title = `Bohoslužby ${city.name} — mše svatá dnes | Bohoslužby`
    } else {
      setGeoDenied(true) // stale link → offer the picker
    }
  }, [citySlug, index])

  useEffect(() => {
    if (!index || !origin) return
    let cancelled = false
    setData(null)
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
        setData({ nearby, byId })
      })
      .catch((err) => {
        logError(err, { where: 'load-shards' })
        if (!cancelled) setDataError(true)
      })
    return () => {
      cancelled = true
    }
  }, [index, origin])

  const rows: Upcoming[] | null = useMemo(() => {
    if (!data || !origin) return null
    const churches = filters.barrierFree ? data.nearby.filter((c) => c.barrierFree) : data.nearby
    const byId = applyFilters(data.byId, filters)
    return day === 'now'
      ? rankUpcoming(new Date(), origin, churches, byId)
      : ordoForDay(new Date(), day, origin, churches, byId)
  }, [data, origin, filters, day])

  /** Languages on offer nearby (unfiltered) — the options for the lang filter. */
  const langs = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    for (const c of data.nearby) {
      const svc = data.byId.get(c.id)
      if (svc) for (const s of [...svc.regular, ...svc.extra]) set.add(s.lang)
    }
    return [...set].sort((a, b) => (a === 'česky' ? -1 : b === 'česky' ? 1 : a.localeCompare(b, 'cs')))
  }, [data])

  const anyFilter = Boolean(filters.lang) || filters.greek || filters.barrierFree || filters.massOnly

  const updateFilters = (next: Filters) => {
    setFilters(next)
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(next))
    } catch {
      // private mode — filters just won't persist
    }
    track('key_action', { action: 'filter', ...next })
  }

  const loading = !dataError && (!index || (!origin && !geoDenied) || (Boolean(origin) && rows === null))

  // "moje poloha": drop the picked city and the saved last-position override,
  // then re-run geolocation — the way back after any manual city pick.
  const useMyLocation = () => {
    track('key_action', { action: 'my_location' })
    try {
      localStorage.removeItem(LAST_ORIGIN_KEY)
    } catch {
      // private mode
    }
    setPicking(false)
    setGeoDenied(false)
    if (route.view === 'city') navigate('/')
    setOrigin(null) // "Hledám…" while the fix comes in
    locate()
  }

  const pickCity = (city: City) => {
    track('key_action', { action: 'city_selected', city: city.name })
    if (route.view === 'city') navigate('/') // the URL shouldn't keep naming the old city
    setOrigin({ lat: city.lat, lng: city.lng, source: 'city', label: city.name })
    setGeoDenied(false)
    setPicking(false)
  }
  const pickChurch = (id: string) => {
    track('key_action', { action: 'church_selected', church: id })
    setPicking(false)
    navigate(`/kostel/${id}/`)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 sm:px-8">
      <header className="border-b-2 pt-6 pb-3" style={{ borderColor: 'var(--season)' }}>
        <h1 className="font-display text-3xl font-bold tracking-tight">Bohoslužby</h1>
        <p className="rubric mt-1">mše svatá poblíž, právě teď</p>
      </header>

      <main className="flex-1 pb-10">
        {dataError && (
          <p className="mt-10 text-ink-faded" role="alert">
            Data se nepodařilo načíst. Zkuste to prosím znovu.
          </p>
        )}

        {!dataError && route.view === 'church' && index && (
          <DetailRoute id={route.id} index={index} onBack={() => navigate('/')} />
        )}
        {!dataError && route.view === 'church' && !index && (
          <p className="mt-8 text-ink-faded" role="status">
            Načítám…
          </p>
        )}

        {route.view !== 'church' && (
          <>
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
              v prohlížeči, nebo vyhledejte obec či kostel.
            </p>
            <SearchPicker index={index} onPickCity={pickCity} onPickChurch={pickChurch} />
          </section>
        )}

        {!dataError && picking && index && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Jiná obec nebo kostel</h2>
            <SearchPicker
              index={index}
              onPickCity={pickCity}
              onPickChurch={pickChurch}
              onClose={() => setPicking(false)}
            />
          </section>
        )}

        {!dataError && !picking && !loading && origin && rows && rows.length === 0 && !anyFilter && index && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">V okolí nic nenacházím</h2>
            <p className="mt-2 max-w-prose text-ink-faded">
              Do {NEARBY_KM} km od {origin.label ? `obce ${origin.label}` : 'vaší polohy'} není
              v rejstříku žádná bohoslužba. Zkuste jinou obec.
            </p>
            <SearchPicker index={index} onPickCity={pickCity} onPickChurch={pickChurch} />
          </section>
        )}

        {!dataError && !picking && !loading && origin && rows && (rows.length > 0 || anyFilter || day !== 'now') && (
          <section aria-label="Nejbližší bohoslužby">
            <div className="mt-5 flex items-baseline justify-between gap-3">
              <h2 className="rubric">Nejbližší bohoslužby</h2>
              <p className="text-sm text-ink-faded">
                {origin.label ?? (origin.source === 'last' ? 'poslední známá poloha' : 'podle vaší polohy')}
                {' · '}
                <button
                  type="button"
                  className="underline decoration-hairline underline-offset-2 hover:text-ink"
                  onClick={() => setPicking(true)} // origin stays — zpět/Escape returns to the list
                >
                  změnit
                </button>
                {origin.source !== 'geo' && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className="underline decoration-hairline underline-offset-2 hover:text-ink"
                      onClick={useMyLocation}
                    >
                      moje poloha
                    </button>
                  </>
                )}
              </p>
            </div>
            <DayPicker
              day={day}
              onChange={(d) => {
                setDay(d)
                track('key_action', { action: 'day', day: d })
              }}
            />
            <FeastLine day={day} />
            <FilterBar filters={filters} langs={langs} onChange={updateFilters} />
            {rows.length > 0 ? (
              <ServiceList
                rows={rows}
                showUntil={day === 'now' || day === 0}
                onOpen={(id) => {
                  // the aha moment: a service was found worth looking at
                  if (!convertedRef.current) {
                    convertedRef.current = true
                    conversion({ church: id })
                  }
                  navigate(`/kostel/${id}/`)
                }}
              />
            ) : (
              <p className="mt-8 text-ink-faded">
                {anyFilter
                  ? 'Zvolenému dni a filtrům neodpovídá žádná bohoslužba v okolí.'
                  : 'V tento den není v okolí žádná bohoslužba.'}{' '}
                {anyFilter && (
                  <button
                    type="button"
                    className="underline decoration-hairline underline-offset-2 hover:text-ink"
                    onClick={() => updateFilters({ ...NO_FILTERS })}
                  >
                    Zrušit filtry
                  </button>
                )}
              </p>
            )}
          </section>
        )}
          </>
        )}
      </main>

      <footer className="border-t border-hairline py-4 text-sm text-ink-faded">
        {!online && (
          <p className="mb-1" role="status">
            offline — zobrazuji uložená data
          </p>
        )}
        <FeedbackCard />
        <p className="mt-1">
          <span className="font-semibold" style={{ color: 'var(--season)' }}>
            {SEASON_LABEL[season.season]}
          </span>
          {' · '}Data: rejstřík{' '}
          <a
            className="underline decoration-hairline underline-offset-2 hover:text-ink"
            href="https://bohosluzby.cirkev.cz"
          >
            bohosluzby.cirkev.cz
          </a>
          {' · '}zdarma, bez reklam{' · '}
          <a
            className="underline decoration-hairline underline-offset-2 hover:text-ink"
            href="https://github.com/sponsors/Chartres"
            target="_blank"
            rel="noreferrer"
          >
            Podpořit
          </a>
        </p>
      </footer>
    </div>
  )
}

// The day rubric of the ordo, as a picker: which page are you reading?
// Active day is set in rubric red — day labels are rubrics in a missal.
function DayPicker({ day, onChange }: { day: DayChoice; onChange: (d: DayChoice) => void }) {
  const options = useMemo(() => dayOptions(new Date()), [])
  return (
    <div role="group" aria-label="Den" className="mt-3 -ml-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      {options.map(({ key, label, lit }) => {
        const active = key === day
        // feast days get a quiet tint of their liturgical color (a missal marks them too)
        const feastStyle = !active && lit.feast ? { color: SEASON_VAR[lit.color] } : undefined
        return (
          <button
            key={String(key)}
            type="button"
            aria-pressed={active}
            title={lit.feast}
            aria-label={lit.feast ? `${label} — ${lit.feast}` : undefined}
            className={`-my-2 px-1 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] ${
              active
                ? 'text-rubric underline decoration-rubric decoration-2 underline-offset-4'
                : 'text-ink-faded hover:text-ink'
            }`}
            style={feastStyle}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** Conservative ISA wheelchair glyph (no emoji — design brief), inline with the
 * meta line so a barrier-free row is exactly as tall as any other. */
function WheelchairIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="bezbariérový přístup"
      className="inline-block h-3.5 w-3.5 fill-current align-[-2px]"
    >
      <title>bezbariérový přístup</title>
      <path d="M12 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm7 9v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95zm-6.17 5c-.41 1.16-1.52 2-2.83 2-1.66 0-3-1.34-3-3 0-1.31.84-2.41 2-2.83V12.1a5 5 0 1 0 5.9 5.9h-2.07z" />
    </svg>
  )
}

/** Map-pin and globe glyphs for the in-row verification links — inline on the
 * meta line like the wheelchair icon, so the links stop costing a third text
 * line. Conservative outline-free shapes, no emoji (design brief). */
function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="inline-block h-4 w-4 fill-current align-[-3px]">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="inline-block h-4 w-4 fill-current align-[-3px]">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" />
    </svg>
  )
}

/** Icon link sized for thumbs: the inline padding paints no extra row height
 * but grows the hit area to ~28×40 px, above the stretched row link. */
function IconLink({ href, label, title }: { href: string; label: 'mapa' | 'web'; title: string }) {
  return (
    <a
      className="relative z-10 -mx-0.5 px-1.5 py-3 text-ink-faded hover:text-ink"
      href={href}
      aria-label={label}
      title={title}
      target="_blank"
      rel="noreferrer"
    >
      {label === 'mapa' ? <MapPinIcon /> : <GlobeIcon />}
    </a>
  )
}

/** Quiet feast name for the selected day, in the feast's liturgical color. */
function FeastLine({ day }: { day: DayChoice }) {
  const lit = useMemo(() => litForChoice(new Date(), day), [day])
  if (!lit.feast) return null
  return (
    <p className="mt-2 text-sm font-semibold" style={{ color: SEASON_VAR[lit.color] }}>
      {lit.feast}
    </p>
  )
}

function ServiceList({
  rows,
  showUntil,
  onOpen,
}: {
  rows: Upcoming[]
  showUntil: boolean
  onOpen: (id: string) => void
}) {
  const now = new Date()
  let lastDay = ''
  return (
    <ol className="mt-2">
      {rows.map((r, i) => {
        const day = dayLabel(now, r.start)
        const showDay = day !== lastDay
        lastDay = day
        // index suffix: the ordo can hold two rows with the same (church, start) —
        // duplicate keys corrupted reconciliation and left phantom rows on day switch
        return (
          <li key={`${r.church.id}-${r.start.getTime()}-${i}`}>
            {showDay && <p className="rubric mt-6 mb-1">{day}</p>}
            {/* stretched link: the name anchor covers the row; mapa/web sit above it */}
            <div className="group relative flex items-baseline gap-4 border-t border-hairline py-3">
              <p className="font-display w-16 shrink-0 text-2xl font-semibold tabular-nums">
                {fmtTime(r.start)}
              </p>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[1.05rem] leading-snug font-semibold">
                  <a
                    href={`/kostel/${r.church.id}/`}
                    onClick={(e) => {
                      e.preventDefault()
                      onOpen(r.church.id)
                    }}
                    className="underline decoration-hairline underline-offset-3 group-hover:decoration-ink after:absolute after:inset-0"
                  >
                    {r.church.name}
                  </a>
                </p>
                <p className="mt-0.5 text-sm text-ink-faded">
                  {r.church.city && `${r.church.city} · `}
                  {fmtDistance(r.distanceKm)}
                  {r.service.type && ` · ${r.service.type}`}
                  <NoteText note={r.service.note} />
                  {r.church.barrierFree && (
                    <>
                      {' · '}
                      <WheelchairIcon />
                    </>
                  )}{' '}
                  <IconLink
                    href={`https://mapy.cz/zakladni?q=${r.church.lat}%2C${r.church.lng}`}
                    label="mapa"
                    title="mapa (mapy.cz)"
                  />
                  {r.church.www && <IconLink href={r.church.www} label="web" title={r.church.www} />}
                  {r.service.lang && r.service.lang !== 'česky' && (
                    <>
                      {' '}
                      <Chip label={r.service.lang} />
                    </>
                  )}
                  {r.service.greek && (
                    <>
                      {' '}
                      <Chip label="řeckokatolická" />
                    </>
                  )}
                </p>
              </div>
              {showUntil && (
                <p className="shrink-0 text-sm font-semibold whitespace-nowrap">
                  {fmtUntil(now, r.start)}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// Typographic filter line — set like a rubric annotation under the list header,
// not a Material chip bar. Hit areas stay ≥44px via padding + negative margin.
function FilterBar({
  filters,
  langs,
  onChange,
}: {
  filters: Filters
  langs: string[]
  onChange: (f: Filters) => void
}) {
  const toggleCls = (active: boolean) =>
    `-my-2 px-1 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] ${
      active ? 'underline decoration-2 underline-offset-4' : 'text-ink-faded hover:text-ink'
    }`
  const toggleStyle = (active: boolean) =>
    active ? { color: 'var(--season)', textDecorationColor: 'var(--season)' } : undefined
  return (
    <div
      role="group"
      aria-label="Filtry"
      className="mt-3 -ml-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline pb-2"
    >
      <button
        type="button"
        aria-pressed={filters.massOnly}
        className={toggleCls(filters.massOnly)}
        style={toggleStyle(filters.massOnly)}
        onClick={() => onChange({ ...filters, massOnly: !filters.massOnly })}
      >
        jen mše svaté
      </button>
      <button
        type="button"
        aria-pressed={filters.barrierFree}
        className={toggleCls(filters.barrierFree)}
        style={toggleStyle(filters.barrierFree)}
        onClick={() => onChange({ ...filters, barrierFree: !filters.barrierFree })}
      >
        bezbariérové
      </button>
      <button
        type="button"
        aria-pressed={filters.greek}
        className={toggleCls(filters.greek)}
        style={toggleStyle(filters.greek)}
        onClick={() => onChange({ ...filters, greek: !filters.greek })}
      >
        řeckokatolické
      </button>
      {langs.length > 1 && (
        <select
          aria-label="Jazyk bohoslužby"
          value={filters.lang ?? ''}
          onChange={(e) => onChange({ ...filters, lang: e.target.value || null })}
          className={`-my-2 max-w-40 cursor-pointer border-0 bg-transparent py-3.5 text-xs font-semibold uppercase tracking-[0.08em] ${
            filters.lang ? '' : 'text-ink-faded'
          }`}
          style={filters.lang ? { color: 'var(--season)' } : undefined}
        >
          <option value="">jazyk: všechny</option>
          {langs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function DetailRoute({ id, index, onBack }: { id: string; index: Church[]; onBack: () => void }) {
  const church = index.find((c) => c.id === id)
  if (!church) {
    return (
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Kostel nenalezen</h2>
        <p className="mt-2 text-ink-faded">
          Tento odkaz nevede na žádný kostel v rejstříku.{' '}
          <button type="button" className="underline decoration-hairline underline-offset-2" onClick={onBack}>
            Zpět na seznam
          </button>
        </p>
      </section>
    )
  }
  return <ChurchDetail church={church} onBack={onBack} />
}

/** Unified typeahead over every municipality and church, diacritics-insensitive
 * ("ceske" finds České Budějovice, "tyn" finds Matky Boží před Týnem), keyboard
 * navigable (↑/↓/Enter, Escape = zpět). Replaces the <datalist> picker, which
 * Chromium truncates at 512 suggestions — the 3 259-city list ended at "Dubí". */
function SearchPicker({
  index,
  onPickCity,
  onPickChurch,
  onClose,
}: {
  index: Church[]
  onPickCity: (city: City) => void
  onPickChurch: (id: string) => void
  onClose?: () => void
}) {
  const [value, setValue] = useState('')
  const [hi, setHi] = useState(0)
  const cities = useMemo(() => aggregateCities(index), [index])
  const results = useMemo(() => searchPlaces(cities, index, value), [cities, index, value])
  const clamp = Math.min(hi, Math.max(results.length - 1, 0))

  const pick = (r: (typeof results)[number]) => {
    if (r.kind === 'city') onPickCity(r.city)
    else onPickChurch(r.church.id)
  }

  return (
    <div className="mt-6 max-w-md">
      {onClose && (
        <p className="mb-3">
          <button
            type="button"
            onClick={onClose}
            className="rubric underline decoration-hairline underline-offset-2 hover:text-ink"
          >
            ‹ zpět na seznam
          </button>
        </p>
      )}
      <label className="rubric block" htmlFor="city">
        Kostel nebo obec
      </label>
      <input
        id="city"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="city-options"
        aria-activedescendant={results.length > 0 ? `city-option-${clamp}` : undefined}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setHi(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHi(Math.min(clamp + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHi(Math.max(clamp - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (results[clamp]) pick(results[clamp])
          } else if (e.key === 'Escape') {
            e.preventDefault()
            if (value) setValue('')
            else onClose?.()
          }
        }}
        placeholder="např. Brno nebo sv. Víta"
        autoComplete="off"
        autoFocus={Boolean(onClose)} // opened by an explicit "změnit" tap — jump right in
        className="mt-2 min-h-11 w-full rounded-sm border border-hairline bg-white/60 px-3 text-base"
      />
      <ul id="city-options" role="listbox" aria-label="Výsledky hledání" className="mt-1">
        {results.map((r, i) => (
          <li key={r.kind === 'city' ? `c-${r.city.slug}` : `k-${r.church.id}`} role="presentation">
            <button
              type="button"
              id={`city-option-${i}`}
              role="option"
              aria-selected={i === clamp}
              className={`flex w-full items-baseline justify-between gap-3 border-b border-hairline px-1 py-2.5 text-left text-sm ${
                i === clamp ? 'bg-white/70' : ''
              }`}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(r)}
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <span className="shrink-0 text-xs text-ink-faded">
                {r.kind === 'city'
                  ? `obec · ${r.city.count} ${r.city.count === 1 ? 'kostel' : r.city.count < 5 ? 'kostely' : 'kostelů'}`
                  : r.church.city}
              </span>
            </button>
          </li>
        ))}
        {value.trim().length >= 2 && results.length === 0 && (
          <li className="px-1 py-2.5 text-sm text-ink-faded">Nic nenalezeno.</li>
        )}
      </ul>
    </div>
  )
}

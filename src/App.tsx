// The one stage-1 journey: geolocate (or pick a city) → "Nejbližší bohoslužby",
// ranked by which service you can still make (docs/DESIGN-BRIEF.md sets the look:
// printed ordo — hairline rules, rubric labels, seasonal accent).
import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  decodeIndex,
  decodeShard,
  type Church,
  type ChurchServices,
  type IndexRow,
} from './domain/data'
import { MAX_KM_OPTIONS, NO_FILTERS, type Filters } from './domain/filters'
import { haversineKm } from './domain/distance'
import { selectUpcoming, type DayChoice, type Upcoming } from './domain/ranking'
import { pragueToday } from './domain/occurrences'
import { currentLiturgicalDay, liturgicalDay, verifySeason, type LiturgicalDay } from './domain/liturgical'
import { fmtDistance, fmtTime, fmtUntil, dayLabel } from './domain/format'
import { aggregateCities, findCity, searchPlaces, type City } from './domain/cities'
import { BANDS, bandFullyPast, bandLabel, halfHoursFrom, parseCas, resolveCasDay, type Band } from './domain/timeband'
import { ChurchDetail, Chip, NoteText } from './ChurchDetail'
import { NavSheet, type NavTarget } from './NavSheet'
import { FeedbackCard } from './FeedbackCard'
import { track, conversion, logError } from './analytics'
import { getCurrentPosition, getPermissionState, type GeoFailure } from './lib/geo'
import { loadData, refreshData, activeAsOf } from './lib/dataStore'
import {
  lang,
  locale,
  t,
  langLabel,
  churchCount,
  filtersLabel,
  aroundLabel,
  withinKmLabel,
  nothingNearbyBody,
  verifyBanner,
} from './i18n'

const NEARBY_KM = 30
const NEARBY_CAP = 120
const LIST_LIMIT = 20

/** "2026-07-03" → "3. 7. 2026" (cs) / "3 Jul 2026" (en). */
const fmtDataDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (lang() === 'cs') return `${Number(d)}. ${Number(m)}. ${y}`
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).toLocaleDateString(locale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Leaflet + tiles code-split behind the "mapa" toggle — the list path pays nothing.
const MapView = lazy(() => import('./MapView'))

const SEASON_LABEL_CS: Record<LiturgicalDay['season'], string> = {
  ordinary: 'liturgické mezidobí',
  advent: 'doba adventní',
  christmas: 'doba vánoční',
  lent: 'doba postní',
  easter: 'doba velikonoční',
}
const SEASON_LABEL_EN: Record<LiturgicalDay['season'], string> = {
  ordinary: 'ordinary time',
  advent: 'Advent',
  christmas: 'Christmas season',
  lent: 'Lent',
  easter: 'Easter season',
}
// Read per call (not a module-level constant) — a test flipping
// navigator.language must see the new language on the next render.
const seasonLabel = (s: LiturgicalDay['season']): string =>
  (lang() === 'cs' ? SEASON_LABEL_CS : SEASON_LABEL_EN)[s]
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
// Predicates live in domain/filters.ts, shared with the lazily-loaded map.

const FILTERS_KEY = 'bohosluzby:filters'
const CAS_KEY = 'bohosluzby:cas'

// Sticky filters/kdy expire after a while — you open this app wanting "right
// now", not last night's "večer" still narrowing the list. 12h comfortably
// spans a nap but not an overnight-to-next-visit gap.
const STICKY_TTL_MS = 12 * 60 * 60 * 1000

function loadSticky<T>(key: string, opts: { sameDay?: boolean } = {}): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: number; value?: T }
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > STICKY_TTL_MS) return null
    // time-of-day prefs (kolem 18:00) mean nothing tomorrow morning — the 12h
    // TTL alone let 23:30's pick survive to 08:00 and open an empty list
    if (opts.sameDay && parsed.savedAt < new Date().setHours(0, 0, 0, 0)) return null
    return parsed.value ?? null
  } catch {
    return null // private mode, or a pre-TTL value written by an older build
  }
}

function saveSticky<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }))
  } catch {
    // private mode
  }
}

function loadFilters(): Filters {
  return { ...NO_FILTERS, ...loadSticky<Filters>(FILTERS_KEY) }
}

// ---- Day picker: 'now' = soonest you can make; 0–6 = the day's full ordo ----

export type { DayChoice }

const WEEKDAY_SHORT_CS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'] // Date.getUTCDay order
const WEEKDAY_SHORT_EN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
/** Read per call — see seasonLabel above for why this isn't a plain constant. */
const weekdayShort = (dow: number): string => (lang() === 'cs' ? WEEKDAY_SHORT_CS : WEEKDAY_SHORT_EN)[dow]

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
    { key: 'now', label: t('day_now'), lit: litForChoice(now, 'now') },
    { key: 0, label: t('day_today'), lit: litForChoice(now, 0) },
    { key: 1, label: t('day_tomorrow'), lit: litForChoice(now, 1) },
  ]
  for (let off = 2; off <= 6; off++) {
    const dow = new Date(base + off * 86_400_000).getUTCDay()
    out.push({ key: off, label: dow === 0 ? t('day_sunday_full') : weekdayShort(dow), lit: litForChoice(now, off) })
  }
  // ON a Sunday the 0..6 window holds no future neděle — but Sunday evening IS
  // when next week gets planned. Offer next Sunday explicitly (audit finding).
  if (new Date(base).getUTCDay() === 0) {
    out.push({ key: 7, label: t('day_sunday_full'), lit: litForChoice(now, 7) })
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

function useRoute() {
  const [url, setUrl] = useState(() => location.pathname + location.search)
  useEffect(() => {
    const onPop = () => setUrl(location.pathname + location.search)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (to: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) {
      history.replaceState(null, '', to) // e.g. a day switch — not a history entry
    } else {
      history.pushState(null, '', to)
      window.scrollTo(0, 0)
    }
    setUrl(to)
  }
  const q = url.indexOf('?')
  const path = q === -1 ? url : url.slice(0, q)
  const search = q === -1 ? '' : url.slice(q)
  return { route: parseRoute(path), path, search, navigate }
}

// ---- ?den= — the selected day as a bookmarkable query param -----------------

const DAY_SLUGS = ['nedele', 'pondeli', 'utery', 'streda', 'ctvrtek', 'patek', 'sobota'] // Date.getUTCDay order

/** ?den= value for a picker choice ('now' = no param, 0/1 = dnes/zítra,
 * farther days by weekday name so a bookmark means "next neděle", any week). */
export function dayToParam(now: Date, day: DayChoice): string | null {
  if (day === 'now') return null
  if (day === 0) return 'dnes'
  if (day === 1) return 'zitra'
  const today = pragueToday(now)
  const dow = new Date(Date.UTC(today.y, today.m - 1, today.d) + day * 86_400_000).getUTCDay()
  return DAY_SLUGS[dow]
}

/** Decode ?den= back to a picker choice; unknown/absent → 'now'. */
export function dayFromParam(now: Date, param: string | null): DayChoice {
  if (param === 'dnes') return 0
  if (param === 'zitra') return 1
  const dow = DAY_SLUGS.indexOf(param ?? '')
  if (dow === -1) return 'now'
  const today = pragueToday(now)
  const base = Date.UTC(today.y, today.m - 1, today.d)
  for (let off = 0; off <= 6; off++) {
    if (new Date(base + off * 86_400_000).getUTCDay() === dow) return off
  }
  return 'now' // unreachable — every weekday occurs within 7 days
}

export default function App() {
  const [index, setIndex] = useState<Church[] | null>(null)
  const [dataError, setDataError] = useState(false)
  const [geoDenied, setGeoDenied] = useState(false)
  const [geoPrompting, setGeoPrompting] = useState(false) // browser permission dialog pending
  const [geoFail, setGeoFail] = useState<GeoFailure | null>(null) // why — picks the guidance
  const [locating, setLocating] = useState(false) // a fresh fix is being fetched
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [data, setData] = useState<{ nearby: Church[]; byId: Map<string, ChurchServices> } | null>(null)
  const [dataAsOf, setDataAsOf] = useState<string | null>(activeAsOf)
  const [dataRefreshing, setDataRefreshing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [picking, setPicking] = useState(false) // "změnit": search panel over the list, origin kept
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null) // "trasa" chooser sheet
  const season = useMemo(() => currentLiturgicalDay(), [])
  const convertedRef = useRef(false)
  const { route, path, search, navigate } = useRoute()

  // the selected day + time filter live in the URL (?den=nedele&cas=vecer) —
  // bookmarkable, back-safe, and they compose ("v neděli kolem 9:00")
  const params = new URLSearchParams(search)
  const den = params.get('den')
  const day = useMemo(() => dayFromParam(new Date(), den), [den])
  const cas = parseCas(params.get('cas'))
  const setParams = (entries: Record<string, string | null>) => {
    const p = new URLSearchParams(search)
    for (const [key, value] of Object.entries(entries)) {
      if (value) p.set(key, value)
      else p.delete(key)
    }
    const qs = p.toString().replace(/%3A/gi, ':') // keep ?cas=18:00 readable
    navigate(qs ? `${path}?${qs}` : path, { replace: true })
  }
  const setParam = (key: string, value: string | null) => setParams({ [key]: value })
  const setDay = (d: DayChoice) => setParam('den', dayToParam(new Date(), d))
  // seznam · mapa — the hero list's other face, bookmarkable as ?zobrazeni=mapa
  const view: 'seznam' | 'mapa' = params.get('zobrazeni') === 'mapa' ? 'mapa' : 'seznam'
  const setView = (v: 'seznam' | 'mapa') => {
    setParam('zobrazeni', v === 'mapa' ? 'mapa' : null)
    track('key_action', { action: 'view', view: v })
  }
  const setCas = (c: string | null) => {
    // "hned + ráno" in the evening can never match today — jump honestly to
    // zítra (day chip + URL follow) instead of a quietly reinterpreted list
    const resolved = resolveCasDay(day, c, new Date())
    setParams({ cas: c, ...(resolved !== day ? { den: dayToParam(new Date(), resolved) } : {}) })
    if (c) {
      saveSticky(CAS_KEY, c)
    } else {
      try {
        localStorage.removeItem(CAS_KEY)
      } catch {
        // private mode
      }
    }
    track('key_action', { action: 'filter', cas: c })
  }

  // sticky like the other filters (within STICKY_TTL_MS): a plain visit
  // re-applies the saved cas
  useEffect(() => {
    if (parseCas(new URLSearchParams(location.search).get('cas'))) return
    const saved = parseCas(loadSticky<string>(CAS_KEY, { sameDay: true }))
    if (saved) setParam('cas', saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--season', SEASON_VAR[season.color])
    track('page_view', { season: season.season })
  }, [season])

  useEffect(() => {
    loadData<IndexRow[]>('churches.json')
      .then((rows) => setIndex(decodeIndex(rows)))
      .catch((err) => {
        logError(err, { where: 'load-index' })
        setDataError(true)
      })
  }, [reloadKey]) // reloadKey bumps after a background refresh → re-read from cache

  // Silent registry refresh: check the server's version on launch and, if newer,
  // download the snapshot in the background (native only). The app stays usable on
  // the current data throughout; when it lands we bump reloadKey to swap it in.
  useEffect(() => {
    let cancelled = false
    refreshData(() => !cancelled && setDataRefreshing(true)).then((r) => {
      if (cancelled) return
      setDataRefreshing(false)
      setDataAsOf(r.asOf)
      if (r.updated) setReloadKey((k) => k + 1)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // geolocate → last known position → the picker (also re-run by "moje poloha").
  // Permission-aware: a known "denied" skips the wait entirely, and a pending
  // prompt tells the user to look for the browser dialog instead of a spinner.
  const locate = () => {
    // Never block on a fix we might not get (airplane mode!): the last known
    // position seeds the list IMMEDIATELY — visibly marked as such — while the
    // fresh location is fetched in the background and swapped in on arrival.
    const last = loadLastOrigin()
    if (last) setOrigin((cur) => cur ?? last)
    const fallback = (reason: GeoFailure) => {
      setGeoFail(reason)
      if (!last) setGeoDenied(true) // with a seeded origin the list already stands
    }
    setLocating(true)
    getPermissionState().then((perm) => {
      if (perm === 'denied') {
        setLocating(false)
        fallback('denied') // no callback is coming — don't pretend to wait for one
        return
      }
      setGeoPrompting(perm === 'prompt')
      // an unanswered permission dialog deserves a longer leash than a slow fix
      getCurrentPosition({ deadlineMs: perm === 'prompt' ? 30_000 : 10_000 }).then((r) => {
        setLocating(false)
        setGeoPrompting(false)
        if (r.coords) setOrigin({ lat: r.coords.lat, lng: r.coords.lng, source: 'geo' })
        else fallback(r.error ?? 'timeout')
      })
    })
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

  // /mesto/<slug>/ — the city's centroid becomes the origin (SEO landing pages).
  // Leaving the city route for home (browser back, "moje poloha", zpět from a
  // detail) re-runs geolocation: "/" means "my location".
  const citySlug = route.view === 'city' ? route.slug : null
  const originRef = useRef(origin)
  originRef.current = origin
  useEffect(() => {
    if (!index) return
    if (citySlug) {
      const city = findCity(index, citySlug)
      if (city) {
        setOrigin({ lat: city.lat, lng: city.lng, source: 'city', label: city.name })
        document.title = `Bohoslužby ${city.name} — ${t('city_title_suffix')} | Bohoslužby`
      } else {
        setGeoDenied(true) // stale link → offer the picker
      }
    } else if (route.view === 'home' && originRef.current?.source === 'city') {
      setOrigin(null)
      locate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- locate/originRef are stable per render
  }, [citySlug, route.view, index])

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
        loadData<Parameters<typeof decodeShard>[0]>(`services/${cell}.json`).catch(() => ({})),
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

  // The list cap with an escape hatch: 20 rows fill with 17:00–18:00 masses in a
  // city centre and the whole evening seems to end at 18:00 — "zobrazit další"
  // raises the cap instead of pretending that's all there is.
  const [listLimit, setListLimit] = useState(LIST_LIMIT)
  useEffect(() => {
    setListLimit(LIST_LIMIT) // a new context restarts the cap
  }, [origin, filters, cas, day])

  // one shared selector with the map — the seznam and the mapa never disagree
  const rows: Upcoming[] | null = useMemo(() => {
    if (!data || !origin) return null
    return selectUpcoming(new Date(), origin, data.nearby, data.byId, filters, cas, day, {
      limit: listLimit,
    })
  }, [data, origin, filters, day, cas, listLimit])

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

  const anyFilter =
    Boolean(filters.lang) ||
    filters.greek ||
    filters.barrierFree ||
    filters.massOnly ||
    Boolean(filters.maxKm) ||
    Boolean(cas)

  const updateFilters = (next: Filters) => {
    setFilters(next)
    saveSticky(FILTERS_KEY, next)
    track('key_action', { action: 'filter', ...next })
  }

  // "zrušit vše": one tap back to the clean page — day, kdy, okruh, co
  const resetAll = () => {
    updateFilters({ ...NO_FILTERS })
    setParams({ cas: null, den: null }) // one navigate — setCas+setDay would race on `search`
    try {
      localStorage.removeItem(CAS_KEY)
    } catch {
      // private mode
    }
    track('key_action', { action: 'filters_reset' })
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
    if (route.view === 'city') navigate(`/${search}`) // back to "/" = my location, day kept
    setOrigin(null) // "Hledám…" while the fix comes in
    locate()
  }

  const pickCity = (city: City) => {
    track('key_action', { action: 'city_selected', city: city.name })
    setGeoDenied(false)
    setPicking(false)
    navigate(`/mesto/${city.slug}/${search}`) // history push — back returns to my location
  }
  const pickChurch = (id: string) => {
    track('key_action', { action: 'church_selected', church: id })
    setPicking(false)
    navigate(`/kostel/${id}/${search}`)
  }
  // shared by the list rows and the map popovers — the aha moment fires once
  const openChurch = (id: string) => {
    if (!convertedRef.current) {
      convertedRef.current = true
      conversion({ church: id })
    }
    navigate(`/kostel/${id}/${search}`) // keep ?den/?cas — back restores the view
  }

  // map mode: the map IS the page — a viewport-locked column, slim chrome, no
  // footer; everything else keeps the scrolling missal-page layout
  const mapMode = view === 'mapa' && route.view !== 'church' && !picking && !dataError

  return (
    <div
      className={
        mapMode
          ? 'flex h-dvh w-full flex-col overflow-hidden'
          : 'mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 sm:px-8'
      }
    >
      {/* one header everywhere — the map-mode masthead won: small wordmark on
          the season-colored rule, sticky so the page identity survives scroll.
          Negative margins bleed the paper background across the column padding. */}
      <header
        className={
          mapMode
            ? 'mx-auto w-full max-w-2xl border-b-2 px-5 pb-2 sm:px-8'
            : 'sticky top-0 z-30 -mx-5 border-b-2 bg-paper px-5 pb-2 sm:-mx-8 sm:px-8'
        }
        style={{
          borderColor: 'var(--season)',
          // sticky top-0 pins at the VIEWPORT top — on iOS that's under the
          // status bar/Dynamic Island. Pad by the safe area so the wordmark
          // never collides with the clock (env() is 0 on desktop web).
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        }}
      >
        <h1 className="font-display text-xl font-bold tracking-tight">Bohoslužby</h1>
      </header>

      <main className={mapMode ? 'flex min-h-0 flex-1 flex-col' : 'flex-1 pb-10'}>
        {dataError && (
          <p className="mt-10 text-ink-faded" role="alert">
            {t('data_error')}
          </p>
        )}

        {!dataError && route.view === 'church' && index && (
          <DetailRoute id={route.id} index={index} onBack={() => navigate(`/${search}`)} />
        )}
        {!dataError && route.view === 'church' && !index && (
          <p className="mt-8 text-ink-faded" role="status">
            {t('loading_ellipsis')}
          </p>
        )}

        {route.view !== 'church' && (
          <>
        {!dataError && loading && (
          <div className="mt-14 text-center" role="status">
            <p className="font-display text-xl">{t('loading_title')}</p>
            <p className="mt-2 text-sm text-ink-faded">
              {geoPrompting ? t('loading_prompting') : t('loading_default')}
            </p>
            {/* the manual path is always on offer — never make the user wait out a permission */}
            <button
              type="button"
              className="mt-4 px-2 py-3 text-sm underline decoration-hairline underline-offset-2 hover:text-ink"
              onClick={() => setGeoDenied(true)}
            >
              {t('pick_manually')}
            </button>
          </div>
        )}

        {!dataError && !loading && !origin && geoDenied && index && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">{t('no_geo_title')}</h2>
            <p className="mt-2 max-w-prose text-ink-faded">{t('no_geo_body')}</p>
            <p className="mt-2 max-w-prose text-ink-faded">
              {/* each failure gets ITS OWN way out — "unblock in the browser" is
                  wrong advice when the phone's location services are off */}
              {geoFail === 'unavailable'
                ? t('geo_fail_unavailable')
                : geoFail === 'deadline'
                  ? t('geo_fail_deadline')
                  : t('geo_fail_denied')}
              <button
                type="button"
                className="-my-2 inline-block px-1 py-2 underline decoration-hairline underline-offset-2 hover:text-ink"
                onClick={() => {
                  setGeoDenied(false)
                  locate() // re-runs the permission check — no reload needed
                }}
              >
                {t('retry')}
              </button>
              {t('geo_fail_tail')}
            </p>
            <SearchPicker index={index} onPickCity={pickCity} onPickChurch={pickChurch} />
          </section>
        )}

        {!dataError && picking && index && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">{t('picking_title')}</h2>
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
            <h2 className="font-display text-xl font-semibold">{t('nothing_nearby_title')}</h2>
            <p className="mt-2 max-w-prose text-ink-faded">
              {nothingNearbyBody(NEARBY_KM, origin.label ?? null)}
            </p>
            <SearchPicker index={index} onPickCity={pickCity} onPickChurch={pickChurch} />
          </section>
        )}

        {!dataError && !picking && !loading && origin && rows && (rows.length > 0 || anyFilter || day !== 'now') && (
          <section
            aria-label={t('nearest_services')}
            className={mapMode ? 'flex min-h-0 flex-1 flex-col' : undefined}
          >
            <div className={mapMode ? 'mx-auto w-full max-w-2xl px-5 sm:px-8' : undefined}>
              {/* one meta line: where (origin + změnit) left, representation right —
                  the dropped "Nejbližší bohoslužby" rubric duplicated the masthead */}
              <div className={`flex items-baseline justify-between gap-3 ${mapMode ? 'mt-2' : 'mt-5'}`}>
                <p className="min-w-0 truncate text-sm text-ink-faded">
                  {origin.source === 'last' ? (
                    // stale position drives the list — say so loudly, not in grey
                    <span className="font-semibold text-rubric">
                      {origin.label ? `${origin.label} — ${t('last_known_suffix')}` : t('last_known_solo')}
                    </span>
                  ) : (
                    (origin.label ?? t('from_location'))
                  )}
                  {locating && origin.source === 'last' && t('locating_suffix')}
                  {' · '}
                  <button
                    type="button"
                    // -my/py: pad the hit area to ~44px without moving the text line
                    className="-mx-1 -my-3 inline-block px-1 py-3 underline decoration-hairline underline-offset-2 hover:text-ink"
                    onClick={() => setPicking(true)} // origin stays — zpět/Escape returns to the list
                  >
                    {t('change')}
                  </button>
                  {origin.source !== 'geo' && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        className="-mx-1 -my-3 inline-block px-1 py-3 underline decoration-hairline underline-offset-2 hover:text-ink"
                        onClick={useMyLocation}
                      >
                        {t('my_location')}
                      </button>
                    </>
                  )}
                </p>
                <ViewToggle view={view} onChange={setView} />
              </div>
              <OrdoControls
                day={day}
                onDay={(d) => {
                  setDay(d)
                  track('key_action', { action: 'day', day: d })
                }}
                cas={cas}
                onCas={setCas}
                filters={filters}
                onChange={updateFilters}
                langs={langs}
                onReset={resetAll}
              />
              {/* not on a live fix (offline / last-known / picked city): search is the
                  main CTA — a visible input-shaped button, not a buried "změnit" link */}
              {!mapMode && origin.source !== 'geo' && (
                <button
                  type="button"
                  className="mt-3 flex w-full items-center gap-2 rounded-sm border border-hairline px-3 py-2.5 text-left text-base text-ink-faded hover:text-ink"
                  onClick={() => setPicking(true)}
                >
                  <MagnifierIcon />
                  {t('search_cta')}
                </button>
              )}
              {!mapMode && <FeastLine day={day} />}
              {/* season advisory replaces the per-row "ověřeno <year>" marker —
                  "times often change NOW, verify" is a signal the reader can
                  act on; a provenance year wasn't. Not in map mode: chrome
                  budget, the map is a page. */}
              {!mapMode && <VerifyBanner />}
            </div>
            {view === 'mapa' ? (
              online ? (
                <div className={mapMode ? 'mt-2 min-h-0 flex-1' : undefined}>
                  <Suspense
                    fallback={
                      <p className="mt-8 text-center text-ink-faded" role="status">
                        {t('map_loading')}
                      </p>
                    }
                  >
                    <MapView
                      key={`${origin.lat},${origin.lng}`} // new origin → fresh map center
                      origin={origin}
                      churches={index ?? []}
                      filters={filters}
                      cas={cas}
                      day={day}
                      onOpen={openChurch}
                      onNavigate={setNavTarget}
                      fill={mapMode}
                    />
                  </Suspense>
                </div>
              ) : (
                <p
                  className={`mt-8 text-ink-faded ${mapMode ? 'mx-auto w-full max-w-2xl px-5 sm:px-8' : ''}`}
                  role="status"
                >
                  {t('map_offline')}
                </p>
              )
            ) : rows.length > 0 ? (
              <>
                <ServiceList
                  rows={rows}
                  showUntil={day === 'now' || day === 0}
                  onOpen={openChurch}
                  onNavigate={setNavTarget}
                />
                {/* the cap is honest: another page of the ordo instead of "evening ends at 18:00" */}
                {day === 'now' && rows.length >= listLimit && (
                  <button
                    type="button"
                    className="rubric mt-4 -ml-1 min-h-11 px-1 py-3 underline decoration-hairline underline-offset-4 hover:text-ink"
                    onClick={() => setListLimit((l) => l + 30)}
                  >
                    {t('show_more')}
                  </button>
                )}
              </>
            ) : (
              <p className="mt-8 text-ink-faded">
                {anyFilter ? t('empty_filtered') : t('empty_plain')}{' '}
                {anyFilter && (
                  <button
                    type="button"
                    className="underline decoration-hairline underline-offset-2 hover:text-ink"
                    onClick={resetAll}
                  >
                    {t('clear_filters')}
                  </button>
                )}
              </p>
            )}
          </section>
        )}
          </>
        )}
      </main>

      {navTarget && <NavSheet target={navTarget} onClose={() => setNavTarget(null)} />}

      {!mapMode && (
      <footer className="border-t border-hairline py-4 text-sm text-ink-faded">
        {!online && (
          <p className="mb-1" role="status">
            {t('footer_offline')}
          </p>
        )}
        <FeedbackCard />
        <p className="mt-1">
          <span className="font-semibold" style={{ color: 'var(--season)' }}>
            {seasonLabel(season.season)}
          </span>
          {' · '}
          {lang() === 'cs' ? 'Data: rejstřík' : 'Data: registry'}{' '}
          <a
            className="underline decoration-hairline underline-offset-2 hover:text-ink"
            href="https://bohosluzby.cirkev.cz"
          >
            bohosluzby.cirkev.cz
          </a>
          {(dataAsOf || dataRefreshing) && (
            <span className="text-ink-faded">
              {' · '}
              {dataRefreshing ? t('footer_updating') : `${t('footer_asof_prefix')} ${fmtDataDate(dataAsOf!)}`}
            </span>
          )}
          {' · '}
          {t('footer_free')}
          {' · '}
          <a
            className="underline decoration-hairline underline-offset-2 hover:text-ink"
            href="https://github.com/sponsors/Chartres"
            target="_blank"
            rel="noreferrer"
          >
            {t('footer_support')}
          </a>
        </p>
      </footer>
      )}
    </div>
  )
}

// The day rubric of the ordo, as a picker: which page are you reading?
// Active day is set in rubric red — day labels are rubrics in a missal.
function DayPicker({ day, onChange }: { day: DayChoice; onChange: (d: DayChoice) => void }) {
  const options = useMemo(() => dayOptions(new Date()), [])
  // a bookmarked ?den= must not hide its own chip off-screen
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [day])
  // one horizontal line at every width: overflow scrolls (thumb-friendly),
  // never wraps to a second line; py-2 keeps the 44px tap targets unclipped
  return (
    <div
      role="group"
      aria-label={t('day_group')}
      className="scroll-row -ml-1 mt-1 flex items-baseline gap-x-4 overflow-x-auto py-2 whitespace-nowrap"
    >
      {options.map(({ key, label, lit }) => {
        const active = key === day
        // feast days get a quiet tint of their liturgical color (a missal marks them too)
        const feastStyle = !active && lit.feast ? { color: SEASON_VAR[lit.color] } : undefined
        return (
          <button
            key={String(key)}
            ref={active ? activeRef : undefined}
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

// seznam · mapa — a typographic view switch set like the day rubrics.
function ViewToggle({
  view,
  onChange,
}: {
  view: 'seznam' | 'mapa'
  onChange: (v: 'seznam' | 'mapa') => void
}) {
  const cls = (active: boolean) =>
    `-my-2 px-1 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] ${
      active
        ? 'text-rubric underline decoration-rubric decoration-2 underline-offset-4'
        : 'text-ink-faded hover:text-ink'
    }`
  return (
    <div role="group" aria-label={t('view_group')} className="flex items-baseline gap-x-1">
      <button
        type="button"
        aria-pressed={view === 'seznam'}
        className={cls(view === 'seznam')}
        onClick={() => onChange('seznam')}
      >
        {t('view_list')}
      </button>
      <span className="text-ink-faded" aria-hidden="true">
        ·
      </span>
      <button
        type="button"
        aria-pressed={view === 'mapa'}
        className={cls(view === 'mapa')}
        onClick={() => onChange('mapa')}
      >
        {t('view_map')}
      </button>
    </div>
  )
}

/** Magnifier for the search CTA — conservative outline shape, no emoji. */
function MagnifierIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 fill-current">
      <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
    </svg>
  )
}

/** Conservative ISA wheelchair glyph (no emoji — design brief), inline with the
 * meta line so a barrier-free row is exactly as tall as any other. */
function WheelchairIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={t('wheelchair_label')}
      className="inline-block h-3.5 w-3.5 fill-current align-[-2px]"
    >
      <title>{t('wheelchair_label')}</title>
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

/** One-line season advisory ("times often change now — verify"), shown only in
 * the windows when parishes actually shuffle schedules (summer, Advent,
 * Christmas, Lent, Easter octave). Missal-quiet: hairline rule, season color. */
function VerifyBanner() {
  const season = useMemo(() => verifySeason(new Date()), [])
  if (!season) return null
  return (
    <p
      className="mt-3 border-l-2 pl-3 text-sm text-ink-faded"
      style={{ borderColor: 'var(--season)' }}
    >
      {verifyBanner(season)}
    </p>
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
  onNavigate,
}: {
  rows: Upcoming[]
  showUntil: boolean
  onOpen: (id: string) => void
  onNavigate: (t: { name: string; lat: number; lng: number }) => void
}) {
  const now = new Date()
  let lastDay = ''
  return (
    <ol className="mt-2" data-testid="seznam">
      {rows.map((r, i) => {
        const day = dayLabel(now, r.start)
        const showDay = day !== lastDay
        lastDay = day
        // index suffix: the ordo can hold two rows with the same (church, start) —
        // duplicate keys corrupted reconciliation and left phantom rows on day switch
        return (
          <li key={`${r.church.id}-${r.start.getTime()}-${i}`}>
            {showDay && <h3 className="rubric mt-6 mb-1">{day}</h3>}
            {/* stretched link: the name anchor covers the row; mapa/web sit above it */}
            <div className="group relative flex items-baseline gap-4 border-t border-hairline py-3">
              <div className="w-16 shrink-0">
                <p className="font-display text-2xl font-semibold tabular-nums">
                  {fmtTime(r.start)}
                </p>
                {/* countdown under the time — the right edge belongs to the
                    verb stack, and a narrow column wraps "za 7 h 4 min" fine */}
                {showUntil && (
                  <p className="mt-0.5 text-xs font-semibold text-ink-faded">
                    {fmtUntil(now, r.start)}
                  </p>
                )}
              </div>
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
                  )}
                  {r.service.lang && r.service.lang !== 'česky' && (
                    <>
                      {' '}
                      <Chip label={langLabel(r.service.lang)} />
                    </>
                  )}
                  {r.service.greek && (
                    <>
                      {' '}
                      <Chip label={t('greek_chip')} />
                    </>
                  )}
                </p>
              </div>
              {/* the row's verbs: trasa opens the nav-app chooser, web the
                  parish site. Stacked VERTICALLY — side-by-side they squeezed
                  the church-name column to a sliver (user feedback). z-10
                  lifts them above the stretched detail link. */}
              <div className="flex shrink-0 flex-col items-end self-center">
                {/* ONE segmented group, hairline-divided — two loose bordered
                    buttons read as clutter (user feedback); the shared border
                    makes them one control with two verbs */}
                <div className="relative z-10 flex flex-col divide-y divide-hairline overflow-hidden rounded-sm border border-hairline">
                  <button
                    type="button"
                    aria-label={`${t('row_route')}: ${r.church.name}`}
                    className="flex min-h-11 items-center gap-1 px-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faded hover:bg-white/60 hover:text-ink"
                    onClick={() =>
                      onNavigate({ name: r.church.name, lat: r.church.lat, lng: r.church.lng })
                    }
                  >
                    <MapPinIcon />
                    {t('row_route')}
                  </button>
                  {r.church.www && (
                    <a
                      aria-label={`${t('row_web')}: ${r.church.name}`}
                      className="flex min-h-11 items-center gap-1 px-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faded hover:bg-white/60 hover:text-ink"
                      href={r.church.www}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <GlobeIcon />
                      {t('row_web')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Narrow viewport (one-hand phone)? jsdom has no matchMedia — treat as wide. */
function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia?.('(max-width: 639px)')
      mq?.addEventListener('change', cb)
      return () => mq?.removeEventListener('change', cb)
    },
    () => window.matchMedia?.('(max-width: 639px)').matches ?? false,
  )
}


// One pill line, set like a missal rubric — den · kdy · okruh · filtry as
// typographic pills (uppercase, middot rhythm, season accent when active), not
// a Material chip bar. Any pill opens the ordo sheet with every control grouped
// under rubric labels; narrow viewports get a bottom sheet, wide a bordered
// panel. Hit areas stay ≥44px via padding + negative margin.
function OrdoControls({
  day,
  onDay,
  cas,
  onCas,
  filters,
  onChange,
  langs,
  onReset,
}: {
  day: DayChoice
  onDay: (d: DayChoice) => void
  cas: string | null
  onCas: (c: string | null) => void
  filters: Filters
  onChange: (f: Filters) => void
  langs: string[]
  onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const narrow = useNarrow()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const whatCount = [filters.massOnly, filters.barrierFree, filters.greek, filters.lang].filter(
    Boolean,
  ).length
  const dayLbl =
    day === 'now'
      ? t('day_now')
      : (dayOptions(new Date()).find((o) => o.key === day)?.label ?? t('day_group'))
  const kdyLbl = cas ? (cas in BANDS ? bandLabel(cas as Band) : aroundLabel(cas)) : t('anytime')
  const okruhLbl = filters.maxKm ? withinKmLabel(filters.maxKm) : t('nearby_word')
  const filtryLbl = filtersLabel(whatCount)

  const toggleCls = (active: boolean) =>
    `-my-2 px-1 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] ${
      active ? 'underline decoration-2 underline-offset-4' : 'text-ink-faded hover:text-ink'
    }`
  const toggleStyle = (active: boolean) =>
    active ? { color: 'var(--season)', textDecorationColor: 'var(--season)' } : undefined
  const around = cas && !(cas in BANDS) ? cas : null
  const kolemTimes = useMemo(() => {
    const all = halfHoursFrom(new Date())
    if (day !== 'now' && day !== 0) return all // future day: all 48 valid
    const wrap = all.findIndex((v, i) => i > 0 && v < all[i - 1])
    return wrap === -1 ? all : all.slice(0, wrap)
  }, [day])

  // a pill names its group ("den: dnes") so pill and in-sheet chip never share
  // an accessible name — and a screen reader hears what the value belongs to
  const pill = (group: string, label: string, active: boolean) => (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${group}: ${label}`}
      className={`-my-2 flex items-baseline gap-1 px-1 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] whitespace-nowrap ${
        active ? 'underline decoration-2 underline-offset-4' : 'text-ink-faded hover:text-ink'
      }`}
      style={toggleStyle(active)}
      onClick={() => setOpen((o) => !o)}
    >
      {label}
      <span aria-hidden="true" className="text-[0.6rem]">
        ▾
      </span>
    </button>
  )

  const sheet = (
    <div
      role={narrow ? 'dialog' : undefined}
      aria-modal={narrow || undefined}
      aria-label={t('day_filters_group')}
      className={
        narrow
          ? 'fixed inset-x-0 bottom-0 z-[1200] max-h-[80dvh] overflow-y-auto border-t border-hairline bg-paper px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
          : 'pb-3'
      }
    >
      <p className="rubric mt-2 text-ink-faded">{t('day_group').toLowerCase()}</p>
      <DayPicker day={day} onChange={onDay} />
      <p className="rubric mt-2 text-ink-faded">{t('rubric_when')}</p>
      <div
        role="group"
        aria-label={t('rubric_when')}
        className="-ml-1 mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1"
      >
        {(Object.keys(BANDS) as Band[]).map((band) => {
          // "hned" + a band that's fully over today: visibly muted (still
          // tappable — picking it jumps to zítra via resolveCasDay)
          const past = day === 'now' && cas !== band && bandFullyPast(band, new Date())
          return (
            <button
              key={band}
              type="button"
              aria-pressed={cas === band}
              className={`${toggleCls(cas === band)}${past ? ' opacity-40' : ''}`}
              style={toggleStyle(cas === band)}
              title={past ? t('band_past_title') : undefined}
              onClick={() => onCas(cas === band ? null : band)}
            >
              {bandLabel(band)}
            </button>
          )
        })}
        {/* 30-min-step typographic selector — native step=1800 isn't honored cross-browser.
            16px font: a smaller select makes iOS zoom the page on focus */}
        <label
          className={`-my-2 flex items-baseline gap-1.5 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] ${
            around ? '' : 'text-ink-faded'
          }`}
          style={around ? { color: 'var(--season)' } : undefined}
        >
          {t('around_word')}
          <select
            aria-label={t('around_time_aria')}
            value={around ?? ''}
            onChange={(e) => onCas(e.target.value || null)}
            className="-my-2 cursor-pointer border-0 border-b border-hairline bg-transparent py-2 font-sans text-base font-semibold tabular-nums"
            style={around ? { color: 'var(--season)' } : undefined}
          >
            <option value="">—</option>
            {/* rotated to open at "now"; for today the wrapped-around tail
                (past times) is dropped — every one guaranteed an empty list */}
            {kolemTimes.map((hhmm) => (
              <option key={hhmm} value={hhmm}>
                {hhmm}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="rubric mt-2 text-ink-faded">{t('rubric_range')}</p>
      <div
        role="group"
        aria-label={t('rubric_range')}
        className="-ml-1 mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1"
      >
        {MAX_KM_OPTIONS.map((km) => (
          <button
            key={km}
            type="button"
            aria-pressed={filters.maxKm === km}
            className={toggleCls(filters.maxKm === km)}
            style={toggleStyle(filters.maxKm === km)}
            onClick={() => onChange({ ...filters, maxKm: filters.maxKm === km ? null : km })}
          >
            {withinKmLabel(km)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={filters.maxKm === null}
          className={toggleCls(false)}
          onClick={() => onChange({ ...filters, maxKm: null })}
        >
          {t('any_distance')}
        </button>
      </div>
      <p className="rubric mt-2 text-ink-faded">{t('rubric_what')}</p>
      <div
        role="group"
        aria-label={t('filters_group_aria')}
        className="-ml-1 mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1"
      >
        <button
          type="button"
          aria-pressed={filters.massOnly}
          className={toggleCls(filters.massOnly)}
          style={toggleStyle(filters.massOnly)}
          onClick={() => onChange({ ...filters, massOnly: !filters.massOnly })}
        >
          {t('filt_mass_only')}
        </button>
        <button
          type="button"
          aria-pressed={filters.barrierFree}
          className={toggleCls(filters.barrierFree)}
          style={toggleStyle(filters.barrierFree)}
          onClick={() => onChange({ ...filters, barrierFree: !filters.barrierFree })}
        >
          {t('filt_barrier_free')}
        </button>
        <button
          type="button"
          aria-pressed={filters.greek}
          className={toggleCls(filters.greek)}
          style={toggleStyle(filters.greek)}
          onClick={() => onChange({ ...filters, greek: !filters.greek })}
        >
          {t('filt_greek')}
        </button>
        {langs.length > 1 && (
          <select
            aria-label={t('lang_select_aria')}
            value={filters.lang ?? ''}
            onChange={(e) => onChange({ ...filters, lang: e.target.value || null })}
            className={`-my-2 max-w-44 cursor-pointer border-0 border-b border-hairline bg-transparent py-3.5 font-sans text-base font-semibold ${
              filters.lang ? '' : 'text-ink-faded'
            }`}
            style={filters.lang ? { color: 'var(--season)' } : undefined}
          >
            <option value="">{t('lang_all')}</option>
            {langs.map((l) => (
              <option key={l} value={l}>
                {langLabel(l)}
              </option>
            ))}
          </select>
        )}
      </div>
      {narrow && (
        <button
          type="button"
          className="rubric mt-4 w-full border-t border-hairline pt-3 pb-1 text-center"
          onClick={() => setOpen(false)}
        >
          {t('done')}
        </button>
      )}
    </div>
  )

  return (
    <div className="border-b border-hairline">
      <div
        role="group"
        aria-label={t('day_filters_group')}
        // gap-x-3: "kdykoli · okolí · filtry · ✕" must fit 375px without the
        // clear pill scrolling out of reach (user feedback)
        className="scroll-row -ml-1 flex items-baseline gap-x-3 overflow-x-auto py-2 whitespace-nowrap"
      >
        {pill(t('day_group').toLowerCase(), dayLbl, day !== 'now')}
        {pill(t('rubric_when'), kdyLbl, Boolean(cas))}
        {pill(t('rubric_range'), okruhLbl, Boolean(filters.maxKm))}
        {pill(t('rubric_what'), filtryLbl, whatCount > 0)}
        {/* anything narrowed → one pill back to the clean page */}
        {(day !== 'now' || cas || filters.maxKm || whatCount > 0) && (
          <button
            type="button"
            aria-label={t('clear_all_aria')}
            // sticky right-0: the reset must NEVER scroll out of reach (320px
            // with every pill active pushed it off-edge — audit finding)
            className="sticky right-0 -my-2 ml-auto bg-paper px-2.5 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] text-rubric hover:text-ink"
            onClick={onReset}
          >
            {t('clear_all')}
          </button>
        )}
      </div>
      {open && narrow && (
        <button
          type="button"
          aria-label={t('close_filters_aria')}
          className="fixed inset-0 z-[1190] bg-ink/20"
          onClick={() => setOpen(false)}
        />
      )}
      {open && sheet}
    </div>
  )
}

function DetailRoute({ id, index, onBack }: { id: string; index: Church[]; onBack: () => void }) {
  const church = index.find((c) => c.id === id)
  if (!church) {
    return (
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">{t('church_not_found_title')}</h2>
        <p className="mt-2 text-ink-faded">
          {t('church_not_found_body')}{' '}
          <button type="button" className="underline decoration-hairline underline-offset-2" onClick={onBack}>
            {t('detail_route_back')}
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
            {t('back_to_list')}
          </button>
        </p>
      )}
      <label className="rubric block" htmlFor="city">
        {t('search_label')}
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
        placeholder={t('search_placeholder')}
        autoComplete="off"
        autoFocus={Boolean(onClose)} // opened by an explicit "změnit" tap — jump right in
        className="mt-2 min-h-11 w-full rounded-sm border border-hairline bg-white/60 px-3 text-base"
      />
      <ul id="city-options" role="listbox" aria-label={t('search_results_aria')} className="mt-1">
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
                {r.kind === 'city' ? `${t('kind_town')} · ${churchCount(r.city.count)}` : r.church.city}
              </span>
            </button>
          </li>
        ))}
        {value.trim().length >= 2 && results.length === 0 && (
          <li className="px-1 py-2.5 text-sm text-ink-faded">{t('search_none')}</li>
        )}
      </ul>
    </div>
  )
}

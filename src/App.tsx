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
import { pragueDay, pragueIsoDate } from './domain/occurrences'
import { noteShownOnDay } from './domain/notes'
import { currentLiturgicalDay, verifySeason, type LiturgicalDay } from './domain/liturgical'
import { dayFromParam, dayOptions, dayToParam, litForChoice } from './domain/days'
import { fmtDistance, fmtTime, fmtUntil, dayLabel, samePragueDay } from './domain/format'
import { aggregateCities, cityLabel, findCity, type City } from './domain/cities'
import { BANDS, bandFullyPast, bandLabel, halfHoursFrom, parseCas, resolveCasDay, type Band } from './domain/timeband'
import { ChurchDetail, Chip, NoteText } from './ChurchDetail'
import { NavSheet, type NavTarget } from './NavSheet'
import { IntroGuide } from './IntroGuide'
import { SearchPicker } from './SearchPicker'
import { MyChurches } from './MyChurches'
import { holyDayLine } from './domain/holyday'
import { FeedbackCard } from './FeedbackCard'
import { AfterMassCard, type CardMass } from './AfterMassCard'
import { massKey, riteOf, slotKey, WITNESS_CHIPS, type MassFeedback } from './domain/feedback'
import { aggregateFor, churchHasTags, loadAggregates, submitFeedback } from './lib/feedbackStore'
import { dueCards, markAnswered, neverAsk, type LedgerEntry } from './lib/feedbackLedger'
import { WITNESS_ENABLED } from './lib/flags'
import { track, conversion, logError } from './analytics'
import { getCurrentPosition, getPermissionState, type GeoFailure } from './lib/geo'
import { isNative, platform } from './lib/native'
import { pageViewContext } from './lib/telemetry'
import { loadData, refreshData, activeAsOf } from './lib/dataStore'
import { writeJson } from './lib/storage'
import {
  lang,
  locale,
  t,
  langLabel,
  filtersLabel,
  aroundLabel,
  withinKmLabel,
  nothingNearbyBody,
  verifyBanner,
  type Key,
} from './i18n'

const NEARBY_KM = 30
const NEARBY_CAP = 120
const LIST_LIMIT = 20

// First-run intro guide: shown once (localStorage flag), forceable with ?intro=1.
const INTRO_SEEN_KEY = 'bohosluzby:introSeen'
const introInitiallyOpen = (search: string): boolean => {
  if (new URLSearchParams(search).get('intro') === '1') return true
  try {
    return !localStorage.getItem(INTRO_SEEN_KEY)
  } catch {
    return false // private mode → don't nag
  }
}

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
    if (opts.sameDay && !samePragueDay(new Date(parsed.savedAt), new Date())) return null
    return parsed.value ?? null
  } catch {
    return null // private mode, or a pre-TTL value written by an older build
  }
}

function saveSticky<T>(key: string, value: T): void {
  writeJson(key, { savedAt: Date.now(), value })
}

function loadFilters(): Filters {
  const f = { ...NO_FILTERS, ...loadSticky<Filters>(FILTERS_KEY) }
  // With witness disabled there is no filter UI to clear a stale persisted
  // selection — drop it so an old build's witnessTags can't silently narrow the list.
  if (!WITNESS_ENABLED) f.witnessTags = []
  return f
}

// ISO weekday (1=Mon…7=Sun) of an instant, on the Prague calendar.
const isoDayOf = (at: Date): number => pragueDay(at).getUTCDay() || 7

// Minimal history routing (GH Pages serves 404.html = the app for deep links).
type Route = { view: 'home' } | { view: 'church'; id: string } | { view: 'city'; slug: string }

/** Which guidance a failed geolocation gets. Each failure has ITS OWN way out —
 * and the native shell has no address bar, lock icon or browser dialog, so the
 * web wording is wrong advice there. `waiting`: a late fix can still land. */
export function geoFailKey(fail: GeoFailure | null, native: boolean, waiting: boolean): Key {
  if (fail === 'unavailable') return 'geo_fail_unavailable'
  if (native) {
    if (fail === 'denied') return 'geo_fail_native_denied'
    return waiting && fail === 'deadline' ? 'geo_fail_native_slow' : 'geo_fail_native_none'
  }
  return fail === 'deadline' ? 'geo_fail_deadline' : 'geo_fail_denied'
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }

export function parseRoute(path: string): Route {
  const kostel = /^\/kostel\/([^/]+)\/?$/.exec(path)
  if (kostel) return { view: 'church', id: safeDecode(kostel[1]) }
  const mesto = /^\/mesto\/([^/]+)\/?$/.exec(path)
  if (mesto) return { view: 'city', slug: safeDecode(mesto[1]) }
  return { view: 'home' }
}

function useRoute() {
  const [url, setUrl] = useState(() => location.pathname + location.search)
  useEffect(() => {
    const onPop = () => setUrl(location.pathname + location.search)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (to: string, opts?: { replace?: boolean; state?: unknown }) => {
    if (opts?.replace) {
      history.replaceState(history.state, '', to) // e.g. a day switch — not a history entry
    } else {
      // `app` marks an entry pushed from inside the app: zpět can pop back to it
      history.pushState({ ...(opts?.state ?? {}), app: true }, '', to)
      window.scrollTo(0, 0)
    }
    setUrl(to)
  }
  const q = url.indexOf('?')
  const path = q === -1 ? url : url.slice(0, q)
  const search = q === -1 ? '' : url.slice(q)
  return { route: parseRoute(path), path, search, navigate }
}

// Prototype flag (TestFlight builds only, never production): force-shows the
// witness card so it can be tried on device where there's no URL bar for
// ?feedback=preview. Baked in by the build with VITE_WITNESS_PREVIEW=1.
const WITNESS_PREVIEW = import.meta.env.VITE_WITNESS_PREVIEW === '1'

/** `?feedback=preview` demo Mass: the first nearby church with a regular
 * service, keyed to that service's first weekday so the detail page shows the
 * corroborated line after saving. Lets the owner toy locally with no waiting. */
function demoMass(data: { nearby: Church[]; byId: Map<string, ChurchServices> }): CardMass | null {
  for (const c of data.nearby) {
    const svc = data.byId.get(c.id)?.regular[0]
    if (!svc) continue
    const weekday = Number(svc.days[0])
    return {
      churchId: c.id,
      massKey: slotKey(c.id, weekday, svc.time, riteOf(svc), svc.lang),
      churchName: c.name,
      type: svc.type || t('service_fallback'),
      weekday,
      time: svc.time,
      rite: riteOf(svc),
      lang: svc.lang,
      massDate: pragueIsoDate(new Date()),
    }
  }
  return null
}

export default function App() {
  const [index, setIndex] = useState<Church[] | null>(null)
  const [dataError, setDataError] = useState(false)
  const [partialData, setPartialData] = useState(false) // a shard failed; the rest still shows
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
  // Tick every minute so time-sensitive memos (season, holy, rows) stay current.
  const [now, setNow] = useState(() => new Date())
  const season = useMemo(() => currentLiturgicalDay(now), [now])
  const convertedRef = useRef(false)
  const [dueEntry, setDueEntry] = useState<LedgerEntry | null>(null)
  const [previewDismissed, setPreviewDismissed] = useState(false)
  const dismissedRef = useRef<Set<string>>(new Set())
  const [introOpen, setIntroOpen] = useState(() => introInitiallyOpen(location.search))
  // A church-detail page showing a full-bleed photo hero suppresses the masthead
  // so the image reaches the very top; ChurchDetail reports this per church.
  const [detailHero, setDetailHero] = useState(false)
  const closeIntro = () => {
    setIntroOpen(false)
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      // private mode — nothing to persist
    }
  }
  const { route, path, search, navigate } = useRoute()

  // the selected day + time filter live in the URL (?den=nedele&cas=vecer) —
  // bookmarkable, back-safe, and they compose ("v neděli kolem 9:00")
  const params = new URLSearchParams(search)
  const feedbackParam = params.get('feedback')
  const den = params.get('den')
  const day = useMemo(() => dayFromParam(now, den), [den, now]) // now ticks → re-resolves after midnight
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
  const online = useSyncExternalStore(onlineStore.subscribe, onlineStore.snapshot)
  // seznam · mapa. The map is the landing view — the app's edge is times shown ON
  // the map without tapping. But the map needs a connection; offline (no explicit
  // choice) we land on the seznam, the offline-safe path. An explicit ?zobrazeni
  // always wins and round-trips.
  const view: 'seznam' | 'mapa' =
    params.get('zobrazeni') === 'seznam'
      ? 'seznam'
      : params.get('zobrazeni') === 'mapa'
        ? 'mapa'
        : online
          ? 'mapa'
          : 'seznam'
  const setView = (v: 'seznam' | 'mapa') => {
    setParam('zobrazeni', v) // record the choice explicitly so it survives a reload
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
  }, [season.color])

  // One page_view per load. `season` is re-memoised on every minute tick and
  // every resume, so depending on it counted a visit each time (web KPIs).
  useEffect(() => {
    let standalone = false
    try {
      standalone = window.matchMedia('(display-mode: standalone)').matches
    } catch {
      // no matchMedia (tests, very old WebViews)
    }
    track('page_view', {
      season: season.season,
      ...pageViewContext({
        pathname: location.pathname,
        search: location.search,
        referrer: document.referrer,
        host: location.host,
        lang: lang(),
        platform,
        standalone,
      }),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

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
  // `background`: an automatic re-locate (resume) — runs only under an already
  // granted permission, so it can never raise a system dialog on its own.
  const locate = (background = false) => {
    // Never block on a fix we might not get (airplane mode!): the last known
    // position seeds the list IMMEDIATELY — visibly marked as such — while the
    // fresh location is fetched in the background and swapped in on arrival.
    const last = loadLastOrigin()
    if (last) setOrigin((cur) => cur ?? last)
    const fallback = (reason: GeoFailure) => {
      setGeoFail(reason)
      if (!last) setGeoDenied(true) // with a seeded origin the list already stands
    }
    if (!background) setLocating(true)
    getPermissionState().then((perm) => {
      if (background && perm !== 'granted') return // stay silent, keep the list
      if (background) setLocating(true)
      if (perm === 'denied') {
        setLocating(false)
        fallback('denied') // no callback is coming — don't pretend to wait for one
        return
      }
      setGeoPrompting(perm === 'prompt')
      // an unanswered permission dialog deserves a longer leash than a slow fix
      getCurrentPosition({
        deadlineMs: perm === 'prompt' ? 30_000 : 10_000,
        // The deadline only ends the WAIT. A fix that lands later (iOS often
        // takes 10–12 s) still becomes the origin — unless the user has chosen
        // something themselves in the meantime (a city, a church, the picker).
        // A 'geo' origin is no choice: a resume re-locate replaces the old fix.
        onLate: (late) => {
          setLocating(false)
          if (!late.coords) return
          if (originRef.current?.source === 'city' || pickingRef.current) return
          setOrigin({ lat: late.coords.lat, lng: late.coords.lng, source: 'geo' })
          setGeoFail(null)
          setGeoDenied(false)
        },
      }).then((r) => {
        setGeoPrompting(false)
        if (r.coords) {
          setLocating(false)
          const { lat, lng } = r.coords
          // a city picked while the fix was pending (up to 30 s) wins over it
          setOrigin((cur) => (cur?.source === 'city' ? cur : { lat, lng, source: 'geo' }))
        } else {
          if (r.error !== 'deadline') setLocating(false) // a deadline keeps listening (onLate)
          fallback(r.error ?? 'timeout')
        }
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
    writeJson(LAST_ORIGIN_KEY, { lat: origin.lat, lng: origin.lng, label: origin.label })
  }, [origin])


  // /mesto/<slug>/ — the city's centroid becomes the origin (SEO landing pages).
  // Leaving the city route for home (browser back, "moje poloha", zpět from a
  // detail) re-runs geolocation: "/" means "my location".
  const citySlug = route.view === 'city' ? route.slug : null
  const originRef = useRef(origin)
  originRef.current = origin
  const pickingRef = useRef(picking)
  pickingRef.current = picking
  useEffect(() => {
    if (!index) return
    if (citySlug) {
      const city = findCity(index, citySlug)
      if (city) {
        setOrigin({ lat: city.lat, lng: city.lng, source: 'city', label: cityLabel(city) })
        document.title = `Kam na mši — ${cityLabel(city)} | ${t('city_title_suffix')}`
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
    setPartialData(false)
    const nearby = index
      .map((c) => ({ c, d: haversineKm(origin.lat, origin.lng, c.lat, c.lng) }))
      .filter(({ d }) => d <= NEARBY_KM)
      .sort((a, b) => a.d - b.d)
      .slice(0, NEARBY_CAP)
      .map(({ c }) => c)
    const cells = [...new Set(nearby.map((c) => c.cell))]
    Promise.all(
      cells.map((cell) =>
        loadData<Parameters<typeof decodeShard>[0]>(`services/${cell}.json`).catch((err: unknown) => {
          logError(err, { where: 'load-shard', cell })
          return null
        }),
      ),
    )
      .then((shards) => {
        if (cancelled) return
        const byId = new Map<string, ChurchServices>()
        for (const shard of shards) {
          if (shard) for (const [id, s] of decodeShard(shard)) byId.set(id, s)
        }
        setData({ nearby, byId })
        // a missing cell would read as "no Mass nearby" — say the list is partial
        setPartialData(shards.includes(null))
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

  // Witness aggregates for the nearby churches — loaded whenever a list is up so
  // the rows can carry the quiet witness mark, and so the "Ohlasy poutníků"
  // filter has data to narrow on. aggTick bumps when a load resolves so the row
  // filter and the per-row mark re-read the refreshed cache.
  const [aggTick, setAggTick] = useState(0)
  const witnessTags = filters.witnessTags
  useEffect(() => {
    if (!WITNESS_ENABLED || !data) return
    let cancelled = false
    void loadAggregates(data.nearby.map((c) => c.id)).then(() => {
      if (!cancelled) setAggTick((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [data])

  // Resumed from the background (native, installed PWA, a tab left open): the
  // sticky expiry and "where am I" were only checked at mount. Re-check them so
  // a resume behaves like opening the app — last night's "večer" gone, and a
  // phone carried to another town lists that town.
  const resumeRef = useRef<(hiddenAt: number) => void>(() => {})
  resumeRef.current = (hiddenAt) => {
    setFilters((cur) => {
      const next = loadFilters()
      return JSON.stringify(next) === JSON.stringify(cur) ? cur : next
    })
    const resumed = new Date()
    const saved = parseCas(loadSticky<string>(CAS_KEY, { sameDay: true }))
    // a saved kdy expires on the same clock as the filters; a URL-only one (shared
    // link, nothing stored) on time away
    let expired = false
    try {
      expired = saved === null && localStorage.getItem(CAS_KEY) !== null
    } catch {
      // private mode — nothing was stored
    }
    const away = resumed.getTime() - hiddenAt > STICKY_TTL_MS || !samePragueDay(new Date(hiddenAt), resumed)
    if (cas && saved !== cas && (expired || away)) setParam('cas', saved)
    // ponytail: 15 min away ≈ maybe moved; shorter app switches keep the list as is
    if (origin?.source === 'geo' && !picking && resumed.getTime() - hiddenAt >= 15 * 60_000) locate(true)
  }

  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, 60_000)
    // timers sleep while the app is backgrounded — refresh at once on resume,
    // not up to a minute later with Masses that already started still listed
    let hiddenAt: number | null = null
    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        hiddenAt = Date.now()
        return
      }
      tick()
      if (hiddenAt !== null) resumeRef.current(hiddenAt)
      hiddenAt = null
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // one shared selector with the map — the seznam and the mapa never disagree.
  // The witness filter is applied on top (over the aggregates, not the service
  // data): keep only Masses carrying ALL selected tags at slot- or church-tier.
  const rows: Upcoming[] | null = useMemo(() => {
    if (!data || !origin) return null
    const all = selectUpcoming(now, origin, data.nearby, data.byId, filters, cas, day, {
      limit: witnessTags.length ? Infinity : listLimit,
    })
    if (witnessTags.length === 0) return all
    return all
      .filter((u) => churchHasTags(u.church.id, massKey(u.church.id, u.service, u.start), witnessTags))
      .slice(0, listLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aggTick refreshes the aggregate reads
  }, [data, origin, filters, day, cas, listLimit, witnessTags, aggTick, now])

  // the no-location path: the six towns with the most churches, one tap each
  const popularCities = useMemo(() => (index ? aggregateCities(index).slice(0, 6) : []), [index])
  const holy = useMemo(() => holyDayLine(now), [now])

  // list_ready — the aha that needs no click: a list of times stood on screen.
  // Once per visit; how long it took and how the origin was found.
  const listReadySent = useRef(false)
  useEffect(() => {
    if (listReadySent.current || !rows || rows.length === 0 || !origin) return
    listReadySent.current = true
    track('key_action', {
      action: 'list_ready',
      ms: Math.round(performance.now()),
      source: origin.source,
      rows: rows.length,
    })
  }, [rows, origin])

  // Churches that carry corroborated (thresholded) church-wide witness tags —
  // the set the list rows mark with a quiet rubric sign. Read from the same
  // aggregate cache the map and detail use; aggTick refreshes it on each load.
  const witnessChurches = useMemo(() => {
    const set = new Set<string>()
    if (WITNESS_ENABLED && data)
      for (const c of data.nearby) if (aggregateFor(c.id).church.chips.length > 0) set.add(c.id)
    return set
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aggTick refreshes the aggregate reads
  }, [data, aggTick])

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
    filters.witnessTags.length > 0 ||
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

  // ---- after-Mass witness card (pilgrim witness) --------------------------
  // Real due cards come from the local ledger; ?feedback=preview force-shows a
  // demo Mass so the owner can toy locally without waiting an hour after a Mass.
  // ?feedback=preview OR a build-time flag (VITE_WITNESS_PREVIEW=1, TestFlight
  // prototype only — there's no URL bar on device) force-shows the demo card.
  const isPreview = WITNESS_ENABLED && (feedbackParam === 'preview' || WITNESS_PREVIEW)
  useEffect(() => {
    if (!WITNESS_ENABLED || isPreview) return
    const due = dueCards(new Date()).find((e) => !dismissedRef.current.has(e.massKey)) ?? null
    setDueEntry(due)
  }, [isPreview, route.view])
  const previewMass = useMemo(
    () => (isPreview && !previewDismissed && data ? demoMass(data) : null),
    [isPreview, previewDismissed, data],
  )
  const cardMass: CardMass | null = previewMass ?? dueEntry
  const clearPreview = () => {
    if (feedbackParam) setParam('feedback', null)
  }
  const onCardSubmit = (s: MassFeedback) => {
    if (isPreview) {
      markAnswered(s.massKey) // preview never writes to production; always dismiss
    } else {
      // Only mark answered when the server write succeeds; on error the user
      // will be prompted again on next visit so they can retry.
      void submitFeedback(s).then((ok) => { if (ok) markAnswered(s.massKey) })
    }
  }
  const onCardDismiss = () => {
    if (isPreview) {
      clearPreview()
      setPreviewDismissed(true)
    } else if (dueEntry) {
      dismissedRef.current.add(dueEntry.massKey)
      setDueEntry(null)
    }
  }
  const onCardNever = () => {
    neverAsk()
    setDueEntry(null)
    clearPreview()
    setPreviewDismissed(true)
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
  // `at`: the tapped service's start — the church page leads with that day's
  // services (history.state, so the URL stays clean and shareable)
  const openChurch = (id: string, at?: Date) => {
    if (!convertedRef.current) {
      convertedRef.current = true
      conversion({ church: id })
    }
    navigate(`/kostel/${id}/${search}`, { state: at ? { at: at.toISOString() } : null }) // keep ?den/?cas — back restores the view
  }

  // map mode: the map IS the page — a viewport-locked column, slim chrome, no
  // footer; everything else keeps the scrolling missal-page layout
  const mapMode = view === 'mapa' && route.view !== 'church' && !picking && !dataError
  // the map column is full-bleed, so any text block shown in map mode needs the
  // page gutter back (no-location, nothing-nearby, holy-day line)
  const gutter = mapMode ? 'mx-auto w-full max-w-2xl px-5 sm:px-8' : ''

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
          Negative margins bleed the paper background across the column padding.
          Exception: a church detail with a photo hero drops the masthead so the
          image bleeds full to the top, its back+help overlaid on the hero. */}
      {!(route.view === 'church' && detailHero) && (
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
        {/* wordmark left, an always-reachable help affordance right — the footer
            "nápověda" link is hidden in map mode (the default view), so the
            re-open lives in the masthead where it survives every view. */}
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-xl font-bold tracking-tight">Kam na mši</h1>
          <button
            type="button"
            onClick={() => setIntroOpen(true)}
            aria-label={t('intro_help')}
            className="-my-2 shrink-0 px-1 py-2 text-xs font-semibold tracking-[0.08em] text-ink-faded uppercase hover:text-ink"
          >
            ? {t('intro_help')}
          </button>
        </div>
      </header>
      )}

      <main className={mapMode ? 'flex min-h-0 flex-1 flex-col' : 'flex-1 pb-10'}>
        {dataError && (
          <p className="mt-10 text-ink-faded" role="alert">
            {t('data_error')}
          </p>
        )}
        {!dataError && partialData && (
          <p className={`mt-2 text-sm text-ink-faded ${gutter}`} role="status">
            {t('partial_data')}
          </p>
        )}

        {!dataError && route.view === 'church' && index && (
          <DetailRoute
            id={route.id}
            index={index}
            // pop back to where the detail was opened from (a /mesto/<slug>/ list
            // keeps its city); a shared link opened cold has nothing to pop → home
            onBack={() => ((history.state as { app?: boolean } | null)?.app ? history.back() : navigate(`/${search}`))}
            onHelp={() => setIntroOpen(true)}
            onHeroChange={setDetailHero}
          />
        )}
        {!dataError && route.view === 'church' && !index && (
          <p className="mt-8 text-ink-faded" role="status">
            {t('loading_ellipsis')}
          </p>
        )}

        {route.view !== 'church' && (
          <>
        {!dataError && cardMass && (
          <AfterMassCard
            key={cardMass.massKey}
            entry={cardMass}
            onSubmit={onCardSubmit}
            onDismiss={onCardDismiss}
            onNeverAsk={onCardNever}
          />
        )}
        {/* prototype only: re-open the demo card after dismissing it on device */}
        {WITNESS_PREVIEW && !cardMass && (
          <button
            type="button"
            onClick={() => setPreviewDismissed(false)}
            className="rubric mt-5 min-h-11 px-1 underline decoration-hairline underline-offset-2 hover:text-ink"
          >
            Zobrazit náhled zpětné vazby znovu
          </button>
        )}
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
          <section className={`mt-10 ${gutter}`}>
            <h2 className="font-display text-xl font-semibold">
              {isNative && geoFail === 'deadline' && locating ? t('no_geo_title_slow') : t('no_geo_title')}
            </h2>
            <p className="mt-2 max-w-prose text-ink-faded">{t('no_geo_body')}</p>
            <p className="mt-2 max-w-prose text-ink-faded">
              {/* each failure gets ITS OWN way out — "unblock in the browser" is
                  wrong advice when the phone's location services are off */}
              {t(geoFailKey(geoFail, isNative, locating))}
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
            {/* the no-location path is first-class: the big towns are one tap away */}
            <div role="group" aria-label={t('popular_cities')} className="mt-3 flex flex-wrap gap-2">
              {popularCities.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className="min-h-11 rounded-full border border-hairline px-4 text-sm hover:border-ink"
                  onClick={() => pickCity(c)}
                >
                  {c.name}
                </button>
              ))}
            </div>
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

        {!dataError && !picking && !loading && origin && rows && rows.length === 0 && !anyFilter && day === 'now' && index && (
          <section className={`mt-10 ${gutter}`}>
            <h2 className="font-display text-xl font-semibold">{t('nothing_nearby_title')}</h2>
            <p className="mt-2 max-w-prose text-ink-faded">
              {nothingNearbyBody(NEARBY_KM, origin.label ?? null)}
            </p>
            <SearchPicker index={index} onPickCity={pickCity} onPickChurch={pickChurch} />
          </section>
        )}

        {!dataError && !picking && !loading && origin && index && !mapMode && (
          <MyChurches index={index} origin={origin} onOpen={openChurch} />
        )}
        {!dataError && !picking && !loading && origin && holy && !(holy.when === 'tomorrow' && day === 1) && (
          <p className={`mt-4 text-sm text-ink-faded ${gutter}`}>
            {holy.when === 'tomorrow' ? t('holy_tomorrow') : t('holy_today')} {holy.feast}
            {holy.when === 'tomorrow' && (
              <>
                {' · '}
                <button
                  type="button"
                  className="-my-3 inline-block py-3 underline decoration-hairline underline-offset-2 hover:text-ink"
                  onClick={() => setDay(1)}
                >
                  {t('holy_cta')}
                </button>
              </>
            )}
          </p>
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
                now={now}
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
              {!mapMode && <VerifyBanner now={now} />}
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
                  witnessChurches={witnessChurches}
                  onOpen={openChurch}
                  onNavigate={setNavTarget}
                />
                {/* the cap is honest: another page of the ordo instead of "evening ends at 18:00" */}
                {(day === 'now' || witnessTags.length > 0) && rows.length >= listLimit && (
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
      {introOpen && <IntroGuide onClose={closeIntro} />}

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
            {t(`season_${season.season}`)}
          </span>
          {' · '}
          {t('footer_data')}{' '}
          <a
            className="-my-3 inline-block py-3 underline decoration-hairline underline-offset-2 hover:text-ink"
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
            className="-my-3 inline-block py-3 underline decoration-hairline underline-offset-2 hover:text-ink"
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
function DayPicker({ day, onChange, now = new Date() }: { day: DayChoice; onChange: (d: DayChoice) => void; now?: Date }) {
  const options = useMemo(() => dayOptions(now), [now])
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
function VerifyBanner({ now = new Date() }: { now?: Date } = {}) {
  const season = useMemo(() => verifySeason(now), [now])
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

/** The quiet witness sign on a list row: the same rubric reference mark (‟) the
 * map overlays on a chip, inline and small. Presence, not a count — the detail
 * page carries the testimony. Shown only for churches over the corroboration
 * floor (docs/PILGRIM-WITNESS-PLAN.md — no stars, no score). */
function WitnessMark() {
  return (
    <span
      role="img"
      aria-label={t('fb_list_mark_aria')}
      title={t('fb_list_mark_aria')}
      className="font-display font-bold text-rubric"
    >
      ‟
    </span>
  )
}

function ServiceList({
  rows,
  showUntil,
  witnessChurches,
  onOpen,
  onNavigate,
}: {
  rows: Upcoming[]
  showUntil: boolean
  witnessChurches: Set<string>
  onOpen: (id: string, at?: Date) => void
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
                      onOpen(r.church.id, r.start)
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
                  {/* a note naming another of the service's weekdays ("…není páteční mše") stays off this day's row */}
                  <NoteText note={noteShownOnDay(r.service.note, 'days' in r.service ? r.service.days : '', isoDayOf(r.start)) ? r.service.note : ''} />
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
                  {witnessChurches.has(r.church.id) && (
                    <>
                      {' · '}
                      <WitnessMark />
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
  now = new Date(),
}: {
  day: DayChoice
  onDay: (d: DayChoice) => void
  cas: string | null
  onCas: (c: string | null) => void
  filters: Filters
  onChange: (f: Filters) => void
  langs: string[]
  onReset: () => void
  now?: Date
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

  const whatCount =
    [filters.massOnly, filters.barrierFree, filters.greek, filters.lang].filter(Boolean).length +
    filters.witnessTags.length
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
      className={`-my-2 flex items-baseline gap-1 px-1 py-3.5 text-sm font-semibold uppercase tracking-[0.06em] whitespace-nowrap ${
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
      <DayPicker day={day} onChange={onDay} now={now} />
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
          {/* "kolem" only reads once a time is chosen ("kolem 9:00"); unset, the
              select carries a self-contained prompt so no dangling em-dash shows */}
          {around && t('around_word')}
          <select
            aria-label={t('around_time_aria')}
            value={around ?? ''}
            onChange={(e) => onCas(e.target.value || null)}
            className="-my-2 cursor-pointer border-0 border-b border-hairline bg-transparent py-2 font-sans text-base font-semibold tabular-nums"
            style={around ? { color: 'var(--season)' } : undefined}
          >
            <option value="">{t('around_prompt')}</option>
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
      {/* Ohlasy poutníků — its own bordered block, collapsed by default (native
          <details> disclosure). Roomy pills so it doesn't read as cramped.
          Gated: the whole witness filter is absent in the public build. */}
      {WITNESS_ENABLED && (
      <details className="group mt-4 border-t border-hairline pt-3">
        <summary className="rubric cursor-pointer list-none text-ink-faded marker:hidden">
          {t('fb_filter_group')}
          {filters.witnessTags.length > 0 && ` · ${filters.witnessTags.length}`}
          <span className="ml-1 inline-block text-ink-faded transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        <p className="mt-2 text-xs text-ink-faded">{t('fb_filter_hint')}</p>
        <div
          role="group"
          aria-label={t('fb_filter_group')}
          className="mt-2 flex flex-wrap gap-2 pb-1"
        >
          {WITNESS_CHIPS.map((c) => {
            const active = filters.witnessTags.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                style={active ? { borderColor: 'var(--season)', backgroundColor: 'color-mix(in srgb, var(--season) 10%, transparent)' } : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active ? 'text-ink' : 'border-hairline text-ink-faded hover:text-ink'
                }`}
                onClick={() =>
                  onChange({
                    ...filters,
                    witnessTags: active
                      ? filters.witnessTags.filter((x) => x !== c.id)
                      : [...filters.witnessTags, c.id],
                  })
                }
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </details>
      )}
      {narrow && (
        <button
          type="button"
          className="rubric mt-4 min-h-11 w-full border-t border-hairline pt-3 pb-1 text-center"
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

function DetailRoute({
  id,
  index,
  onBack,
  onHelp,
  onHeroChange,
}: {
  id: string
  index: Church[]
  onBack: () => void
  onHelp: () => void
  onHeroChange: (hasHero: boolean) => void
}) {
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
  return <ChurchDetail church={church} onBack={onBack} onHelp={onHelp} onHeroChange={onHeroChange} />
}

// Map view of the hero list: Leaflet + OSM tiles muted into the warm paper
// palette. Booking-style markers — the time IS the marker: a church whose next
// service matches the current context (day + kdy + filters, the same
// selectUpcoming the seznam uses) gets a typographic time chip in the season
// accent; everything else is a small faded dot (still tappable). Clusters
// carry the count, accented when they contain a match. Loaded lazily
// (React.lazy) — the list path never pays for Leaflet.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './mapview.css'
import type { Church, ChurchServices } from './domain/data'
import { decodeShard } from './domain/data'
import { loadData } from './lib/dataStore'
import { gridCluster } from './domain/cluster'
import { NO_FILTERS, type Filters } from './domain/filters'
import { selectUpcoming, type DayChoice, type Upcoming } from './domain/ranking'
import { dayLabel, fmtTime, fmtWeekdayShort, samePragueDay } from './domain/format'
import { massKey, type Aggregate } from './domain/feedback'
import { aggregateFor, churchHasTags, divergentChips, loadAggregates, rankChurchTags } from './lib/feedbackStore'
import { witnessPillsHtml } from './WitnessPills'
import { t, churchCount, confirmedByPilgrims } from './i18n'

const CELL_PX = 64 // cluster grid; ~a finger-width of map

/** "8:30", not "08:30" — chips are read at a glance, the zero is noise. */
const chipTime = (d: Date) => fmtTime(d).replace(/^0/, '')

/** Both directness tiers for the Mass a marker/popover shows: the specific slot
 * aggregate and the church-wide one (from the in-memory cache; empty until
 * loadAggregates fills it). */
const witnessTiers = (church: Church, u: Upcoming): { slot?: Aggregate; church: Aggregate } => {
  const { slots, church: churchAgg } = aggregateFor(church.id)
  return { slot: slots.get(massKey(church.id, u.service, u.start)), church: churchAgg }
}
const hasWitness = (t: { slot?: Aggregate; church: Aggregate }): boolean =>
  (t.slot?.chips.length ?? 0) > 0 || t.church.chips.length > 0

/** A bare time on a pin reads as TODAY — on "hned" a church's next mass can be
 * days out, so a not-today chip carries its weekday ("út 15:00") and greys. */
const chipIcon = (label: string, otherDay: boolean, witnessed: boolean) =>
  L.divIcon({
    className: 'map-chip-wrap',
    // witnessed: a rubric "dog-ear" folded corner on the chip (a CSS ::after on
    // .map-chip--witnessed) — clearly part of the box, not a floating mark that
    // invites a tap. Presence only; the popover carries the testimony.
    html: `<span class="map-chip${otherDay ? ' map-chip--otherday' : ''}${witnessed ? ' map-chip--witnessed' : ''}">${label}</span>`,
    iconSize: [30, 30], // tap target; the chip centers itself and may overflow
  })
// non-matching: a tiny faded dot; the 30px wrapper keeps it tappable
const fadedIcon = () =>
  L.divIcon({
    className: 'map-marker',
    html: '<span class="map-dot map-dot--faded"></span>',
    iconSize: [30, 30],
  })
const clusterIcon = (count: number, hasMatch: boolean) =>
  L.divIcon({
    className: hasMatch ? 'map-cluster' : 'map-cluster map-cluster--faded',
    html: String(count),
    iconSize: [30, 30],
  })
const originIcon = () =>
  L.divIcon({ className: 'map-origin-wrap', html: '<span class="map-origin"></span>', iconSize: [30, 30] })

export default function MapView({
  origin,
  churches,
  filters,
  cas,
  day,
  onOpen,
  onNavigate,
  fill = false,
}: {
  origin: { lat: number; lng: number }
  churches: Church[] // the whole index — matching is the selector's job
  filters: Filters
  cas: string | null
  day: DayChoice
  onOpen: (id: string) => void
  onNavigate: (t: { name: string; lat: number; lng: number }) => void
  /** Map mode: fill the parent column instead of the in-flow plate height. */
  fill?: boolean
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  // Callbacks read through refs so the marker effect does NOT depend on their
  // identity. onOpen (App's openChurch) is a fresh closure every App render; had
  // it stayed in the effect deps, every unrelated App re-render tore down and
  // re-ran render() off the moveend cycle — recreating a marker node mid-settle,
  // which on iOS showed as a single chip "travelling". Refs keep the latest
  // callback without re-subscribing.
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate
  const shardCache = useRef(new Map<string, Promise<Map<string, ChurchServices>>>())

  const loadShard = (cell: string) => {
    let p = shardCache.current.get(cell)
    if (!p) {
      // via dataStore, not raw fetch — the map must see an OTA-refreshed registry too
      p = loadData<Parameters<typeof decodeShard>[0]>(`services/${cell}.json`)
        .catch(() => ({}))
        .then(decodeShard)
      shardCache.current.set(cell, p)
    }
    return p
  }

  // the map itself: created once, centered on the origin
  useEffect(() => {
    const map = L.map(divRef.current!, { zoomControl: true }).setView([origin.lat, origin.lng], 13)
    // default prefix carries an emoji flag — design brief: no emoji. Append the
    // build stamp so any screenshot says which TestFlight build it is (this bug
    // went several rounds partly from build-version confusion).
    const buildTag = import.meta.env.VITE_BUILD ? ` · b${import.meta.env.VITE_BUILD}` : ''
    map.attributionControl.setPrefix(`<a href="https://leafletjs.com">Leaflet</a>${buildTag}`)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    L.marker([origin.lat, origin.lng], {
      icon: originIcon(),
      keyboard: false,
      interactive: false,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new origin remounts via key
  }, [])

  // markers: viewport-filtered, grid-clustered, context-aware via selectUpcoming
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    let stale = false
    // Render is async (awaits shard loads) and fires on every moveend. Without
    // a generation guard, rapid pans start overlapping renders and whichever's
    // shard-load resolves LAST wins — often a stale viewport, repainting markers
    // at old positions (the "dancing" chips). Only the newest render may apply.
    let renderSeq = 0

    const openPopover = async (church: Church) => {
      const svc = (await loadShard(church.cell)).get(church.id)
      if (stale) return
      const now = new Date()
      const byId = new Map(svc ? [[church.id, svc]] : [])
      const next = selectUpcoming(now, origin, [church], byId, filters, cas, day, { limit: 1 })[0]
      const el = document.createElement('div')
      const name = document.createElement('p')
      name.className = 'map-pop-name'
      name.textContent = church.name
      const line = document.createElement('p')
      line.className = 'map-pop-line'
      const when = (u: Upcoming) =>
        `${dayLabel(now, u.start)} ${t('map_at')} ${fmtTime(u.start)}${u.service.type ? ` · ${u.service.type}` : ''}`
      if (next) {
        line.textContent = when(next)
      } else {
        // honesty: nothing for the active selection — lead with that, then the
        // church's real next service (no filters, whenever it is)
        const fallback = selectUpcoming(now, origin, [church], byId, NO_FILTERS, null, 'now', {
          limit: 1,
        })[0]
        if (fallback) {
          const miss = document.createElement('span')
          miss.className = 'map-pop-miss'
          miss.textContent = t('map_no_match')
          line.append(miss, `${t('map_nearest_prefix')}${when(fallback)}`)
        } else {
          line.textContent = t('map_none_soon')
        }
      }
      // church-level-first witness (docs/PILGRIM-WITNESS-PLAN.md, no stars): the
      // church's top-3 distinctive tags as read-only pills + the aggregate count,
      // then — only when the shown Mass diverges — that Mass's own note.
      const churchTags = rankChurchTags(church.id)
      if (churchTags.length > 0) {
        const { slots, church: churchAgg } = aggregateFor(church.id)
        const slot = next ? slots.get(massKey(church.id, next.service, next.start)) : undefined
        const divergent = divergentChips(slot, churchTags.map((c) => c.id))
        const witness = document.createElement('div')
        witness.className = 'map-pop-witness'
        const label = document.createElement('p')
        label.className = 'map-pop-witness-label'
        label.textContent = `${t('fb_church_often')}:`
        const pills = document.createElement('p')
        pills.className = 'witness-pills'
        pills.innerHTML = witnessPillsHtml(churchTags)
        const count = document.createElement('p')
        count.className = 'map-pop-witness-count'
        count.textContent = confirmedByPilgrims(churchAgg.witnesses)
        witness.append(label, pills, count)
        if (divergent.length > 0) {
          const dLabel = document.createElement('p')
          dLabel.className = 'map-pop-witness-label'
          dLabel.textContent = `${t('fb_mass_diverges')}:`
          const dPills = document.createElement('p')
          dPills.className = 'witness-pills'
          dPills.innerHTML = witnessPillsHtml(divergent)
          witness.append(dLabel, dPills)
        }
        el.append(name, line, witness)
      } else {
        el.append(name, line)
      }

      // the popover's verbs mirror a list row: detail · trasa · web — each
      // carries the church name in aria-label, same as the list row's verbs,
      // so a screen reader doesn't just hear "otevřít" with no context
      const actions = document.createElement('p')
      actions.className = 'map-pop-actions'
      const open = document.createElement('a')
      open.className = 'map-pop-open'
      open.href = `/kostel/${church.id}/`
      open.textContent = t('map_open')
      open.setAttribute('aria-label', `${t('map_open').replace(/\s*›\s*$/, '')}: ${church.name}`)
      open.addEventListener('click', (e) => {
        e.preventDefault()
        onOpenRef.current(church.id)
      })
      const nav = document.createElement('button')
      nav.type = 'button'
      nav.className = 'map-pop-open'
      nav.textContent = t('row_route')
      nav.setAttribute('aria-label', `${t('row_route')}: ${church.name}`)
      nav.addEventListener('click', () => {
        map.closePopup()
        onNavigateRef.current({ name: church.name, lat: church.lat, lng: church.lng })
      })
      actions.append(open, nav)
      if (church.www) {
        const www = document.createElement('a')
        www.className = 'map-pop-open'
        www.href = church.www
        www.target = '_blank'
        www.rel = 'noreferrer'
        www.textContent = t('row_web')
        www.setAttribute('aria-label', `${t('row_web')}: ${church.name}`)
        actions.append(www)
      }
      el.append(actions)
      L.popup({ maxWidth: 260, closeButton: false })
        .setLatLng([church.lat, church.lng])
        .setContent(el)
        .openOn(map)
    }

    const render = async () => {
      const seq = ++renderSeq
      const zoom = Math.round(map.getZoom()) // snap any transient fractional zoom so clustering can't jitter
      const bounds = map.getBounds().pad(0.3)
      const visible = churches.filter((c) => bounds.contains([c.lat, c.lng]))
      // the chips need each church's next matching service → shards for the view
      const cells = [...new Set(visible.map((c) => c.cell))]
      // Prefetch witness aggregates for the visible churches alongside the
      // shards, so the popover line and the marker cue have data on first paint.
      const [shards] = await Promise.all([
        Promise.all(cells.map(loadShard)),
        loadAggregates(visible.map((c) => c.id)),
      ])
      if (stale || seq !== renderSeq) return // a newer render superseded this one
      const byId = new Map<string, ChurchServices>()
      for (const shard of shards) for (const [id, s] of shard) byId.set(id, s)
      const now = new Date()
      // the SAME selector as the seznam — a chip on the map is a row in the list
      const matched = new Map<string, Upcoming>()
      for (const u of selectUpcoming(now, origin, visible, byId, filters, cas, day, { limit: Infinity })) {
        if (!matched.has(u.church.id)) matched.set(u.church.id, u) // ordo: keep the day's earliest
      }
      // Witness filter (Ohlasy poutníků): when tags are selected, the map shows
      // only churches carrying ALL of them at slot- or church-tier. Aggregates
      // are loaded for the visible set above, so we cluster over that filtered
      // subset (the pan-invariant whole-index clustering resumes when off).
      const wt = filters.witnessTags ?? []
      const clusterChurches = wt.length
        ? visible.filter((c) => churchHasTags(c.id, null, wt))
        : churches
      // Cluster over ALL churches, not just the viewport subset. Bucket
      // membership must not depend on the pan: a grid cell straddling the
      // viewport edge used to gain/lose members every moveend, so its centroid
      // (and the single-chip-vs-count-circle decision) recomputed and the chips
      // visibly drifted. Buckets key on absolute world-pixel coords at this
      // zoom — pan-invariant — so clusters are decided once; we only RENDER the
      // markers that fall on screen.
      const pts = clusterChurches.map((c) => {
        const p = map.project([c.lat, c.lng], zoom)
        return { x: p.x, y: p.y, item: c }
      })
      // Rebuild the on-screen markers FRESH each render. An earlier "fix" kept
      // and reused marker DOM nodes across pans to avoid a repaint; that reuse is
      // what made a single chip travel on iOS — an off-cycle render could setIcon
      // (recreating one node) mid-settle, and WKWebView committed a reused,
      // GPU-composited node a frame after the tile pane. Fresh nodes rebuilt
      // together in one synchronous pass have neither failure mode, and at a few
      // dozen on-screen markers the cost is nil. (moveend fires once per pan, and
      // the effect no longer re-runs on every App render — see the callback refs.)
      layer.clearLayers()
      for (const cl of gridCluster(pts, CELL_PX)) {
        if (cl.items.length === 1) {
          const church = cl.items[0]
          if (!bounds.contains([church.lat, church.lng])) continue
          const next = matched.get(church.id)
          // ordo days (dnes/neděle/…) put every chip on the chosen day — the
          // prefix would be noise there; only "hned" can surprise with a
          // different day, so only "hned" gets the weekday + grey treatment
          const otherDay = Boolean(next) && day === 'now' && !samePragueDay(next!.start, now)
          const label = next
            ? otherDay
              ? `${fmtWeekdayShort(next.start)} ${chipTime(next.start)}`
              : chipTime(next.start)
            : ''
          const witnessed = Boolean(next) && hasWitness(witnessTiers(church, next!))
          const marker = L.marker([church.lat, church.lng], {
            icon: next ? chipIcon(label, otherDay, witnessed) : fadedIcon(),
            title: church.name,
            keyboard: false,
          })
            .on('click', () => void openPopover(church))
            .addTo(layer)
          // title alone isn't a reliable accessible name on a non-interactive div
          marker.getElement()?.setAttribute('aria-label', church.name)
        } else {
          const latlng = map.unproject(L.point(cl.x, cl.y), zoom)
          if (!bounds.contains(latlng)) continue
          const hasMatch = cl.items.some((c) => matched.has(c.id))
          L.marker(latlng, {
            icon: clusterIcon(cl.items.length, hasMatch),
            title: churchCount(cl.items.length),
            keyboard: false,
          })
            .on('click', () => map.setView(latlng, Math.min(zoom + 2, 17)))
            .addTo(layer)
        }
      }
    }

    map.on('moveend', render) // zoom changes end in moveend too
    void render()
    return () => {
      stale = true
      map.off('moveend', render)
    }
    // onOpen/onNavigate deliberately excluded — read via refs so an unstable
    // callback identity can't re-run this effect off the moveend cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churches, filters, cas, day, origin])

  return (
    <div
      ref={divRef}
      data-testid="mapa"
      role="region"
      aria-label={t('map_aria')}
      className={
        fill
          ? 'ordo-map ordo-map--fill w-full border-t border-hairline'
          : 'ordo-map mt-4 w-full border border-hairline'
      }
    />
  )
}

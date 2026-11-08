// Map view of the hero list: Leaflet + OSM tiles muted into the warm paper
// palette. Booking-style markers — the time IS the marker: a church whose next
// service matches the current context (day + kdy + filters, the same
// selectUpcoming the seznam uses) gets a typographic time chip in the season
// accent; everything else is a small faded dot (still tappable). Clusters
// carry the count, accented when they contain a match. Loaded lazily
// (React.lazy) — the list path never pays for Leaflet.
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './mapview.css'
import type { Church, ChurchServices } from './domain/data'
import { decodeShard } from './domain/data'
import { loadShard as readShard } from './lib/dataStore'
import { gridCluster } from './domain/cluster'
import { clusterCellPx, GROUP_MAX_ZOOM, pickGroupChip } from './domain/mapGroup'
import { isMass, NO_FILTERS, serviceMatches, type Filters } from './domain/filters'
import { dayLine, selectUpcoming, type DayChoice, type Upcoming } from './domain/ranking'
import { clearReopen, recallView, rememberView } from './lib/mapMemory'
import { pragueDay } from './domain/occurrences'
import { dayLabel, fmtTime, fmtWeekdayShort, samePragueDay } from './domain/format'
import { massKey, type Aggregate } from './domain/feedback'
import { aggregateFor, churchHasTags, divergentChips, hasAggregate, loadAggregates, rankChurchTags } from './lib/feedbackStore'
import { witnessPillsHtml } from './WitnessPills'
import { WITNESS_ENABLED } from './lib/flags'
import { t, churchCount, confirmedByPilgrims, langLabel } from './i18n'

/** Popover timetable rows; a longer day ends in "+N další ›" to the church page. */
const POP_ROWS = 4

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
const chipIcon = (label: string, more: number, otherDay: boolean, witnessed: boolean, nonMass: boolean) =>
  L.divIcon({
    className: 'map-chip-wrap',
    // witnessed: a rubric "dog-ear" folded corner on the chip (a CSS ::after on
    // .map-chip--witnessed) — clearly part of the box, not a floating mark that
    // invites a tap. Presence only; the popover carries the testimony.
    // nonMass (růženec, adorace, nešpory…): an OUTLINED chip — paper ground,
    // season rule — so a time that isn't a Mass never reads as one.
    html: `<span class="map-chip${otherDay ? ' map-chip--otherday' : ''}${nonMass ? ' map-chip--nonmass' : ''}${witnessed ? ' map-chip--witnessed' : ''}">${label}${more ? `<span class="map-chip-more">+${more}</span>` : ''}</span>`,
    iconSize: [30, 30], // tap target; the chip centers itself and may overflow
  })
// non-matching: a tiny faded dot; the 30px wrapper keeps it tappable
const fadedIcon = () =>
  L.divIcon({
    className: 'map-marker',
    html: '<span class="map-dot map-dot--faded"></span>',
    iconSize: [30, 30],
  })
/** Several churches at one spot: the chip of the best of them (domain/mapGroup),
 * drawn as a small stack with a round church-count badge, so it never reads like
 * the "+N" superscript (more Masses in ONE church). */
const groupIcon = (label: string, count: number, otherDay: boolean, nonMass: boolean) =>
  L.divIcon({
    className: 'map-chip-wrap',
    html:
      `<span class="map-stack${otherDay ? ' map-stack--otherday' : ''}${nonMass ? ' map-stack--nonmass' : ''}">` +
      '<span class="map-stack-back" aria-hidden="true"></span>' +
      `<span class="map-chip${otherDay ? ' map-chip--otherday' : ''}${nonMass ? ' map-chip--nonmass' : ''}">${label}</span>` +
      `<span class="map-stack-count">${count}</span></span>`,
    iconSize: [30, 30],
  })
/** Draw order on overlap: what matches now over grey "another day", grey over
 * faded dots — a grey stack hid a gold one at zoom 13 (review shots, 2026-11-01). */
const tierZ = (chip: { otherDay: boolean } | undefined) => (chip ? (chip.otherDay ? 0 : 1000) : -1000)
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
  now,
  hideOtherDay = false,
  onToggleOtherDay,
}: {
  origin: { lat: number; lng: number }
  churches: Church[] // the whole index — matching is the selector's job
  filters: Filters
  cas: string | null
  day: DayChoice
  onOpen: (id: string, at?: Date) => void
  onNavigate: (t: { name: string; lat: number; lng: number }) => void
  /** Map mode: fill the parent column instead of the in-flow plate height. */
  fill?: boolean
  /** App's clock (minute tick + resume refresh) — chips re-render on it, not only on pan. */
  now: Date
  /** Legend toggle: hide grey "another day" chips (and groups that only have those). */
  hideOtherDay?: boolean
  onToggleOtherDay?: () => void
}) {
  const divRef = useRef<HTMLDivElement>(null)
  // The dog-ear fold cue on a chip reads as "something's here" but its meaning
  // isn't self-evident — show a discreet key (a matching fold swatch) under the
  // map ONLY while witnessed chips are actually on screen, so it stays low-clutter.
  const [witnessShown, setWitnessShown] = useState(false)
  const [nonMassShown, setNonMassShown] = useState(false)
  const [otherDayShown, setOtherDayShown] = useState(false)
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
  // App's clock, read through a ref for the same reason: a minute tick must not
  // re-run the marker effect. The tick effect below asks for a guarded render
  // instead — skipped mid-gesture, applied only when some chip would change.
  const nowRef = useRef(now)
  nowRef.current = now
  const tickRef = useRef(() => {})
  const shardCache = useRef(new Map<string, Promise<Map<string, ChurchServices>>>())
  // A new index means an OTA refresh landed: drop shards cached from the old
  // snapshot (declared before the marker effect, so it clears first).
  useEffect(() => {
    shardCache.current.clear()
  }, [churches])

  const loadShard = (cell: string) => {
    let p = shardCache.current.get(cell)
    if (!p) {
      // via dataStore, not raw fetch — the map must see an OTA-refreshed registry too
      p = readShard(cell)
        .then(decodeShard)
        .catch(() => {
          // Remove from cache so the next map open can retry the fetch.
          shardCache.current.delete(cell)
          return new Map<string, ChurchServices>()
        })
      shardCache.current.set(cell, p)
    }
    return p
  }

  // the map itself: created once, centered on the origin — or, back from a
  // church page (or the seznam), on the view you left (lib/mapMemory)
  useEffect(() => {
    const saved = recallView(origin)
    // zoomSnap: 0 — a pinch rests at the exact fractional zoom the fingers leave.
    // Leaflet's default (zoomSnap: 1) snaps a fractional pinch to the nearest whole
    // zoom on finger-lift, which reads as a "jump" (zooms in, then settles out ~0.3
    // level on release — owner report, build 70). Clustering is unaffected: render()
    // already buckets at Math.round(map.getZoom()), so a fractional rest still
    // clusters deterministically. Tiles are CSS-scaled (slightly soft) at a
    // fractional rest, muted by the paper/sepia tile filter.
    const map = L.map(divRef.current!, { zoomControl: true, zoomSnap: 0 }).setView(
      saved ? saved.center : [origin.lat, origin.lng],
      saved ? saved.zoom : 13,
    )
    map.on('moveend', () => {
      const c = map.getCenter()
      rememberView(origin, [c.lat, c.lng], map.getZoom())
    })
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
      // above the chips: a stack drawn over "you are here" hid it (e2e map-mixed-375)
      zIndexOffset: 10000,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    // test hook (guarded by ?diag): lets the zoomSnap regression e2e assert the
    // map rests at a fractional zoom instead of snapping. Never active in the app.
    if (typeof window !== 'undefined' && window.location.search.includes('diag')) {
      ;(window as unknown as { __map?: L.Map }).__map = map
    }
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
    // A gesture (pan/pinch/zoom) runs from movestart to moveend; a tick landing
    // inside it is dropped — the closing moveend renders with the fresh clock.
    let moving = false
    let lastSig = ''

    const openPopover = async (church: Church) => {
      const svc = (await loadShard(church.cell)).get(church.id)
      if (stale) return
      const now = nowRef.current // the clock the chip was drawn with
      const byId = new Map(svc ? [[church.id, svc]] : [])
      const next = selectUpcoming(now, origin, [church], byId, filters, cas, day, { limit: 1 })[0]
      // honesty: nothing for the active selection — lead with that, then the
      // church's real next service (no filters, whenever it is)
      const focus =
        next ?? selectUpcoming(now, origin, [church], byId, NO_FILTERS, null, 'now', { limit: 1 })[0]
      // back from the church page, land here with this popover open (mapMemory)
      const keepPlace = () => {
        const c = map.getCenter()
        rememberView(origin, [c.lat, c.lng], map.getZoom(), church.id)
      }
      const el = document.createElement('div')
      const name = document.createElement('p')
      name.className = 'map-pop-name'
      name.textContent = church.name
      const line = document.createElement('p')
      line.className = 'map-pop-line'
      el.append(name, line)
      if (!focus || !svc) {
        line.textContent = t('map_none_soon')
      } else {
        if (!next) {
          const miss = document.createElement('span')
          miss.className = 'map-pop-miss'
          miss.textContent = t('map_no_match')
          line.append(miss, t('map_nearest_prefix'))
        }
        line.append(dayLabel(now, focus.start))
        // the church's whole day, not only its next service (friends' feedback,
        // 2026-10-21): one row per service, the shown one marked, the ones the
        // filters exclude dimmed rather than hidden. A long day caps at
        // POP_ROWS around the marked one and links on to the church page.
        const all = dayLine(now, church, svc, focus.start)
        const at = Math.max(
          0,
          all.findIndex((u) => u.start.getTime() === focus.start.getTime() && u.service === focus.service),
        )
        const from = Math.max(0, Math.min(at - 1, all.length - POP_ROWS))
        const matches = serviceMatches(filters, cas)
        const ordo = document.createElement('ul')
        ordo.className = 'map-pop-ordo'
        all.slice(from, from + POP_ROWS).forEach((u, i) => {
          const row = document.createElement('li')
          row.className =
            'map-pop-row' +
            (from + i === at ? ' map-pop-row--next' : '') +
            (next && matches(u.service) ? '' : ' map-pop-row--off')
          const time = document.createElement('span')
          time.className = 'map-pop-time'
          time.textContent = fmtTime(u.start)
          const what = document.createElement('span')
          const s = u.service
          what.textContent =
            (s.type || t('service_fallback')) +
            (s.lang && s.lang !== 'česky' ? ` · ${langLabel(s.lang)}` : '') +
            (s.greek ? ` · ${t('greek_chip')}` : '')
          row.append(time, what)
          ordo.append(row)
        })
        el.append(ordo)
        // the shown day isn't today, yet the church still has services today
        // that the choice leaves out (Týn: 21:00 vs kolem 16:00 — Pavol,
        // 2026-11-01): say so, or the jump to Friday reads as a missing Mass
        if (day === 'now' && next && !samePragueDay(next.start, now)) {
          const later = selectUpcoming(now, origin, [church], byId, NO_FILTERS, null, 0, { limit: Infinity })
            .filter((u) => u.start.getTime() > now.getTime() && samePragueDay(u.start, now))
          if (later.length) {
            const today = document.createElement('p')
            today.className = 'map-pop-today'
            // "Dnes ještě: 21:00 (mimo zvolený čas)" — Pavol, 2026-11-01: "dnes 21:00
            // mimo kolem 16:00" read as a puzzle; the filter row already names the choice
            today.textContent = `${t('map_today_still')}: ${later
              .slice(0, 3)
              // not a Mass → say what it is (Salvátor's Thursday adoration — Pavol, 2026-11-05)
              .map((u) => fmtTime(u.start) + (isMass(u.service.type) ? '' : ` ${u.service.type.trim()}`))
              .join(', ')} (${t(cas ? 'map_outside_time' : 'map_outside_choice')})`
            el.append(today)
          }
        }
        if (all.length > POP_ROWS) {
          const more = document.createElement('button')
          more.type = 'button'
          more.className = 'map-pop-more'
          more.textContent = `+${all.length - POP_ROWS} ${t('map_more')} ›`
          more.setAttribute('aria-label', `${t('map_more')}: ${church.name}`)
          more.addEventListener('click', () => {
            keepPlace()
            onOpenRef.current(church.id, focus.start)
          })
          el.append(more)
        }
      }
      // church-level-first witness (docs/PILGRIM-WITNESS-PLAN.md, no stars): the
      // church's top-3 distinctive tags as read-only pills + the aggregate count,
      // then — only when the shown Mass diverges — that Mass's own note.
      const churchTags = WITNESS_ENABLED ? rankChurchTags(church.id) : []
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
        el.append(witness)
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
        keepPlace()
        onOpenRef.current(church.id, next?.start)
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

    // A group that can't split further (same building, or the deepest zoom):
    // list its churches, each with the time its own chip would show; a row
    // opens that church's usual popover.
    const openGroupPopover = (
      items: Church[],
      latlng: L.LatLng,
      chips: ({ label: string; otherDay: boolean } | undefined)[],
    ) => {
      const el = document.createElement('div')
      const head = document.createElement('p')
      head.className = 'map-pop-line'
      head.textContent = churchCount(items.length)
      const list = document.createElement('ul')
      list.className = 'map-pop-ordo'
      items.forEach((church, i) => {
        const row = document.createElement('li')
        row.className = 'map-pop-row' + (chips[i] && !chips[i]!.otherDay ? '' : ' map-pop-row--off')
        const time = document.createElement('span')
        time.className = 'map-pop-time'
        time.textContent = chips[i]?.label ?? '—'
        const name = document.createElement('button')
        name.type = 'button'
        name.className = 'map-pop-group-name'
        name.textContent = church.name
        name.addEventListener('click', () => void openPopover(church))
        row.append(time, name)
        list.append(row)
      })
      el.append(head, list)
      L.popup({ maxWidth: 280, closeButton: false }).setLatLng(latlng).setContent(el).openOn(map)
    }

    const render = async (fromTick = false) => {
      if (fromTick && moving) return
      const now = nowRef.current
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
        WITNESS_ENABLED ? loadAggregates(visible.map((c) => c.id)) : Promise.resolve(),
      ])
      if (stale || seq !== renderSeq) return // a newer render superseded this one
      if (fromTick && moving) return // a gesture began while shards loaded
      const byId = new Map<string, ChurchServices>()
      for (const shard of shards) for (const [id, s] of shard) byId.set(id, s)
      // the SAME selector as the seznam — a chip on the map is a row in the list
      const matched = new Map<string, Upcoming>()
      for (const u of selectUpcoming(now, origin, visible, byId, filters, cas, day, { limit: Infinity })) {
        if (!matched.has(u.church.id)) matched.set(u.church.id, u) // ordo: keep the day's earliest
      }
      // Witness filter (Ohlasy poutníků): when tags are selected, the map shows
      // only churches carrying ALL of them at slot- or church-tier. Aggregates
      // are loaded for the visible set above, so we cluster over that filtered
      // subset (the pan-invariant whole-index clustering resumes when off).
      // M8: cluster ONLY over churches whose aggregates have been loaded so
      // cluster membership is pan-invariant. A failed aggregate load shows
      // nothing for the unloaded ones (as before), not thousands of markers.
      const wt = WITNESS_ENABLED ? (filters.witnessTags ?? []) : []
      const clusterChurches = wt.length
        ? churches.filter((c) => hasAggregate(c.id) && churchHasTags(c.id, null, wt))
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
      // Plan first, then apply: a tick-driven render whose plan matches the last
      // one leaves the marker nodes alone.
      const sig: string[] = []
      const adds: (() => void)[] = []
      let anyWitness = false
      let anyNonMass = false
      let anyOtherDay = false
      // grey chips exist only on "hned"; on an ordo day the toggle means nothing
      const hide = hideOtherDay && day === 'now'
      // A church's chip: its next matching service as the seznam would show it
      const chipFor = (church: Church) => {
        const next = matched.get(church.id)
        if (!next) return undefined
        // ordo days (dnes/neděle/…) put every chip on the chosen day — the
        // prefix would be noise there; only "hned" can surprise with a
        // different day, so only "hned" gets the weekday + grey treatment
        const otherDay = day === 'now' && !samePragueDay(next.start, now)
        if (otherDay) anyOtherDay = true
        if (otherDay && hide) return undefined
        const label = otherDay ? `${fmtWeekdayShort(next.start)} ${chipTime(next.start)}` : chipTime(next.start)
        return { next, start: next.start, otherDay, nonMass: !isMass(next.service.type), label }
      }
      for (const cl of gridCluster(pts, clusterCellPx(zoom))) {
        if (cl.items.length === 1) {
          const church = cl.items[0]
          if (!bounds.contains([church.lat, church.lng])) continue
          const chip = chipFor(church)
          // the legend toggle hides what doesn't match now, faded dots included
          if (!chip && hide) continue
          const next = chip?.next
          const label = chip?.label ?? ''
          const otherDay = chip?.otherDay ?? false
          // "7:30⁺²": further services that day the same filters let through
          // (Pavol, 2026-10-25 — the 9:00 and 11:00 hid behind a tap)
          // ponytail: pass a single-entry byId so applyFilters is O(1) not O(viewport)
          const churchById = byId.has(church.id) ? new Map([[church.id, byId.get(church.id)!]]) : new Map<string, ChurchServices>()
          const more = next
            ? selectUpcoming(now, origin, [church], churchById, filters, cas,
                Math.round((pragueDay(next.start).getTime() - pragueDay(now).getTime()) / 86_400_000),
              ).filter((u) => u.start.getTime() > next.start.getTime()).length
            : 0
          const witnessed = WITNESS_ENABLED && Boolean(next) && hasWitness(witnessTiers(church, next!))
          if (witnessed) anyWitness = true
          const nonMass = chip?.nonMass ?? false
          if (nonMass) anyNonMass = true
          sig.push(`${church.id}:${next ? `${label}|${more}|${otherDay}|${witnessed}|${nonMass}` : ''}`)
          adds.push(() => {
            const marker = L.marker([church.lat, church.lng], {
              icon: next ? chipIcon(label, more, otherDay, witnessed, nonMass) : fadedIcon(),
              title: church.name,
              keyboard: false,
              zIndexOffset: tierZ(chip),
            })
              .on('click', () => void openPopover(church))
              .addTo(layer)
            // title alone isn't a reliable accessible name on a non-interactive div
            marker.getElement()?.setAttribute('aria-label', church.name)
          })
        } else {
          const latlng = map.unproject(L.point(cl.x, cl.y), zoom)
          if (!bounds.contains(latlng)) continue
          const all = cl.items.map(chipFor)
          // with the toggle on, the group is only the churches it still shows:
          // the badge counts them and the deepest-zoom list names only them
          const members = hide ? cl.items.filter((_, i) => all[i]) : cl.items
          const chips = hide ? all.filter(Boolean) : all
          const pick = pickGroupChip(chips, cas)
          if (pick.kind === 'none' && hide) continue
          const chip = pick.kind === 'chip' ? chips[pick.index]! : undefined
          if (chip?.nonMass) anyNonMass = true
          const n = members.length
          // every member's chip is in the signature: the list popover reads them,
          // so a tick that changes a non-picked member must repaint too
          sig.push(`${cl.x},${cl.y}:${n}|${chip?.label ?? ''}|${chips.map((c) => (c ? `${c.label}/${c.otherDay}/${c.nonMass}` : '-')).join(',')}`)
          adds.push(() => {
            // a group the toggle thinned to one church is that church's own chip, at its place
            const one = n === 1 ? members[0] : undefined
            const marker = L.marker(one ? L.latLng(one.lat, one.lng) : latlng, {
              // a group with no match draws as the faded dot its churches become
              // on zoom — a grey "3" that dissolved into dots read as "they
              // disappear" (řeckokatolické in Brno, 2026-10-25)
              icon: chip
                ? n === 1
                  ? chipIcon(chip.label, 0, chip.otherDay, false, chip.nonMass)
                  : groupIcon(chip.label, n, chip.otherDay, chip.nonMass)
                : fadedIcon(),
              title: one ? one.name : churchCount(n),
              keyboard: false,
              zIndexOffset: tierZ(chip),
            })
              .on('click', () =>
                one
                  ? void openPopover(one)
                  : zoom >= GROUP_MAX_ZOOM
                  ? openGroupPopover(members, latlng, chips)
                  : map.setView(latlng, Math.min(zoom + 2, GROUP_MAX_ZOOM)),
              )
              .addTo(layer)
            marker.getElement()?.setAttribute('aria-label', one ? one.name : chip ? `${churchCount(n)}, ${chip.label}` : churchCount(n))
          })
        }
      }
      // legend state first: it must follow the clock even when no marker changes
      setNonMassShown(anyNonMass)
      setOtherDayShown(day === 'now' && anyOtherDay)
      const key = sig.join(';')
      if (fromTick && key === lastSig) return
      lastSig = key
      layer.clearLayers()
      for (const add of adds) add()
      setWitnessShown(anyWitness) // React bails out if unchanged — deps exclude it, so no re-subscribe
      // back from a church opened here: reopen its popover once. Cleared only
      // when acted on, so a StrictMode remount or a not-yet-loaded index
      // (churches still []) can't swallow it.
      const back = recallView(origin)?.reopen
      if (back && churches.length) {
        clearReopen()
        const c = churches.find((x) => x.id === back)
        if (c) void openPopover(c)
      }
    }

    const onMoveStart = () => {
      moving = true
    }
    const onMoveEnd = () => {
      moving = false
      void render()
    }
    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd) // zoom changes end in moveend too
    tickRef.current = () => void render(true)
    void render()
    return () => {
      stale = true
      tickRef.current = () => {}
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
    }
    // onOpen/onNavigate deliberately excluded — read via refs so an unstable
    // callback identity can't re-run this effect off the moveend cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churches, filters, cas, day, origin, hideOtherDay])

  // App's minute tick / resume: refresh the chips without tearing the effect down
  useEffect(() => tickRef.current(), [now])

  return (
    <div className={fill ? 'relative h-full' : 'relative'}>
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
      {/* discreet key: season chip (matches the choice) and grey chip (a matching
          Mass on another day); the dog-ear fold row only while a witnessed chip
          is on screen. Low-key floating rows (no card), pointer-events off,
          below the popup pane. */}
      <div className="map-legend">
        <span className="map-legend-row">
          <span className="map-legend-chip" aria-hidden="true" />
          {t('map_legend_match')}
        </span>
        {/* the grey row doubles as the toggle (Pavol, 2026-11-01): it explains the
            grey chips and hides them. Offered only while grey chips can exist. */}
        {onToggleOtherDay && day === 'now' && (otherDayShown || hideOtherDay) ? (
          <button
            type="button"
            className={`map-legend-row map-legend-toggle${hideOtherDay ? ' map-legend-toggle--off' : ''}`}
            aria-pressed={hideOtherDay}
            aria-label={t(hideOtherDay ? 'map_otherday_show' : 'map_otherday_hide')}
            onClick={onToggleOtherDay}
          >
            <span className="map-legend-chip map-legend-chip--otherday" aria-hidden="true" />
            <span className="map-legend-toggle-label">{t('map_legend_otherday')}</span>
            {/* the verb makes the row read as a control (Pavol, 2026-11-01: easy to miss) */}
            <span className="map-legend-toggle-verb">· {t(hideOtherDay ? 'map_otherday_show_short' : 'map_otherday_hide_short')}</span>
          </button>
        ) : (
          <span className="map-legend-row">
            <span className="map-legend-chip map-legend-chip--otherday" aria-hidden="true" />
            {t('map_legend_otherday')}
          </span>
        )}
        {nonMassShown && (
          <span className="map-legend-row">
            <span className="map-legend-chip map-legend-chip--nonmass" aria-hidden="true" />
            {t('map_legend_nonmass')}
          </span>
        )}
        {WITNESS_ENABLED && witnessShown && (
          <span className="map-legend-row">
            <span className="map-legend-fold" aria-hidden="true" />
            {t('fb_map_legend')}
          </span>
        )}
      </div>
    </div>
  )
}

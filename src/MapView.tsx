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
import { gridCluster } from './domain/cluster'
import { NO_FILTERS, type Filters } from './domain/filters'
import { selectUpcoming, type DayChoice, type Upcoming } from './domain/ranking'
import { dayLabel, fmtTime } from './domain/format'

const CELL_PX = 64 // cluster grid; ~a finger-width of map

/** "8:30", not "08:30" — chips are read at a glance, the zero is noise. */
const chipTime = (d: Date) => fmtTime(d).replace(/^0/, '')

const chipIcon = (label: string) =>
  L.divIcon({
    className: 'map-chip-wrap',
    html: `<span class="map-chip">${label}</span>`,
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
}: {
  origin: { lat: number; lng: number }
  churches: Church[] // the whole index — matching is the selector's job
  filters: Filters
  cas: string | null
  day: DayChoice
  onOpen: (id: string) => void
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const shardCache = useRef(new Map<string, Promise<Map<string, ChurchServices>>>())

  const loadShard = (cell: string) => {
    let p = shardCache.current.get(cell)
    if (!p) {
      p = fetch(`/data/services/${cell}.json`)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}))
        .then(decodeShard)
      shardCache.current.set(cell, p)
    }
    return p
  }

  // the map itself: created once, centered on the origin
  useEffect(() => {
    const map = L.map(divRef.current!, { zoomControl: true }).setView([origin.lat, origin.lng], 13)
    // default prefix carries an emoji flag — design brief: no emoji
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
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
        `${dayLabel(now, u.start)} v ${fmtTime(u.start)}${u.service.type ? ` · ${u.service.type}` : ''}`
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
          miss.textContent = 'pro váš výběr nic'
          line.append(miss, ` — nejbližší: ${when(fallback)}`)
        } else {
          line.textContent = 'žádná bohoslužba v nejbližších dnech'
        }
      }
      const open = document.createElement('a')
      open.className = 'map-pop-open'
      open.href = `/kostel/${church.id}/`
      open.textContent = 'otevřít ›'
      open.addEventListener('click', (e) => {
        e.preventDefault()
        onOpen(church.id)
      })
      el.append(name, line, open)
      L.popup({ maxWidth: 260, closeButton: false })
        .setLatLng([church.lat, church.lng])
        .setContent(el)
        .openOn(map)
    }

    const render = async () => {
      const zoom = map.getZoom()
      const bounds = map.getBounds().pad(0.3)
      const visible = churches.filter((c) => bounds.contains([c.lat, c.lng]))
      // the chips need each church's next matching service → shards for the view
      const cells = [...new Set(visible.map((c) => c.cell))]
      const shards = await Promise.all(cells.map(loadShard))
      if (stale) return
      const byId = new Map<string, ChurchServices>()
      for (const shard of shards) for (const [id, s] of shard) byId.set(id, s)
      const now = new Date()
      // the SAME selector as the seznam — a chip on the map is a row in the list
      const matched = new Map<string, Upcoming>()
      for (const u of selectUpcoming(now, origin, visible, byId, filters, cas, day, { limit: Infinity })) {
        if (!matched.has(u.church.id)) matched.set(u.church.id, u) // ordo: keep the day's earliest
      }
      const pts = visible.map((c) => {
        const p = map.project([c.lat, c.lng], zoom)
        return { x: p.x, y: p.y, item: c }
      })
      layer.clearLayers()
      for (const cl of gridCluster(pts, CELL_PX)) {
        if (cl.items.length === 1) {
          const church = cl.items[0]
          const next = matched.get(church.id)
          L.marker([church.lat, church.lng], {
            icon: next ? chipIcon(chipTime(next.start)) : fadedIcon(),
            title: church.name,
            keyboard: false,
          })
            .on('click', () => void openPopover(church))
            .addTo(layer)
        } else {
          const latlng = map.unproject(L.point(cl.x, cl.y), zoom)
          L.marker(latlng, {
            icon: clusterIcon(cl.items.length, cl.items.some((c) => matched.has(c.id))),
            title: `${cl.items.length} kostelů`,
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
  }, [churches, filters, cas, day, origin, onOpen])

  return <div ref={divRef} data-testid="mapa" className="ordo-map mt-4 w-full border border-hairline" />
}

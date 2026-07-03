// Map view of the hero list: Leaflet + OSM tiles muted into the warm paper
// palette, grid-clustered markers in the liturgical season accent, small
// typographic popovers. This module is loaded lazily (React.lazy) — the list
// path never pays for Leaflet.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './mapview.css'
import type { Church, ChurchServices } from './domain/data'
import { decodeShard } from './domain/data'
import { gridCluster } from './domain/cluster'
import { serviceMatches, type Filters } from './domain/filters'
import { ordoForDay, rankUpcoming } from './domain/ranking'
import { pragueToday } from './domain/occurrences'
import { dayLabel, fmtTime } from './domain/format'

export type DayChoice = 'now' | number

const CELL_PX = 64 // cluster grid; ~a finger-width of map

const dotIcon = () =>
  L.divIcon({ className: 'map-marker', html: '<span class="map-dot"></span>', iconSize: [30, 30] })
const clusterIcon = (count: number) =>
  L.divIcon({ className: 'map-cluster', html: String(count), iconSize: [30, 30] })
const originIcon = () =>
  L.divIcon({ className: 'map-origin-wrap', html: '<span class="map-origin"></span>', iconSize: [30, 30] })

/** Does the church have ≥1 service passing the filters (and the selected day)?
 * Static check on the weekly pattern — the popover computes the real next time. */
function hasMatch(
  svc: ChurchServices,
  pred: ReturnType<typeof serviceMatches>,
  day: DayChoice,
  now: Date,
): boolean {
  if (day === 'now') return svc.regular.some(pred) || svc.extra.some(pred)
  const t = pragueToday(now)
  const target = new Date(Date.UTC(t.y, t.m - 1, t.d) + day * 86_400_000)
  const dow = target.getUTCDay() === 0 ? 7 : target.getUTCDay()
  const dateStr = target.toISOString().slice(0, 10)
  return (
    svc.regular.some((s) => pred(s) && s.days.includes(String(dow))) ||
    svc.extra.some((x) => pred(x) && x.date === dateStr)
  )
}

export default function MapView({
  origin,
  churches,
  filters,
  cas,
  day,
  onOpen,
}: {
  origin: { lat: number; lng: number }
  churches: Church[] // barrier-free filtering already applied
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

  // markers: viewport-filtered, grid-clustered, filter/day-aware
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    let stale = false

    const openPopover = async (church: Church) => {
      const svc = (await loadShard(church.cell)).get(church.id)
      if (stale) return
      const now = new Date()
      const pred = serviceMatches(filters, cas)
      const filtered = svc && { ...svc, regular: svc.regular.filter(pred), extra: svc.extra.filter(pred) }
      const byId = new Map(filtered ? [[church.id, filtered]] : [])
      const next =
        day === 'now'
          ? rankUpcoming(now, origin, [church], byId, { limit: 1 })[0]
          : ordoForDay(now, day, origin, [church], byId)[0]
      const el = document.createElement('div')
      const name = document.createElement('p')
      name.className = 'map-pop-name'
      name.textContent = church.name
      const line = document.createElement('p')
      line.className = 'map-pop-line'
      line.textContent = next
        ? `${dayLabel(now, next.start)} v ${fmtTime(next.start)}${next.service.type ? ` · ${next.service.type}` : ''}`
        : 'žádná bohoslužba nevyhovuje výběru'
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
      let visible = churches.filter((c) => bounds.contains([c.lat, c.lng]))
      // service-level filters need the day patterns → load shards for view
      if (filters.lang || filters.greek || filters.massOnly || cas || day !== 'now') {
        const cells = [...new Set(visible.map((c) => c.cell))]
        const shards = await Promise.all(cells.map(loadShard))
        if (stale) return
        const byId = new Map<string, ChurchServices>()
        for (const shard of shards) for (const [id, s] of shard) byId.set(id, s)
        const pred = serviceMatches(filters, cas)
        const now = new Date()
        // a church whose shard failed to load stays visible — don't hide on error
        visible = visible.filter((c) => {
          const svc = byId.get(c.id)
          return !svc || hasMatch(svc, pred, day, now)
        })
      }
      const pts = visible.map((c) => {
        const p = map.project([c.lat, c.lng], zoom)
        return { x: p.x, y: p.y, item: c }
      })
      layer.clearLayers()
      for (const cl of gridCluster(pts, CELL_PX)) {
        if (cl.items.length === 1) {
          const church = cl.items[0]
          L.marker([church.lat, church.lng], {
            icon: dotIcon(),
            title: church.name,
            keyboard: false,
          })
            .on('click', () => void openPopover(church))
            .addTo(layer)
        } else {
          const latlng = map.unproject(L.point(cl.x, cl.y), zoom)
          L.marker(latlng, {
            icon: clusterIcon(cl.items.length),
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

// "Soonest you can make it": for every church, its next upcoming service,
// sorted by start time (ties broken by distance — a mass in 20 minutes 1 km
// away outranks an equally-timed one next door). No walk-only reachability
// filter: assuming everyone is on foot (and that straight-line distance is
// a fair stand-in for an actual walking route) was a stronger assumption
// than the data supports — a car or transit can close a "too far to walk"
// gap in a fraction of the time. The list starts at right now; the
// time-then-distance sort is the reachability heuristic, kept as ranking,
// not as a hard cutoff.

import { haversineKm } from './distance'
import { nextOccurrences, pragueToday } from './occurrences'
import { parseNote } from './notes'
import { applyFilters, type Filters } from './filters'
import type { Church, ChurchServices, Service, ExtraService } from './data'

/** Day-picker choice: 'now' = soonest, time then distance; 0–6 = today + offset's full ordo. */
export type DayChoice = 'now' | number

/** Note-aware occurrence check: skip dates the note provably excludes. */
const runsOn = (service: Service | ExtraService, start: Date): boolean => {
  if (!service.note) return true
  const w = pragueToday(start)
  return parseNote(service.note).runsOn(w.y, w.m, w.d)
}

export interface Upcoming {
  church: Church
  distanceKm: number
  start: Date
  service: Service | ExtraService
}

export interface RankOptions {
  horizonDays?: number
  limit?: number
}

export function rankUpcoming(
  now: Date,
  origin: { lat: number; lng: number },
  churches: Church[],
  servicesById: ReadonlyMap<string, ChurchServices>,
  { horizonDays = 8, limit = 20 }: RankOptions = {},
): Upcoming[] {
  const out: Upcoming[] = []
  for (const church of churches) {
    const svc = servicesById.get(church.id)
    if (!svc) continue
    const distanceKm = haversineKm(origin.lat, origin.lng, church.lat, church.lng)

    let best: Upcoming | null = null
    const consider = (service: Service | ExtraService, spec: Parameters<typeof nextOccurrences>[0]) => {
      for (const start of nextOccurrences(spec, now, horizonDays)) {
        if (!runsOn(service, start)) continue // "kromě července a srpna" — don't lie in July
        if (!best || start < best.start) best = { church, distanceKm, start, service }
        break // occurrences are sorted; the first running one is this service's best
      }
    }
    for (const s of svc.regular) consider(s, { days: s.days, time: s.time })
    for (const x of svc.extra) consider(x, { date: x.date, time: x.time })
    if (best) out.push(best)
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime() || a.distanceKm - b.distanceKm)
  return out.slice(0, limit)
}

/**
 * The full ordo for one Prague calendar day (today + dayOffset): every service
 * of every church that day, chronological — the planning view ("kdy je
 * v neděli mše?"). No reachability filter; for today only what's still ahead.
 */
export function ordoForDay(
  now: Date,
  dayOffset: number,
  origin: { lat: number; lng: number },
  churches: Church[],
  servicesById: ReadonlyMap<string, ChurchServices>,
): Upcoming[] {
  const today = pragueToday(now)
  const target = new Date(Date.UTC(today.y, today.m - 1, today.d) + dayOffset * 86_400_000)
  const onTarget = (d: Date): boolean => {
    const w = pragueToday(d)
    return (
      w.y === target.getUTCFullYear() && w.m === target.getUTCMonth() + 1 && w.d === target.getUTCDate()
    )
  }
  const out: Upcoming[] = []
  for (const church of churches) {
    const svc = servicesById.get(church.id)
    if (!svc) continue
    const distanceKm = haversineKm(origin.lat, origin.lng, church.lat, church.lng)
    const consider = (service: Service | ExtraService, spec: Parameters<typeof nextOccurrences>[0]) => {
      for (const start of nextOccurrences(spec, now, dayOffset + 1)) {
        if (onTarget(start) && runsOn(service, start)) out.push({ church, distanceKm, start, service })
      }
    }
    for (const s of svc.regular) consider(s, { days: s.days, time: s.time })
    for (const x of svc.extra) consider(x, { date: x.date, time: x.time })
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime() || a.distanceKm - b.distanceKm)
  return out
}

/**
 * The one context selector shared by the seznam and the mapa: church-level
 * barrier-free filter + service-level filters (rite/lang/type/kdy) + the day
 * choice, in one place — what the list shows is exactly what the map
 * highlights. The map passes { limit: Infinity } (it styles every visible
 * church); the list keeps the default cap.
 */
export function selectUpcoming(
  now: Date,
  origin: { lat: number; lng: number },
  churches: Church[],
  byId: ReadonlyMap<string, ChurchServices>,
  filters: Filters,
  cas: string | null,
  day: DayChoice,
  opts: RankOptions = {},
): Upcoming[] {
  let cs = filters.barrierFree ? churches.filter((c) => c.barrierFree) : churches
  if (filters.maxKm) {
    const max = filters.maxKm // church-level, like barrierFree — okruh filter
    cs = cs.filter((c) => haversineKm(origin.lat, origin.lng, c.lat, c.lng) <= max)
  }
  const filtered = applyFilters(byId, filters, cas)
  return day === 'now'
    ? rankUpcoming(now, origin, cs, filtered, opts)
    : ordoForDay(now, day, origin, cs, filtered)
}

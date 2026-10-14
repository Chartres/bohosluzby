// "Where can I make it": for every church, its best upcoming service by the
// ordering below, then rows grouped by Prague day (one list heading per day)
// and ordered within the day — never a cutoff, the radius and the list stay whole:
//  1. reachable before unreachable: a service you can't get to by its start
//     even at ~30 km/h (2 min per km) sinks to the end (an 08:40 adoration
//     7.5 km away at 08:30);
//  2. Masses before other services (adorace, chvály) — the app is "Kam na mši";
//  3. minutes until start + 6 per km: a church 1 km nearer is worth 6 minutes'
//     wait. Pure time-then-distance buried the local 09:00 parish Mass under
//     twenty 07:30–08:00 village Masses up to 28 km away (Telč, Sunday 07:00).
// ponytail: straight-line km, no routing — tune MIN_PER_KM if real reports disagree.

import { haversineKm } from './distance'
import { nextOccurrences, pragueToday } from './occurrences'
import { parseNote } from './notes'
import { applyFilters, isMass, type Filters } from './filters'
import type { Church, ChurchServices, Service, ExtraService } from './data'

/** Day-picker choice: 'now' = where you can make it (see the header); 0–6 = today + offset's full ordo. */
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
  limit?: number
}

export function rankUpcoming(
  now: Date,
  origin: { lat: number; lng: number },
  churches: Church[],
  servicesById: ReadonlyMap<string, ChurchServices>,
  { limit = 20 }: RankOptions = {},
): Upcoming[] {
  const reachable = (start: Date, km: number) => start.getTime() - now.getTime() >= REACH_MIN_PER_KM * km * 60_000
  const key = (start: Date, service: Service | ExtraService, km: number): number =>
    (reachable(start, km) ? 0 : 2e6) +
    (isMass(service.type) ? 0 : 1e6) +
    (start.getTime() - now.getTime()) / 60_000 +
    MIN_PER_KM * km
  const out: (Upcoming & { key: number; day: number })[] = []
  for (const church of churches) {
    const svc = servicesById.get(church.id)
    if (!svc) continue
    const distanceKm = haversineKm(origin.lat, origin.lng, church.lat, church.lng)

    // The church's row is its best-keyed service, not its earliest: an
    // adorace at 08:35 must not hide the Mass at 09:00.
    let best: (typeof out)[number] | null = null
    const consider = (service: Service | ExtraService, spec: Parameters<typeof nextOccurrences>[0]) => {
      for (const start of nextOccurrences(spec, now)) {
        if (!runsOn(service, start)) continue // "kromě července a srpna" — don't lie in July
        const k = key(start, service, distanceKm)
        if (!best || k < best.key) {
          const w = pragueToday(start)
          best = { church, distanceKm, start, service, key: k, day: Date.UTC(w.y, w.m - 1, w.d) }
        }
        if (reachable(start, distanceKm)) break // later occurrences only score worse
      }
    }
    for (const s of svc.regular) consider(s, { days: s.days, time: s.time })
    for (const x of svc.extra) consider(x, { date: x.date, time: x.time })
    if (best) out.push(best)
  }
  // Prague day first: the list prints a heading per day change, so the tiers
  // may only reorder rows within a day.
  out.sort((a, b) => a.day - b.day || a.key - b.key || a.distanceKm - b.distanceKm)
  return out.slice(0, limit).map(({ key: _k, day: _d, ...u }) => u)
}

/** ~30 km/h door to door: slower than this and the start is already gone. */
const REACH_MIN_PER_KM = 2
/** How many minutes' wait one kilometre nearer is worth. */
const MIN_PER_KM = 6

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
        if (onTarget(start) && runsOn(service, start))
          out.push({ church, distanceKm, start, service })
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

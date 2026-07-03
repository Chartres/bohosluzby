// "Soonest you can make it": for every church, the earliest upcoming service
// whose start you can still reach on foot (walk time + a small buffer),
// sorted by start time. Time beats raw distance — a mass in 20 minutes 1 km
// away outranks one tomorrow next door.

import { haversineKm } from './distance'
import { nextOccurrences, pragueToday } from './occurrences'
import type { Church, ChurchServices, Service, ExtraService } from './data'

export interface Upcoming {
  church: Church
  distanceKm: number
  start: Date
  service: Service | ExtraService
}

export interface RankOptions {
  walkKmh?: number
  bufferMin?: number
  horizonDays?: number
  limit?: number
}

export function rankUpcoming(
  now: Date,
  origin: { lat: number; lng: number },
  churches: Church[],
  servicesById: ReadonlyMap<string, ChurchServices>,
  { walkKmh = 4.5, bufferMin = 5, horizonDays = 8, limit = 20 }: RankOptions = {},
): Upcoming[] {
  const out: Upcoming[] = []
  for (const church of churches) {
    const svc = servicesById.get(church.id)
    if (!svc) continue
    const distanceKm = haversineKm(origin.lat, origin.lng, church.lat, church.lng)
    const reachableAt = new Date(now.getTime() + ((distanceKm / walkKmh) * 60 + bufferMin) * 60_000)

    let best: Upcoming | null = null
    const consider = (service: Service | ExtraService, spec: Parameters<typeof nextOccurrences>[0]) => {
      for (const start of nextOccurrences(spec, now, horizonDays)) {
        if (start < reachableAt) continue
        if (!best || start < best.start) best = { church, distanceKm, start, service }
        break // occurrences are sorted; the first reachable one is this service's best
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
        if (onTarget(start)) out.push({ church, distanceKm, start, service })
      }
    }
    for (const s of svc.regular) consider(s, { days: s.days, time: s.time })
    for (const x of svc.extra) consider(x, { date: x.date, time: x.time })
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime() || a.distanceKm - b.distanceKm)
  return out
}

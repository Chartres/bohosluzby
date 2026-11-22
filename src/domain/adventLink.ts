// The in-app link to the roráty pages (option A, Pavol's decision page, 25 Nov 2026):
// in Advent, one line under the day row opens /advent/<town>/ for the nearest town
// that has a page (scripts/prerender.mjs: towns with 3+ churches), else the town list.
import type { City } from './cities'
import { haversineKm } from './distance'
import { pragueIsoDate } from './occurrences'
import { adventOf } from './season'
import { SITE_ORIGIN } from './site'

/** The prerender's rule for which towns get a season page. */
const MIN_CHURCHES = 3
/** The line appears this many days before the 1st Sunday of Advent. */
const LEAD_DAYS = 7

export function adventLink(now: Date, origin: { lat: number; lng: number } | null, cities: City[]): { href: string; town: string } | null {
  const today = pragueIsoDate(now)
  const { start, end } = adventOf(today)
  const lead = new Date(Date.parse(`${start}T00:00:00Z`) - LEAD_DAYS * 86_400_000).toISOString().slice(0, 10)
  if (today < lead || today > end) return null
  const towns = cities.filter((c) => c.count >= MIN_CHURCHES)
  if (!origin || !towns.length) return { href: `${SITE_ORIGIN}/advent/`, town: '' }
  const near = towns.reduce((a, b) => (haversineKm(origin.lat, origin.lng, b.lat, b.lng) < haversineKm(origin.lat, origin.lng, a.lat, a.lng) ? b : a))
  return { href: `${SITE_ORIGIN}/advent/${near.slug}/`, town: near.name }
}

// Service-level filters (rite, language, type, time window) — shared by the
// hero list and the lazily-loaded map, so both narrow the same way.

import type { ChurchServices, ExtraService, Service } from './data'
import { matchesCas } from './timeband'

export interface Filters {
  lang: string | null
  greek: boolean
  barrierFree: boolean
  massOnly: boolean
  /** Church-level distance cap in km (null = no cap). */
  maxKm: number | null
}

export const NO_FILTERS: Filters = {
  lang: null,
  greek: false,
  barrierFree: false,
  massOnly: false,
  maxKm: null,
}

/** The okruh choices — walking, cycling, driving radii. */
export const MAX_KM_OPTIONS = [2, 5, 10] as const

// ponytail: registry types are free text; "mass" = anything named mše/liturgie.
const isMass = (type: string) => /mše|liturgi/i.test(type)

export const serviceMatches =
  (f: Filters, cas: string | null = null) =>
  (s: Service | ExtraService): boolean =>
    (!f.lang || s.lang === f.lang) &&
    (!f.greek || s.greek) &&
    (!f.massOnly || isMass(s.type)) &&
    (!cas || matchesCas(cas, s.time))

/** Filter each church's services before ranking, so a church falls back to its
 * next matching service instead of disappearing with its earliest one. */
export function applyFilters(
  byId: ReadonlyMap<string, ChurchServices>,
  f: Filters,
  cas: string | null = null,
): ReadonlyMap<string, ChurchServices> {
  if (!f.lang && !f.greek && !f.massOnly && !cas) return byId
  const pred = serviceMatches(f, cas)
  const out = new Map<string, ChurchServices>()
  for (const [id, svc] of byId) {
    out.set(id, { ...svc, regular: svc.regular.filter(pred), extra: svc.extra.filter(pred) })
  }
  return out
}

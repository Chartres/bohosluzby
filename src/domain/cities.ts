// City aggregation for /mesto/<slug>/ pages and routing. Registry city values
// are "quarter, municipality" or "Praha N" — normalize to the municipality.
// Imported by the app AND by scripts/prerender.mjs (node runs the .ts directly).
import type { Church } from './data'
import { haversineKm } from './distance.ts'

function normalizeCity(raw: string): string {
  const city = raw.includes(',') ? raw.slice(raw.lastIndexOf(',') + 1).trim() : raw.trim()
  return /^Praha \d+$/.test(city) ? 'Praha' : city
}

/** Diacritics-insensitive fold: 'České' → 'ceske' (both sides of every match). */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function slugify(name: string): string {
  return fold(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export interface City {
  name: string
  slug: string
  count: number
  lat: number
  lng: number
  churches: Church[]
  /** Set only when another municipality shares the name: the nearest unique town. */
  near?: string
}

/** All municipalities with their churches and centroid, largest first. */
export function aggregateCities(index: Church[]): City[] {
  // Step 1: group by (name, cell) so same-named towns in different regions stay separate.
  const byKey = new Map<string, Church[]>()
  for (const c of index) {
    const name = normalizeCity(c.city)
    if (!name) continue
    const key = `${name}|${c.cell}`
    const list = byKey.get(key)
    if (list) list.push(c)
    else byKey.set(key, [c])
  }

  // Step 2: merge groups with the same name whose centroids are within 0.5° lat × 0.5° lng.
  // ponytail: 0.5° ≈ 55 km — covers any Czech municipality crossing a 1° cell boundary
  // (e.g. Praha straddles 49°N/50°N) while keeping same-named towns in different regions
  // separate (Jestřebí near Česká Lípa vs Znojmo are ~160 km apart). Ceiling: two
  // namesakes under 55 km apart across a cell edge still merge.
  type MGroup = { name: string; cell: string; churches: Church[]; lat: number; lng: number }
  const byName = new Map<string, MGroup[]>()
  for (const [key, churches] of byKey) {
    const sep = key.lastIndexOf('|')
    const name = key.slice(0, sep)
    const cell = key.slice(sep + 1)
    const lat = churches.reduce((s, c) => s + c.lat, 0) / churches.length
    const lng = churches.reduce((s, c) => s + c.lng, 0) / churches.length
    const same = byName.get(name) ?? []
    const near = same.find((g) => Math.abs(g.lat - lat) < 0.5 && Math.abs(g.lng - lng) < 0.5)
    if (near) {
      const prevLen = near.churches.length
      near.churches.push(...churches)
      near.lat = near.churches.reduce((s, c) => s + c.lat, 0) / near.churches.length
      near.lng = near.churches.reduce((s, c) => s + c.lng, 0) / near.churches.length
      if (churches.length > prevLen) near.cell = cell // the larger part names the group
    } else {
      same.push({ name, cell, churches, lat, lng })
      byName.set(name, same)
    }
  }

  // Step 3: slugs. Of same-named municipalities the one with the most churches keeps
  // the bare slug — the URL every existing /mesto/<slug>/ link and sitemap entry
  // points at (Hranice na Moravě stays /mesto/hranice/) — and the smaller namesakes
  // get their cell ("hranice-5012"). Ties go to the lower cell, so it's deterministic.
  const out: City[] = []
  for (const [name, same] of byName) {
    same.sort((a, b) => b.churches.length - a.churches.length || a.cell.localeCompare(b.cell))
    same.forEach(({ cell, churches, lat, lng }, i) => {
      const slug = i === 0 ? slugify(name) : `${slugify(name)}-${cell.replace('-', '')}`
      out.push({ name, slug, count: churches.length, lat, lng, churches })
    })
  }
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'cs'))

  // Resolve any remaining slug collisions (e.g. "Skřipov" vs "Skřípov" → same base slug).
  // Assign suffixes in name order (stable), not count order, so a data refresh that
  // changes church counts doesn't repoint an existing /mesto/<slug>/ URL.
  const slugGroups = new Map<string, City[]>()
  for (const city of out) {
    const g = slugGroups.get(city.slug)
    if (g) g.push(city)
    else slugGroups.set(city.slug, [city])
  }
  for (const group of slugGroups.values()) {
    if (group.length <= 1) continue
    // Sort by name for a stable assignment; lat as tiebreaker for same-name edge cases.
    group.sort((a, b) => a.name.localeCompare(b.name, 'cs') || (a.lat - b.lat))
    group.forEach((city, i) => {
      if (i > 0) city.slug = `${city.slug}-${i + 1}`
    })
  }

  // Namesakes look identical in the picker ("Petrovice" ×4), so each one carries the
  // nearest town with a unique name and 3+ churches: "Petrovice (Příbram)".
  // ponytail: nominative in brackets, because "u Příbrami" needs a genitive we can't derive.
  const nameCount = new Map<string, number>()
  for (const c of out) nameCount.set(c.name, (nameCount.get(c.name) ?? 0) + 1)
  const anchors = out.filter((c) => c.count >= 3 && nameCount.get(c.name) === 1)
  for (const c of out) {
    if (nameCount.get(c.name) === 1) continue
    let best: City | undefined
    let bestKm = Infinity
    for (const a of anchors) {
      const km = haversineKm(c.lat, c.lng, a.lat, a.lng)
      if (km < bestKm) [best, bestKm] = [a, km]
    }
    if (best) c.near = best.name
  }
  return out
}

/** Display name: "Petrovice (Příbram)" for a namesake, the bare name otherwise. */
export const cityLabel = (c: City): string => (c.near ? `${c.name} (${c.near})` : c.name)

const _cityCache = new WeakMap<Church[], City[]>()
function cachedCities(index: Church[]): City[] {
  let c = _cityCache.get(index)
  if (!c) { c = aggregateCities(index); _cityCache.set(index, c) }
  return c
}

export const findCity = (index: Church[], slug: string): City | undefined =>
  cachedCities(index).find((c) => c.slug === slug)

export type SearchResult =
  | { kind: 'city'; name: string; city: City }
  | { kind: 'church'; name: string; church: Church }

/**
 * Unified typeahead over ALL municipalities and churches, diacritics-insensitive.
 * Cities first (prefix matches, then size), then churches (name or city substring).
 * Replaces the <datalist> picker — Chromium caps datalist suggestions at 512
 * entries, which truncated the 3 259-value city list at "Dubí".
 */
export function searchPlaces(
  cities: City[],
  churches: Church[],
  query: string,
  limit = 10,
): SearchResult[] {
  const q = fold(query.trim())
  if (q.length < 2) return []
  const starts = (name: string) => Number(fold(name).startsWith(q))
  const cityHits = cities
    .filter((c) => fold(c.name).includes(q))
    .sort((a, b) => starts(b.name) - starts(a.name) || b.count - a.count)
    .slice(0, 4)
    .map((city): SearchResult => ({ kind: 'city', name: cityLabel(city), city }))
  const inName = (c: Church) => Number(fold(c.name).includes(q))
  const churchHits = churches
    // name + city + website host, so "kcmt" finds http://www.kcmt.cz
    .filter((c) => fold(`${c.name} ${c.city} ${c.www ?? ''}`).includes(q))
    .sort(
      (a, b) =>
        starts(b.name) - starts(a.name) ||
        inName(b) - inName(a) || // a hit in the church's own name beats a city-only hit
        a.name.localeCompare(b.name, 'cs'),
    )
    .slice(0, limit - cityHits.length)
    .map((church): SearchResult => ({ kind: 'church', name: church.name, church }))
  return [...cityHits, ...churchHits]
}

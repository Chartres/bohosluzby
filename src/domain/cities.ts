// City aggregation for /mesto/<slug>/ pages and routing. Registry city values
// are "quarter, municipality" or "Praha N" — normalize to the municipality.
// Imported by the app AND by scripts/prerender.mjs (node runs the .ts directly).
import type { Church } from './data'

export function normalizeCity(raw: string): string {
  const city = raw.includes(',') ? raw.slice(raw.lastIndexOf(',') + 1).trim() : raw.trim()
  return /^Praha \d+$/.test(city) ? 'Praha' : city
}

/** Diacritics-insensitive fold: 'České' → 'ceske' (both sides of every match). */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function slugify(name: string): string {
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
}

/** All municipalities with their churches and centroid, largest first. */
export function aggregateCities(index: Church[]): City[] {
  const byName = new Map<string, Church[]>()
  for (const c of index) {
    const name = normalizeCity(c.city)
    if (!name) continue
    const list = byName.get(name)
    if (list) list.push(c)
    else byName.set(name, [c])
  }
  const out: City[] = []
  for (const [name, churches] of byName) {
    out.push({
      name,
      slug: slugify(name),
      count: churches.length,
      lat: churches.reduce((s, c) => s + c.lat, 0) / churches.length,
      lng: churches.reduce((s, c) => s + c.lng, 0) / churches.length,
      churches,
    })
  }
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'cs'))
  return out
}

export const findCity = (index: Church[], slug: string): City | undefined =>
  aggregateCities(index).find((c) => c.slug === slug)

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
    .map((city): SearchResult => ({ kind: 'city', name: city.name, city }))
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

// City aggregation for /mesto/<slug>/ pages and routing. Registry city values
// are "quarter, municipality" or "Praha N" — normalize to the municipality.
// Imported by the app AND by scripts/prerender.mjs (node runs the .ts directly).
import type { Church } from './data'

export function normalizeCity(raw: string): string {
  const city = raw.includes(',') ? raw.slice(raw.lastIndexOf(',') + 1).trim() : raw.trim()
  return /^Praha \d+$/.test(city) ? 'Praha' : city
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
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

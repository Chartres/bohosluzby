// Dataset types + decoding of the compact JSON written by data/extract.mjs.

import { normalizeLang } from './format'

export interface Church {
  id: string
  name: string
  city: string
  lat: number
  lng: number
  barrierFree: boolean
  /** 1°×1° grid cell = services shard name, e.g. "50-14". */
  cell: string
}

/** churches.json row: [id, name, city, lat, lng, barrierFree, cell] */
export type IndexRow = [string, string, string, number, number, 0 | 1, string]

export interface Service {
  days: string // ISO weekday digits, 1=Mon…7=Sun
  time: string // "HH:MM" Prague wall clock
  lang: string // normalized Czech lowercase: "česky", "latinsky", "polsky"…
  greek: boolean // Greek-Catholic (byzantine) rite
  type: string // "mše sv.", "nešpory"…
  note: string
}

export interface ExtraService extends Omit<Service, 'days'> {
  date: string // "YYYY-MM-DD" one-off
}

export interface ChurchServices {
  updated: string // source "aktualizace" date
  parish: string
  parishAddress: string
  contacts: [type: string, value: string][]
  regular: Service[]
  extra: ExtraService[]
}

/** services/<cell>.json value shape (compact keys). */
interface ShardEntry {
  u: string
  p: string
  pa: string
  c: [string, string][]
  s: [string, string, string, 0 | 1, string, string][]
  x?: [string, string, string, 0 | 1, string, string][]
}

export const decodeIndex = (rows: IndexRow[]): Church[] =>
  rows.map(([id, name, city, lat, lng, bf, cell]) => ({
    id,
    name,
    city,
    lat,
    lng,
    barrierFree: bf === 1,
    cell,
  }))

export function decodeShard(shard: Record<string, ShardEntry>): Map<string, ChurchServices> {
  const out = new Map<string, ChurchServices>()
  for (const [id, e] of Object.entries(shard)) {
    out.set(id, {
      updated: e.u,
      parish: e.p,
      parishAddress: e.pa,
      contacts: e.c,
      regular: e.s.map(([days, time, lang, greek, type, note]) => ({
        days,
        time,
        lang: normalizeLang(lang),
        greek: greek === 1,
        type,
        note,
      })),
      extra: (e.x ?? []).map(([date, time, lang, greek, type, note]) => ({
        date,
        time,
        lang: normalizeLang(lang),
        greek: greek === 1,
        type,
        note,
      })),
    })
  }
  return out
}

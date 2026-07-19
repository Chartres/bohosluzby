// The "kdy" filter: a service passes if its Prague wall-clock time falls in a
// time-of-day band (ráno · dopoledne · odpoledne · večer) or within ±90 min of
// a chosen "kolem HH:MM" time. Distance is circular, so kolem 23:30 still
// matches a 00:45 vigil instead of falling off the clock edge.

import { pragueMinutes } from './occurrences'
import { lang } from '../i18n'

export const BANDS = {
  rano: { from: 0, to: 10 * 60 }, // do 10
  dopoledne: { from: 10 * 60, to: 13 * 60 },
  odpoledne: { from: 13 * 60, to: 17 * 60 },
  vecer: { from: 17 * 60, to: 24 * 60 }, // od 17
} as const
export type Band = keyof typeof BANDS

const BAND_LABEL_CS: Record<Band, string> = {
  rano: 'ráno',
  dopoledne: 'dopoledne',
  odpoledne: 'odpoledne',
  vecer: 'večer',
}
const BAND_LABEL_EN: Record<Band, string> = {
  rano: 'morning',
  dopoledne: 'late morning',
  odpoledne: 'afternoon',
  vecer: 'evening',
}

/** Read per call — the label follows the current language, not the one
 * active when the module first loaded. */
export function bandLabel(band: Band): string {
  return (lang() === 'cs' ? BAND_LABEL_CS : BAND_LABEL_EN)[band]
}

export const AROUND_MIN = 90

/** Minutes since midnight; prefix-tolerant like occurrences' parser
 * (registry times can carry suffixes), strict about the digits themselves. */
const toMinutes = (s: string, strict = false): number | null => {
  const m = (strict ? /^(\d{1,2}):(\d{2})$/ : /^(\d{1,2}):(\d{2})/).exec(s.trim())
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  return hh <= 23 && mm <= 59 ? hh * 60 + mm : null
}

/** The 48 half-hours of the day — the "kolem" selector's options ("00:00" … "23:30"). */
export const HALF_HOURS: string[] = Array.from({ length: 48 }, (_, i) => fmtMinutes(i * 30))

/** The selector's option order: rotated so the list opens at the user's probable
 * answer — the next half-hour from now (Prague wall clock) — instead of 00:00.
 * Same 48 values; "kolem" matching is circular, so order carries no semantics. */
export function halfHoursFrom(now: Date): string[] {
  const idx = Math.ceil(pragueMinutes(now) / 30) % 48
  return [...HALF_HOURS.slice(idx), ...HALF_HOURS.slice(0, idx)]
}

function fmtMinutes(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Validate a ?cas= value: a band name or "HH:MM". Times are canonicalized to
 * the nearest half-hour ("9:05" → "09:00") — the selector is 30-min-step, but
 * old minute-precision links keep working. Anything else → null. */
export function parseCas(param: string | null): string | null {
  if (!param) return null
  if (param in BANDS) return param
  const t = toMinutes(param, true)
  if (t === null) return null
  return fmtMinutes((Math.round(t / 30) * 30) % 1440)
}

/** Is the whole band already over today (Prague wall clock)? Only bands can be
 * fully past — "kolem" is circular and a day filter, not a today filter. */
export function bandFullyPast(cas: string | null, now: Date): boolean {
  const band = cas ? (BANDS[cas as Band] as { to: number } | undefined) : undefined
  return Boolean(band) && band!.to <= pragueMinutes(now)
}

/** Honest den×kdy resolution: picking a band that can't match today anymore
 * while on "hned" jumps to zítra — the next day the band CAN match — instead
 * of quietly reinterpreting "hned". A merely partially-past band, any other
 * day, and "kolem" times keep the day unchanged. */
export function resolveCasDay(day: 'now' | number, cas: string | null, now: Date): 'now' | number {
  return day === 'now' && bandFullyPast(cas, now) ? 1 : day
}

/** Does a service's wall-clock "HH:MM" fall inside the cas window? */
export function matchesCas(cas: string, time: string): boolean {
  const t = toMinutes(time)
  if (t === null) return false
  const band = BANDS[cas as Band] as { from: number; to: number } | undefined
  if (band) return t >= band.from && t < band.to
  const c = toMinutes(cas, true)
  if (c === null) return false
  const d = Math.abs(t - c)
  return Math.min(d, 1440 - d) <= AROUND_MIN
}

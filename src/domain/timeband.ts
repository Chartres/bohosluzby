// The "kdy" filter: a service passes if its Prague wall-clock time falls in a
// time-of-day band (ráno · dopoledne · odpoledne · večer) or within ±90 min of
// a chosen "kolem HH:MM" time. Distance is circular, so kolem 23:30 still
// matches a 00:45 vigil instead of falling off the clock edge.

export const BANDS = {
  rano: { label: 'ráno', from: 0, to: 10 * 60 }, // do 10
  dopoledne: { label: 'dopoledne', from: 10 * 60, to: 13 * 60 },
  odpoledne: { label: 'odpoledne', from: 13 * 60, to: 17 * 60 },
  vecer: { label: 'večer', from: 17 * 60, to: 24 * 60 }, // od 17
} as const
export type Band = keyof typeof BANDS

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

/** Validate a ?cas= value: a band name or strict "HH:MM"; anything else → null. */
export function parseCas(param: string | null): string | null {
  if (!param) return null
  if (param in BANDS) return param
  return toMinutes(param, true) !== null ? param : null
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

// "Next occurrences": turn a church's periodic service (day-of-week set +
// wall-clock time, Europe/Prague) or one-off service (date + time) into
// concrete upcoming instants. All wall-clock ↔ instant conversion goes through
// Intl with the Europe/Prague zone, so DST is handled by the platform.

export interface PeriodicSpec {
  /** ISO day digits, 1 = Monday … 7 = Sunday, e.g. "12345" or "7". */
  days: string
  /** "HH:MM" wall-clock time in Prague. */
  time: string
}
export interface OneOffSpec {
  /** "YYYY-MM-DD" */
  date: string
  time: string
}
export type OccurrenceSpec = PeriodicSpec | OneOffSpec

const pragueFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Prague',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function pragueWall(instant: Date): { y: number; m: number; d: number; hh: number; mm: number } {
  const p: Record<string, number> = {}
  for (const part of pragueFmt.formatToParts(instant)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  return { y: p.year, m: p.month, d: p.day, hh: p.hour, mm: p.minute }
}

/** The instant at which Prague wall clock shows y-m-d hh:mm (DST-aware). */
export function pragueInstant(y: number, m: number, d: number, hh: number, mm: number): Date {
  // Prague is UTC+1 or UTC+2; try both offsets and keep the one that round-trips.
  for (const offsetMin of [120, 60]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, hh, mm) - offsetMin * 60_000)
    const w = pragueWall(candidate)
    if (w.y === y && w.m === m && w.d === d && w.hh === hh && w.mm === mm) return candidate
  }
  // Spring-forward gap (02:30 doesn't exist): fall back to the +1 reading.
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - 60 * 60_000)
}

/** Prague calendar date for an instant. */
export function pragueToday(now: Date): { y: number; m: number; d: number } {
  const { y, m, d } = pragueWall(now)
  return { y, m, d }
}

const parseTime = (time: string): [number, number] | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  return m ? [Number(m[1]), Number(m[2])] : null
}

/**
 * Concrete upcoming start instants for a service, sorted ascending.
 * Periodic: one per matching weekday within `horizonDays` (offsets 0..horizon).
 * One-off: exactly one, if still in the future.
 */
export function nextOccurrences(spec: OccurrenceSpec, now: Date, horizonDays = 8): Date[] {
  const t = parseTime(spec.time)
  if (!t) return []
  const [hh, mm] = t

  if ('date' in spec) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(spec.date)
    if (!m) return []
    const instant = pragueInstant(Number(m[1]), Number(m[2]), Number(m[3]), hh, mm)
    return instant > now ? [instant] : []
  }

  const wanted = new Set([...spec.days].map(Number).filter((n) => n >= 1 && n <= 7))
  if (wanted.size === 0) return []

  const today = pragueToday(now)
  const base = Date.UTC(today.y, today.m - 1, today.d) // date arithmetic on a neutral axis
  const out: Date[] = []
  for (let off = 0; off <= horizonDays; off++) {
    const cal = new Date(base + off * 86_400_000)
    const isoDow = cal.getUTCDay() === 0 ? 7 : cal.getUTCDay()
    if (!wanted.has(isoDow)) continue
    const instant = pragueInstant(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), hh, mm)
    if (instant > now) out.push(instant)
  }
  return out
}

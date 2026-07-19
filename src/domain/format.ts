// Display formatting, all wall-clock output in Europe/Prague. Locale-aware
// (cs/en) via i18n's lang()/locale() — read per call, not cached at module
// load, so a runtime language change (or a test flipping navigator.language)
// takes effect on the next format call.

import { lang, locale } from '../i18n'

const TZ = 'Europe/Prague'

export function fmtUntil(now: Date, start: Date): string {
  const min = Math.floor((start.getTime() - now.getTime()) / 60_000)
  if (lang() !== 'cs') {
    if (min < 1) return 'starting now'
    if (min < 60) return `in ${min} min`
    if (min < 24 * 60) {
      const h = Math.floor(min / 60)
      const m = min % 60
      return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`
    }
    const days = Math.round(min / (24 * 60))
    return `in ${days} day${days === 1 ? '' : 's'}`
  }
  if (min < 1) return 'právě začíná'
  if (min < 60) return `za ${min} min`
  if (min < 24 * 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m === 0 ? `za ${h} h` : `za ${h} h ${m} min`
  }
  const days = Math.round(min / (24 * 60))
  return `za ${days} ${days === 1 ? 'den' : days >= 5 ? 'dní' : 'dny'}`
}

/** Registry entry older than 18 months → the schedule is a verify-before-you-go
 * warning, not a promise (shared by the list rows and the detail). */
export function isStale(iso: string, now = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return false
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - 18)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) < cutoff
}

export function fmtDistance(km: number): string {
  if (lang() !== 'cs') {
    if (km < 0.1) return 'within 100 m'
    if (km < 0.95) return `${Math.round((km * 1000) / 100) * 100} m`
    return `${km.toFixed(1)} km`
  }
  if (km < 0.1) return 'do 100 m'
  if (km < 0.95) return `${Math.round((km * 1000) / 100) * 100} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}

// Time digits read the same in every locale; hourCycle is forced regardless.
const timeFmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
export const fmtTime = (d: Date): string => timeFmt.format(d)

const dateKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }) // YYYY-MM-DD

// One cache, keyed by "kind:locale" — Intl.DateTimeFormat construction isn't
// free, and locale() can flip mid-session (a test, or a live language change).
const fmtCache = new Map<string, Intl.DateTimeFormat>()
function cachedFmt(kind: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const loc = locale()
  const key = `${kind}:${loc}`
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(loc, opts)
    fmtCache.set(key, f)
  }
  return f
}
const weekdayFmt = () =>
  cachedFmt('weekday', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'numeric' })

/** Registry language values are inconsistent endonyms ("Latine", "po polsku",
 * "deutsch"…); normalize to Czech lowercase adverbs so chips and filters read
 * like one voice. Applied once at shard decode. */
const LANG_MAP: Record<string, string> = {
  '': 'česky',
  'česky': 'česky',
  'čeština': 'česky',
  latine: 'latinsky',
  latina: 'latinsky',
  'latinsky (trident)': 'latinsky (tridentská)',
  english: 'anglicky',
  italiana: 'italsky',
  'en español': 'španělsky',
  'en français': 'francouzsky',
  filipino: 'filipínsky',
  magyarul: 'maďarsky',
  'po polsku': 'polsky',
  'viet nam': 'vietnamsky',
  deutsch: 'německy',
}

export function normalizeLang(raw: string): string {
  const key = raw.trim().toLowerCase()
  return LANG_MAP[key] ?? key
}

const dateFmt = () => cachedFmt('date', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' })

/** "YYYY-MM-DD" → "30. 1. 2026" (cs) / "30/1/2026"-shaped (en), locale-aware.
 * Kept the "Cz" name — every existing caller predates English support and the
 * rename would touch every import for no behavioral gain. */
export function fmtDateCz(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return dateFmt().format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)))
}

export function dayLabel(now: Date, start: Date): string {
  const key = dateKeyFmt.format(start)
  if (key === dateKeyFmt.format(now)) return lang() === 'cs' ? 'dnes' : 'today'
  if (key === dateKeyFmt.format(new Date(now.getTime() + 86_400_000)))
    return lang() === 'cs' ? 'zítra' : 'tomorrow'
  return weekdayFmt().format(start).toLowerCase()
}

/** Same Prague calendar day? (The map chip's "is this actually today" check.) */
export function samePragueDay(a: Date, b: Date): boolean {
  return dateKeyFmt.format(a) === dateKeyFmt.format(b)
}

const weekdayShortFmt = () => cachedFmt('weekdayShort', { timeZone: TZ, weekday: 'short' })

/** "út", "ne" (cs) / "tue", "sun" (en) — the day prefix on a map chip that
 * isn't today. */
export function fmtWeekdayShort(d: Date): string {
  return weekdayShortFmt().format(d).replace('.', '').toLowerCase()
}

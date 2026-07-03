// Czech display formatting, all wall-clock output in Europe/Prague.

const TZ = 'Europe/Prague'

export function fmtUntil(now: Date, start: Date): string {
  const min = Math.floor((start.getTime() - now.getTime()) / 60_000)
  if (min < 1) return 'právě začíná'
  if (min < 60) return `za ${min} min`
  if (min < 24 * 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m === 0 ? `za ${h} h` : `za ${h} h ${m} min`
  }
  const days = Math.round(min / (24 * 60))
  return `za ${days} ${days >= 5 ? 'dní' : 'dny'}`
}

export function fmtDistance(km: number): string {
  if (km < 0.1) return 'do 100 m'
  if (km < 0.95) return `${Math.round((km * 1000) / 100) * 100} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}

const timeFmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
export const fmtTime = (d: Date): string => timeFmt.format(d)

const dateKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }) // YYYY-MM-DD
const weekdayFmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
})

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

const dateCzFmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: TZ,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

/** "YYYY-MM-DD" → "30. 1. 2026" (empty string for anything unparsable). */
export function fmtDateCz(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return dateCzFmt.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)))
}

export function dayLabel(now: Date, start: Date): string {
  const key = dateKeyFmt.format(start)
  if (key === dateKeyFmt.format(now)) return 'dnes'
  if (key === dateKeyFmt.format(new Date(now.getTime() + 86_400_000))) return 'zítra'
  return weekdayFmt.format(start)
}

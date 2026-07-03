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

export function dayLabel(now: Date, start: Date): string {
  const key = dateKeyFmt.format(start)
  if (key === dateKeyFmt.format(now)) return 'dnes'
  if (key === dateKeyFmt.format(new Date(now.getTime() + 86_400_000))) return 'zítra'
  return weekdayFmt.format(start)
}

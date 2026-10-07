// The quiet holy-day line (evolve pick #4): on the eve and on the day of a
// weekday solemnity, one line on the home screen — never a notification.
// "Slavnost", not "zasvěcený svátek": which of these bind in the Czech
// Republic is ČBK's call, and the app doesn't claim an obligation.
import { easterSunday } from './liturgical'
import { pragueToday } from './occurrences'

const FIXED: Record<string, string> = {
  '1-1': 'Matky Boží, Panny Marie',
  '1-6': 'Zjevení Páně',
  '6-29': 'sv. Petra a Pavla',
  '7-5': 'sv. Cyrila a Metoděje',
  '8-15': 'Nanebevzetí Panny Marie',
  '9-28': 'sv. Václava',
  '11-1': 'Všech svatých',
  '12-8': 'Neposkvrněného početí Panny Marie',
  '12-25': 'Narození Páně',
}
const DAY = 86_400_000

function solemnityOn(t: number): string | null {
  const d = new Date(t)
  if (d.getUTCDay() === 0) return null // every Sunday is one — the line would be noise
  const y = d.getUTCFullYear()
  const e = easterSunday(y)
  if (t === Date.UTC(y, e.month - 1, e.day) + 39 * DAY) return 'Nanebevstoupení Páně'
  return FIXED[`${d.getUTCMonth() + 1}-${d.getUTCDate()}`] ?? null
}

export function holyDayLine(now: Date): { when: 'today' | 'tomorrow'; feast: string } | null {
  const p = pragueToday(now)
  const today = Date.UTC(p.y, p.m - 1, p.d)
  const tomorrow = solemnityOn(today + DAY)
  if (tomorrow) return { when: 'tomorrow', feast: tomorrow }
  const todays = solemnityOn(today)
  return todays ? { when: 'today', feast: todays } : null
}

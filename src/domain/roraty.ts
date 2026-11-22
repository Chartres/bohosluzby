// The app's "roráty" view (Pavol, 22 Nov 2026: option B — a pill in the day row, like the
// Dušičky one). Which occurrences count as roráty follows the /advent/ pages (season.ts):
// a registry row that says roráty and Advent, not on a Sunday nor on 8 Dec; a parish
// notice as given; a weekly Mass a notice confirms (data/corrections.mjs marks it `r`).
import type { ChurchServices } from './data'
import { pragueIsoDate } from './occurrences'
import type { Upcoming } from './ranking'
import { adventOf } from './season'

const RORATE = /rorát/i
const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  return m ? +m[1] * 60 + +m[2] : -1
}

/** The pill shows from the Saturday before the 1st Sunday of Advent to 24 Dec. */
export function rorateWindow(now: Date): boolean {
  const today = pragueIsoDate(now)
  const { start, end } = adventOf(today)
  const eve = new Date(Date.parse(`${start}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  return today >= eve && today <= end
}

/** The note to show when this occurrence is roráty, else null. */
export function rorateLabel(u: Upcoming, svc: ChurchServices | undefined): string | null {
  const s = u.service
  const iso = pragueIsoDate(u.start)
  const text = `${s.type} ${s.note}`
  if ('date' in s) return RORATE.test(text) ? s.note || s.type : null
  const marked = svc?.rorate?.find((r) => r.date === iso && toMin(r.time) === toMin(s.time))
  if (marked) return marked.note
  if (!RORATE.test(text) || !/advent/i.test(text)) return null
  if (new Date(`${iso}T12:00:00Z`).getUTCDay() === 0 || iso.slice(5) === '12-08') return null
  if ([...s.note.matchAll(/\b(20\d\d)\b/g)].some((m) => Number(m[1]) < Number(iso.slice(0, 4)))) return null
  return s.note || s.type
}

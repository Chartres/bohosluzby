// Všech svatých (1 Nov) and the commemoration of All Souls (2 Nov) in the app:
// for the week before and the two days themselves, a line on the home screen
// and a block on each church's detail with that church's services on both
// days. The name of 2 Nov is the missal's ("Vzpomínka na všechny věrné
// zemřelé") — the parishes' own wording; "Dušičky" is the folk name.
import type { ChurchServices, ExtraService } from './data'
import { parseNote } from './notes'
import { pragueToday } from './occurrences'

export const ALL_SAINTS = 'Slavnost Všech svatých'
export const ALL_SOULS = 'Vzpomínka na všechny věrné zemřelé'
/** Days before 1 Nov the line and the block appear. */
export const WINDOW_DAYS = 7

export interface FeastDayRef {
  iso: string
  /** days from today (0 = today) */
  offset: number
  name: string
}

const DAY_MS = 86_400_000

/** The two days, while today is within WINDOW_DAYS before 1 Nov up to 2 Nov; else null. */
export function feastWeek(now: Date): FeastDayRef[] | null {
  const { y, m, d } = pragueToday(now)
  const today = Date.UTC(y, m - 1, d)
  const saints = Date.UTC(y, 10, 1)
  const before = (saints - today) / DAY_MS
  if (before > WINDOW_DAYS || before < -1) return null
  return [
    { iso: `${y}-11-01`, offset: before, name: ALL_SAINTS },
    { iso: `${y}-11-02`, offset: before + 1, name: ALL_SOULS },
  ].filter((f) => f.offset >= 0)
}

const toMin = (t: string) => {
  const r = /^(\d{1,2}):(\d{2})/.exec(t)
  return r ? +r[1] * 60 + +r[2] : 0
}
const mass = (type: string) => (!type || /^mše sv\.?$/i.test(type) ? 'mše svatá' : type)

/** One church's services on one date, as dated one-offs (so calendar and pozvat
 * name that day), chronological. Mirrors servicesOn (feast.ts) for the decoded
 * shape: weekly rows whose note doesn't exclude the date, plus the one-offs
 * entered for it; the same service entered both ways prints once. */
export function servicesOnDate(svc: ChurchServices, iso: string): ExtraService[] {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = String(new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7)
  const extras = svc.extra.filter((x) => x.date === iso)
  const weekly = svc.regular
    .filter((s) => s.days.includes(dow) && parseNote(s.note).runsOn(y, m, d))
    .filter((s) => !extras.some((x) => toMin(x.time) === toMin(s.time) && mass(x.type) === mass(s.type) && x.lang === s.lang && x.greek === s.greek))
    .map(({ days: _days, ...s }) => ({ ...s, date: iso }))
  return [...weekly, ...extras].sort((a, b) => toMin(a.time) - toMin(b.time))
}

// Seasonal pills in the day row, as data (Pavol, 23 Nov 2026): public/data/views.json reaches
// the apps over the air like the Mass times, so a new season's pill (roráty, Christmas, Easter,
// a pilgrimage) needs no app release. This module is all the app knows: how to read an entry,
// when it shows, which days it lists and which services it keeps.
//
// An entry (views.json → views[]):
//   id     "roraty" — the ?den=<id> value; lowercase letters, digits, dashes; not a day key
//   label  {cs, en?} — the pill text;  aria {cs, en?} — its accessible name
//   show   {from, to} — Prague dates, inclusive, when the pill is in the row
//   days   {next: N} — today and the next N-1 days, or
//          {dates: [{date, from?}]} — fixed dates; `from` "HH:MM" drops earlier services that day
//   match  {any: true} — every service on those days, or any of:
//          text: ["rorát"]    a dated row (a parish notice) whose type or note contains one of them;
//                             a weekly row too, unless `weekly` narrows it:
//          weekly: {also: ["advent"], skipWeekdays: [7], skipDates: [...], skipPastYearNotes}
//          mark: ["rorát"]    a weekly Mass a parish notice marks that day (data/corrections.mjs)
// All matching is plain, case-insensitive text — never a pattern from data (iOS 15 can't parse
// some regex, and data must not run as code). An entry this module can't read is dropped.
import type { ChurchServices } from './data'
import { pragueDay, pragueIsoDate } from './occurrences'
import type { Upcoming } from './ranking'

export interface ViewSpec {
  id: string
  label: { cs: string; en?: string }
  aria: { cs: string; en?: string }
  show: { from: string; to: string }
  days: { next: number } | { dates: { date: string; from?: string }[] }
  match: {
    any?: boolean
    text?: string[]
    weekly?: { also?: string[]; skipWeekdays?: number[]; skipDates?: string[]; skipPastYearNotes?: boolean }
    mark?: string[]
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^\d{1,2}:\d{2}$/
/** ?den= values the app already uses: the Dušičky pill and the day keys (src/domain/days.ts). */
const RESERVED = new Set(['svatky', 'dnes', 'zitra', 'pristi-nedele', 'nedele', 'pondeli', 'utery', 'streda', 'ctvrtek', 'patek', 'sobota'])

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strList = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(isStr)
const optList = (v: unknown) => v === undefined || strList(v)
const text = (v: unknown) => !!v && typeof v === 'object' && isStr((v as { cs?: unknown }).cs) && ((v as { en?: unknown }).en === undefined || isStr((v as { en?: unknown }).en))

function valid(v: unknown): v is ViewSpec {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  if (typeof e.id !== 'string' || !/^[a-z0-9-]{2,30}$/.test(e.id) || RESERVED.has(e.id)) return false
  if (!text(e.label) || !text(e.aria)) return false
  const show = e.show as { from?: unknown; to?: unknown } | undefined
  if (!show || typeof show.from !== 'string' || typeof show.to !== 'string' || !ISO.test(show.from) || !ISO.test(show.to) || show.to < show.from) return false
  const days = e.days as { next?: unknown; dates?: unknown } | undefined
  if (!days) return false
  if ('next' in days) {
    if (typeof days.next !== 'number' || !Number.isInteger(days.next) || days.next < 1 || days.next > 14) return false
  } else if (Array.isArray(days.dates) && days.dates.length) {
    for (const d of days.dates as { date?: unknown; from?: unknown }[]) {
      if (!d || typeof d.date !== 'string' || !ISO.test(d.date) || (d.from !== undefined && (typeof d.from !== 'string' || !HHMM.test(d.from)))) return false
    }
  } else return false
  const m = e.match as Record<string, unknown> | undefined
  if (!m || typeof m !== 'object') return false
  if (m.any !== true && !strList(m.text) && !strList(m.mark)) return false
  if (!optList(m.text) || !optList(m.mark)) return false
  const w = m.weekly as Record<string, unknown> | undefined
  if (w !== undefined) {
    if (typeof w !== 'object' || w === null || !optList(w.also)) return false
    if (w.skipWeekdays !== undefined && !(Array.isArray(w.skipWeekdays) && w.skipWeekdays.every((n) => Number.isInteger(n) && n >= 1 && n <= 7))) return false
    if (w.skipDates !== undefined && !(Array.isArray(w.skipDates) && w.skipDates.every((d) => typeof d === 'string' && ISO.test(d)))) return false
  }
  return true
}

/** The entries of views.json the app can use; anything else is dropped, never thrown. */
export function parseViews(json: unknown): ViewSpec[] {
  const list = (json as { views?: unknown } | null)?.views
  return Array.isArray(list) ? list.filter(valid) : []
}

/** The views whose pill is in the row today (Prague date). */
export function activeViews(views: ViewSpec[], now: Date): ViewSpec[] {
  const today = pragueIsoDate(now)
  return views.filter((v) => today >= v.show.from && today <= v.show.to)
}

/** The day offsets (0 = today) the view lists. */
export function viewDays(view: ViewSpec, now: Date): number[] {
  if ('next' in view.days) return Array.from({ length: view.days.next }, (_, i) => i)
  const out: number[] = []
  for (let off = 0; off <= 14; off++) {
    const iso = pragueDay(now, off).toISOString().slice(0, 10)
    if (view.days.dates.some((d) => d.date === iso)) out.push(off)
  }
  return out
}

const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  return m ? +m[1] * 60 + +m[2] : -1
}
const has = (hay: string, needles: string[] | undefined) => !!needles?.some((n) => hay.toLowerCase().includes(n.toLowerCase()))

/** What to show as the service's note when the view keeps it, else null. */
export function viewLabel(view: ViewSpec, u: Upcoming, svc: ChurchServices | undefined): string | null {
  const s = u.service
  const iso = pragueIsoDate(u.start)
  if ('dates' in view.days) {
    const day = view.days.dates.find((d) => d.date === iso)
    if (!day || (day.from && toMin(s.time) < toMin(day.from))) return null
  }
  const m = view.match
  if (m.any) return s.note
  const words = `${s.type} ${s.note}`
  if ('date' in s) return has(words, m.text) ? s.note || s.type : null
  const marked = svc?.marks?.find((r) => r.date === iso && toMin(r.time) === toMin(s.time))
  if (marked && has(marked.note, m.mark)) return marked.note
  if (!has(words, m.text)) return null
  const w = m.weekly
  if (w) {
    if (w.also && !w.also.every((a) => has(words, [a]))) return null
    const wd = new Date(`${iso}T12:00:00Z`).getUTCDay() || 7
    if (w.skipWeekdays?.includes(wd) || w.skipDates?.includes(iso)) return null
    if (w.skipPastYearNotes && [...s.note.matchAll(/\b(20\d\d)\b/g)].some((y) => Number(y[1]) < Number(iso.slice(0, 4)))) return null
  }
  return s.note || s.type
}

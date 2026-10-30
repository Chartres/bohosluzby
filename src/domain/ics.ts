// iCalendar (RFC 5545) export. Unrestricted weekly services carry an RRULE,
// note-restricted ones a year-long RRULE (UNTIL) minus the dates the note excludes (EXDATE). Times are Prague wall clock
// via TZID + an explicit VTIMEZONE so every client agrees across DST.
import type { Church, ExtraService, Service } from './data'
import { nextOccurrences, pragueToday, pragueMinutes } from './occurrences'
import { runsAt } from './notes'
import { churchUrl } from './site'

const BYDAY: Record<string, string> = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU' }

// Europe/Prague since 1996: CET/CEST with the EU rules. Static block is correct
// for all upcoming dates.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Prague',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19970330T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19971026T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

const escapeText = (s: string): string =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n')

/** RFC 5545 §3.1 line folding: at most 75 octets per line (UTF-8 — Czech
 * letters and "—" are multi-byte), continuation lines start with a space, and
 * a character is never split across lines. */
const utf8 = new TextEncoder()
const foldLine = (line: string): string => {
  let out = ''
  let octets = 0
  for (const ch of line) {
    const n = utf8.encode(ch).length
    if (octets + n > 75) {
      out += '\r\n '
      octets = 1
    }
    out += ch
    octets += n
  }
  return out
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Export horizon for note-restricted services: one year, the same reach as
 * the reminder (a June-to-September mass seen in October still exports). */
const HORIZON_DAYS = 366

/** A weekly or one-off service as the occurrence maths' spec. */
export const specOf = (s: Service | ExtraService) =>
  'days' in s ? { days: s.days, time: s.time } : { date: s.date, time: s.time }

/** VCALENDAR text for one service of a church, or null when the service has no
 * occurrence within a year (past one-off, unparsable time, note excludes all).
 * A weekly service whose note excludes some dates ("1. týden v měsíci", "od 1.6.
 * do 30.9.") becomes ONE series — deletable as one in the calendar — running to
 * the last date the app itself lists in the next year, with every other date
 * excluded; an unrestricted one keeps an open-ended weekly RRULE. */
export function buildICS(
  church: Church,
  service: Service | ExtraService,
  now: Date,
  /** once: only the next occurrence (no RRULE) — the web's "připomenout";
   * alarmMin: a VALARM that many minutes before the start */
  opts: { once?: boolean; alarmMin?: number } = {},
): string | null {
  const all = nextOccurrences(specOf(service), now, HORIZON_DAYS)
  const runsOn = all.filter((occ) => runsAt(service.note, occ))
  if (runsOn.length === 0) return null
  const occs = opts.once ? runsOn.slice(0, 1) : runsOn
  const weekly = 'days' in service && !opts.once
  const restricted = weekly && occs.length < all.length

  const type = service.type || 'bohoslužba'
  const summary = `${type.charAt(0).toUpperCase()}${type.slice(1)} — ${church.name}`
  const url = churchUrl(church.id)
  const uid = `${church.id}-${'days' in service ? service.days : service.date}-${service.time}${opts.once ? `-${runsOn[0].getTime()}` : ''}`
  const utc = (at: Date) => at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const dtstamp = utc(now)

  // M-3: derive hh/mm from the occurrence instant, not service.time string, to
  // avoid NaN when the registry stores times with a suffix ("10:00 pouze").
  const local = (at: Date): string => {
    const w = pragueToday(at)
    const totalMin = pragueMinutes(at)
    return `${w.y}${pad(w.m)}${pad(w.d)}T${pad(Math.floor(totalMin / 60))}${pad(totalMin % 60)}00`
  }
  const first = occs[0]
  const last = occs[occs.length - 1]
  const runs = new Set(occs.map((o) => o.getTime()))
  const excluded = weekly ? all.filter((o) => o > first && o < last && !runs.has(o.getTime())) : []
  const event = [
    'BEGIN:VEVENT',
    `UID:${uid}@bohosluzby.dravec.org`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Europe/Prague:${local(first)}`,
    'DURATION:PT1H', // ponytail: the registry has no end times; an hour is the honest default
    ...(weekly
      ? [`RRULE:FREQ=WEEKLY;BYDAY=${[...service.days].map((d) => BYDAY[d]).filter(Boolean).join(',')}${restricted ? `;UNTIL=${utc(last)}` : ''}`]
      : []),
    ...(excluded.length ? [`EXDATE;TZID=Europe/Prague:${excluded.map(local).join(',')}`] : []),
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText([church.name, church.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escapeText(`${service.note ? `${service.note}\n` : ''}${url}\nÚdaje z rejstříku ČBK — ověřte ve farnosti.`)}`,
    `URL:${url}`,
    ...(opts.alarmMin
      ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(summary)}`, `TRIGGER:-PT${opts.alarmMin}M`, 'END:VALARM']
      : []),
    'END:VEVENT',
  ]
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//bohosluzby.dravec.org//CS', ...VTIMEZONE, ...event, 'END:VCALENDAR']
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

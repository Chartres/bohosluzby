// iCalendar (RFC 5545) export: one VEVENT per service. Weekly services carry
// an RRULE; times are Prague wall clock via TZID + an explicit VTIMEZONE so
// every client agrees across DST.
import type { Church, ExtraService, Service } from './data'
import { nextOccurrences, pragueToday } from './occurrences'

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
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

const pad = (n: number) => String(n).padStart(2, '0')

/** VEVENT text for one service of a church, or null when the service has no
 * upcoming occurrence (past one-off, unparsable time). */
export function buildICS(church: Church, service: Service | ExtraService, now: Date): string | null {
  const spec =
    'days' in service ? { days: service.days, time: service.time } : { date: service.date, time: service.time }
  const first = nextOccurrences(spec, now, 8)[0]
  if (!first) return null

  const w = pragueToday(first)
  const [hh, mm] = service.time.split(':').map(Number)
  const dtstart = `${w.y}${pad(w.m)}${pad(w.d)}T${pad(hh)}${pad(mm)}00`
  const type = service.type || 'bohoslužba'
  const summary = `${type.charAt(0).toUpperCase()}${type.slice(1)} — ${church.name}`
  const url = `https://bohosluzby.dravec.org/kostel/${church.id}/`
  const uid = `${church.id}-${'days' in service ? service.days : service.date}-${service.time}@bohosluzby.dravec.org`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//bohosluzby.dravec.org//CS',
    ...VTIMEZONE,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`,
    `DTSTART;TZID=Europe/Prague:${dtstart}`,
    'DURATION:PT1H', // ponytail: the registry has no end times; an hour is the honest default
    ...('days' in service
      ? [`RRULE:FREQ=WEEKLY;BYDAY=${[...service.days].map((d) => BYDAY[d]).filter(Boolean).join(',')}`]
      : []),
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText([church.name, church.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escapeText(`${service.note ? `${service.note}\n` : ''}${url}\nÚdaje z rejstříku ČBK — ověřte ve farnosti.`)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}

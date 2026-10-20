import { buildICS } from './ics'
import type { Church, ExtraService, Service } from './data'

const church: Church = {
  id: '42',
  name: 'kostel sv. Havla',
  city: 'Praha 1',
  lat: 50.0855,
  lng: 14.4229,
  barrierFree: false,
  cell: '50-14',
}
const weekly: Service = { days: '135', time: '18:00', lang: 'česky', greek: false, type: 'mše sv.', note: '' }
// Friday 3 Jul 2026 17:00 Prague
const now = new Date('2026-07-03T15:00:00Z')

describe('buildICS', () => {
  it('weekly service: TZID DTSTART at the next occurrence + weekly RRULE', () => {
    const ics = buildICS(church, weekly, now)!
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('TZID:Europe/Prague') // VTIMEZONE present
    // next Mon/Wed/Fri occurrence after Friday 17:00 is Friday 18:00 today
    expect(ics).toContain('DTSTART;TZID=Europe/Prague:20260703T180000')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR')
    expect(ics).toContain('SUMMARY:Mše sv. — kostel sv. Havla')
    expect(ics).toContain('LOCATION:kostel sv. Havla\\, Praha 1')
    expect(ics).toContain('URL:https://bohosluzby.dravec.org/kostel/42/')
    expect(ics).toContain('DURATION:PT1H')
    // CRLF line endings per RFC 5545
    expect(ics).toContain('\r\n')
  })

  it('one-off service: no RRULE, exact date', () => {
    const oneOff: ExtraService = { date: '2026-07-05', time: '15:00', lang: 'česky', greek: false, type: 'pobožnost', note: 'první neděle' }
    const ics = buildICS(church, oneOff, now)!
    expect(ics).toContain('DTSTART;TZID=Europe/Prague:20260705T150000')
    expect(ics).not.toContain('RRULE:FREQ=WEEKLY')
    expect(ics).toContain('SUMMARY:Pobožnost — kostel sv. Havla')
    expect(ics).toContain('první neděle')
  })

  it('past one-off yields null', () => {
    const past: ExtraService = { date: '2026-01-06', time: '18:00', lang: 'česky', greek: false, type: 'mše sv.', note: '' }
    expect(buildICS(church, past, now)).toBeNull()
  })

  it('M-2: DTSTART skips excluded dates (kromě července a srpna)', () => {
    // now = 3 Jul 2026; note excludes July+August → first valid DTSTART should be Sep
    const summerSkip: Service = { days: '7', time: '10:00', lang: 'česky', greek: false, type: 'mše sv.', note: 'kromě července a srpna' }
    const ics = buildICS(church, summerSkip, now)!
    expect(ics).not.toBeNull()
    // DTSTART must be in September or later, not July or August
    const dtstart = ics.match(/DTSTART;TZID=Europe\/Prague:(\d{8})/)?.[1] ?? ''
    const month = parseInt(dtstart.slice(4, 6), 10)
    expect(month).toBeGreaterThanOrEqual(9)
  })

  it('M-3: suffixed time ("10:00 pouze") does not produce NaN in DTSTART', () => {
    const suffixed: Service = { days: '7', time: '10:00 pouze', lang: 'česky', greek: false, type: 'mše sv.', note: '' }
    const ics = buildICS(church, suffixed, now)!
    expect(ics).not.toBeNull()
    expect(ics).not.toContain('NaN')
    expect(ics).toContain('T100000')
  })
})

describe('buildICS — note-restricted weekly services (sweep F1)', () => {
  const dtstarts = (ics: string) => [...ics.matchAll(/DTSTART;TZID=Europe\/Prague:(\d{8})T/g)].map((m) => m[1])

  it('"1x za měsíc, 1. týden v měsíci" lists only first-week Saturdays, no weekly RRULE', () => {
    const monthly: Service = { days: '6', time: '17:00', lang: 'česky', greek: false, type: 'mše sv.', note: '1x za měsíc, 1. týden v měsíci' }
    const ics = buildICS(church, monthly, now)!
    expect(ics).not.toContain('RRULE:FREQ=WEEKLY')
    const dates = dtstarts(ics)
    expect(dates[0]).toBe('20260704')
    expect(dates.length).toBeGreaterThanOrEqual(12)
    expect(dates.length).toBeLessThanOrEqual(13)
    for (const d of dates) expect(Number(d.slice(6))).toBeLessThanOrEqual(7)
    expect(new Set(ics.match(/^UID:.*$/gm)).size).toBe(dates.length) // one UID per event
  })

  it('"období od 1.6. do 30.9." never lands in winter', () => {
    const summer: Service = { days: '2', time: '18:00', lang: 'česky', greek: false, type: 'mše sv.', note: 'období od 1.6. do 30.9.' }
    const ics = buildICS(church, summer, new Date('2026-10-20T10:00:00Z'))!
    expect(ics).not.toBeNull() // next June is within the export horizon
    expect(ics).not.toContain('RRULE:FREQ=WEEKLY')
    for (const d of dtstarts(ics)) {
      const m = Number(d.slice(4, 6))
      expect(m >= 6 && m <= 9).toBe(true)
    }
  })

  it('a note that excludes nothing keeps the open-ended weekly RRULE', () => {
    const ics = buildICS(church, { ...weekly, note: 'pro děti' }, now)!
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR')
    expect(dtstarts(ics)).toHaveLength(1)
  })
})

it('folds lines at 75 octets, counting UTF-8 bytes, without splitting a character (sweep F7)', () => {
  const longName: Church = { ...church, name: 'kostel Nejsvětějšího Srdce Páně a Panny Marie Růžencové — Žďár nad Sázavou' }
  const ics = buildICS(longName, weekly, now)!
  const enc = new TextEncoder()
  for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75)
  const unfolded = ics.replace(/\r\n /g, '')
  expect(unfolded).toContain(`SUMMARY:Mše sv. — ${longName.name}`)
})

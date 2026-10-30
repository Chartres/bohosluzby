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

describe('buildICS — note-restricted weekly services (sweep F1, G2)', () => {
  const unfold = (ics: string) => ics.replace(/\r\n /g, '')
  const dtstarts = (ics: string) => [...ics.matchAll(/DTSTART;TZID=Europe\/Prague:(\d{8})T/g)].map((m) => m[1])
  const exdates = (ics: string) =>
    (unfold(ics).match(/^EXDATE;TZID=Europe\/Prague:(.*)$/m)?.[1] ?? '').split(',').filter(Boolean).map((d) => d.slice(0, 8))

  it('"1x za měsíc, 1. týden v měsíci" is ONE series: RRULE until a year out, other Saturdays excluded', () => {
    const monthly: Service = { days: '6', time: '17:00', lang: 'česky', greek: false, type: 'mše sv.', note: '1x za měsíc, 1. týden v měsíci' }
    const ics = buildICS(church, monthly, now)!
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1) // deletable as one series
    expect(dtstarts(ics)).toEqual(['20260704'])
    expect(ics).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=2027\d{4}T\d{6}Z/)
    const ex = exdates(ics)
    expect(ex).toContain('20260711')
    expect(ex.length).toBeGreaterThan(30)
    for (const d of ex) expect(Number(d.slice(6))).toBeGreaterThan(7) // never a first-week Saturday
    expect(ex[0]).toBe('20260711')
    expect(unfold(ics)).toContain('EXDATE;TZID=Europe/Prague:20260711T170000,')
  })

  it('"období od 1.6. do 30.9." never lands in winter', () => {
    const summer: Service = { days: '2', time: '18:00', lang: 'česky', greek: false, type: 'mše sv.', note: 'období od 1.6. do 30.9.' }
    const ics = buildICS(church, summer, new Date('2026-10-20T10:00:00Z'))!
    expect(ics).not.toBeNull() // next June is within the export horizon
    expect(dtstarts(ics)).toEqual(['20270601'])
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20270928T160000Z') // last Tuesday of September
    expect(ics).not.toContain('EXDATE')
  })

  it('a dated-only exclusion ("kromě 2. 11. 2026") keeps open-ended RRULE and adds EXDATE', () => {
    // Oct 1 → first Mon = Oct 5; Nov 2 (Mon, All Souls Day) is excluded mid-series
    const testNow = new Date('2026-10-01T08:00:00Z')
    const withDateExcl: Service = { days: '1', time: '09:00', lang: 'česky', greek: false, type: 'mše sv.', note: 'kromě 2. 11. 2026' }
    const ics = buildICS(church, withDateExcl, testNow)!
    expect(ics).not.toBeNull()
    expect(ics).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=MO\r\n/) // open-ended — no UNTIL
    expect(ics).not.toContain(';UNTIL=')
    expect(unfold(ics)).toContain('20261102') // EXDATE for the one-off
  })

  it('G2: dated exclusion on the last horizon occurrence is included in EXDATE', () => {
    // Sep 27 2027 is the last Monday within 366 days of Oct 1 2026; excluding it
    // must still produce an EXDATE even though it falls after `last` (Sep 20 2027).
    const withLastExcl: Service = { days: '1', time: '09:00', lang: 'česky', greek: false, type: 'mše sv.', note: 'kromě 27. 9. 2027' }
    const ics = buildICS(church, withLastExcl, new Date('2026-10-01T08:00:00Z'))!
    expect(ics).not.toBeNull()
    expect(ics).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=MO\r\n/) // open-ended — no UNTIL
    expect(unfold(ics)).toContain('20270927') // EXDATE must include the horizon-end excluded date
  })

  it('a note that excludes nothing keeps the open-ended weekly RRULE', () => {
    const ics = buildICS(church, { ...weekly, note: 'pro děti' }, now)!
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\n')
    expect(ics).not.toContain('EXDATE')
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

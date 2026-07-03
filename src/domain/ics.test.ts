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
})

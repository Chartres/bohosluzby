// The quiet holy-day line: on the eve (and the day) of a solemnity the app
// says so in one line and offers tomorrow's services. Never a notification.
// Sundays are skipped — every Sunday is one, and the line would be noise.
import { holyDayLine } from './holyday'

// noon Prague wall clock on a given date
const at = (iso: string) => new Date(`${iso}T10:00:00Z`)

it('the eve of All Saints offers tomorrow (2027)', () => {
  expect(holyDayLine(at('2027-10-31'))).toEqual({ when: 'tomorrow', feast: 'Všech svatých' }) // 1 Nov 2027 is a Monday
})

it('on the day it names today', () => {
  // 2026-12-08 is a Tuesday
  expect(holyDayLine(at('2026-12-08'))).toEqual({ when: 'today', feast: 'Neposkvrněného početí Panny Marie' })
})

it('Christmas Eve and New Year’s Eve', () => {
  expect(holyDayLine(at('2026-12-24'))).toEqual({ when: 'tomorrow', feast: 'Narození Páně' })
  expect(holyDayLine(at('2026-12-31'))).toEqual({ when: 'tomorrow', feast: 'Matky Boží, Panny Marie' })
})

it('movable: the eve of the Ascension (Easter 2027 = 28 Mar → Thu 6 May)', () => {
  expect(holyDayLine(at('2027-05-05'))).toEqual({ when: 'tomorrow', feast: 'Nanebevstoupení Páně' })
})

it('quiet on ordinary days and when the solemnity falls on a Sunday', () => {
  expect(holyDayLine(at('2026-10-20'))).toBeNull()
  // 2026-11-01 is a Sunday → nothing on the 31st's "tomorrow" either
  expect(holyDayLine(at('2026-11-01'))).toBeNull()
})

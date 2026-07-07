// "Kdy" windowing: time-of-day bands + "kolem HH:MM" (±90 min, circular —
// midnight-adjacent times must not fall off the clock edge).
import { describe, expect, it } from 'vitest'
import {
  HALF_HOURS,
  bandFullyPast,
  halfHoursFrom,
  matchesCas,
  parseCas,
  resolveCasDay,
} from './timeband'

describe('parseCas (?cas= validation)', () => {
  it('accepts band names', () => {
    for (const band of ['rano', 'dopoledne', 'odpoledne', 'vecer']) {
      expect(parseCas(band)).toBe(band)
    }
  })
  it('accepts HH:MM (half-hour values pass through, zero-padded)', () => {
    expect(parseCas('18:00')).toBe('18:00')
    expect(parseCas('9:30')).toBe('09:30')
    expect(parseCas('00:00')).toBe('00:00')
  })
  it('rounds old minute-precision links to the nearest half-hour', () => {
    expect(parseCas('9:05')).toBe('09:00')
    expect(parseCas('9:15')).toBe('09:30') // .5 rounds up
    expect(parseCas('17:44')).toBe('17:30')
    expect(parseCas('17:46')).toBe('18:00')
    expect(parseCas('23:50')).toBe('00:00') // wraps, doesn't invent 24:00
  })
  it('HALF_HOURS is the 48-step day, each value canonical', () => {
    expect(HALF_HOURS).toHaveLength(48)
    expect(HALF_HOURS[0]).toBe('00:00')
    expect(HALF_HOURS[47]).toBe('23:30')
    for (const t of HALF_HOURS) expect(parseCas(t)).toBe(t)
  })
  it('halfHoursFrom opens the list at the next half-hour, not midnight', () => {
    // 2026-07-03T08:00:00Z = 10:00 Prague (CEST) — exactly on a slot: keep it first
    const opts = halfHoursFrom(new Date('2026-07-03T08:00:00Z'))
    expect(opts[0]).toBe('10:00')
    expect(opts).toHaveLength(48)
    expect(opts[47]).toBe('09:30')
    expect(new Set(opts).size).toBe(48) // still the whole day, just rotated
  })
  it('halfHoursFrom rounds a mid-slot time up', () => {
    // 10:10 Prague → next slot is 10:30
    expect(halfHoursFrom(new Date('2026-07-03T08:10:00Z'))[0]).toBe('10:30')
  })
  it('halfHoursFrom wraps at the clock edge', () => {
    // 23:50 Prague → 00:00, not 24:00
    expect(halfHoursFrom(new Date('2026-07-03T21:50:00Z'))[0]).toBe('00:00')
  })
  it('rejects garbage', () => {
    expect(parseCas(null)).toBeNull()
    expect(parseCas('')).toBeNull()
    expect(parseCas('vecerni')).toBeNull()
    expect(parseCas('24:00')).toBeNull()
    expect(parseCas('18:60')).toBeNull()
    expect(parseCas('9:5')).toBeNull()
    expect(parseCas('kolem 9')).toBeNull()
  })
})

describe('matchesCas — bands', () => {
  it('ráno = do 10:00', () => {
    expect(matchesCas('rano', '00:00')).toBe(true)
    expect(matchesCas('rano', '06:30')).toBe(true)
    expect(matchesCas('rano', '09:59')).toBe(true)
    expect(matchesCas('rano', '10:00')).toBe(false)
  })
  it('dopoledne = 10:00–13:00', () => {
    expect(matchesCas('dopoledne', '09:59')).toBe(false)
    expect(matchesCas('dopoledne', '10:00')).toBe(true)
    expect(matchesCas('dopoledne', '12:59')).toBe(true)
    expect(matchesCas('dopoledne', '13:00')).toBe(false)
  })
  it('odpoledne = 13:00–17:00', () => {
    expect(matchesCas('odpoledne', '13:00')).toBe(true)
    expect(matchesCas('odpoledne', '16:59')).toBe(true)
    expect(matchesCas('odpoledne', '17:00')).toBe(false)
  })
  it('večer = od 17:00', () => {
    expect(matchesCas('vecer', '16:59')).toBe(false)
    expect(matchesCas('vecer', '17:00')).toBe(true)
    expect(matchesCas('vecer', '23:59')).toBe(true)
  })
  it('tolerates registry time suffixes ("18:00 (letní)")', () => {
    expect(matchesCas('vecer', '18:00 (letní)')).toBe(true)
    expect(matchesCas('vecer', 'dle ohlášení')).toBe(false)
  })
})

// Prague CEST (+2): 18:00Z = 20:00, 08:30Z = 10:30 wall clock
const EVENING = new Date('2026-07-06T18:00:00Z')
const MIDMORNING = new Date('2026-07-06T08:30:00Z')

describe('bandFullyPast / resolveCasDay — impossible den×kdy combos', () => {
  it('in the evening every band but večer is fully past', () => {
    expect(bandFullyPast('rano', EVENING)).toBe(true)
    expect(bandFullyPast('dopoledne', EVENING)).toBe(true)
    expect(bandFullyPast('odpoledne', EVENING)).toBe(true)
    expect(bandFullyPast('vecer', EVENING)).toBe(false)
  })
  it('a partially-past band is not fully past (10:30 → dopoledne still runs)', () => {
    expect(bandFullyPast('rano', MIDMORNING)).toBe(true) // do 10:00, it is 10:30
    expect(bandFullyPast('dopoledne', MIDMORNING)).toBe(false)
  })
  it('kolem times and empty cas are never "fully past" (circular window)', () => {
    expect(bandFullyPast('06:00', EVENING)).toBe(false)
    expect(bandFullyPast(null, EVENING)).toBe(false)
  })
  it('hned + fully-past band jumps to zítra; HNED semantics otherwise preserved', () => {
    expect(resolveCasDay('now', 'rano', EVENING)).toBe(1) // evening + ráno → zítra ráno
    expect(resolveCasDay('now', 'vecer', EVENING)).toBe('now')
    expect(resolveCasDay('now', 'dopoledne', MIDMORNING)).toBe('now') // partial → keep hned
    expect(resolveCasDay('now', '06:00', EVENING)).toBe('now') // kolem never jumps
    expect(resolveCasDay('now', null, EVENING)).toBe('now')
  })
  it('an explicit day is never overridden', () => {
    expect(resolveCasDay(0, 'rano', EVENING)).toBe(0) // dnes + ráno stays an honest empty
    expect(resolveCasDay(3, 'rano', EVENING)).toBe(3)
  })
})

describe('matchesCas — kolem HH:MM (±90 min)', () => {
  it('plain window around 09:00', () => {
    expect(matchesCas('9:00', '07:30')).toBe(true)
    expect(matchesCas('9:00', '10:30')).toBe(true)
    expect(matchesCas('9:00', '07:29')).toBe(false)
    expect(matchesCas('9:00', '10:31')).toBe(false)
  })
  it('window wraps past midnight (kolem 23:30)', () => {
    expect(matchesCas('23:30', '22:00')).toBe(true)
    expect(matchesCas('23:30', '23:59')).toBe(true)
    expect(matchesCas('23:30', '00:59')).toBe(true) // next-day edge, 89 min away
    expect(matchesCas('23:30', '01:00')).toBe(true) // exactly 90
    expect(matchesCas('23:30', '01:01')).toBe(false)
    expect(matchesCas('23:30', '21:59')).toBe(false)
  })
  it('window wraps before midnight (kolem 00:30)', () => {
    expect(matchesCas('00:30', '23:00')).toBe(true) // previous-day edge, exactly 90
    expect(matchesCas('00:30', '02:00')).toBe(true)
    expect(matchesCas('00:30', '22:59')).toBe(false)
    expect(matchesCas('00:30', '02:01')).toBe(false)
  })
})

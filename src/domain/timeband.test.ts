// "Kdy" windowing: time-of-day bands + "kolem HH:MM" (±90 min, circular —
// midnight-adjacent times must not fall off the clock edge).
import { describe, expect, it } from 'vitest'
import { matchesCas, parseCas } from './timeband'

describe('parseCas (?cas= validation)', () => {
  it('accepts band names', () => {
    for (const band of ['rano', 'dopoledne', 'odpoledne', 'vecer']) {
      expect(parseCas(band)).toBe(band)
    }
  })
  it('accepts HH:MM', () => {
    expect(parseCas('18:00')).toBe('18:00')
    expect(parseCas('9:05')).toBe('9:05')
    expect(parseCas('00:00')).toBe('00:00')
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

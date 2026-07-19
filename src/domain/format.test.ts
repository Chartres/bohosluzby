import {
  fmtDistance,
  fmtTime,
  fmtUntil,
  fmtWeekdayShort,
  dayLabel,
  fmtDateCz,
  normalizeLang,
  samePragueDay,
} from './format'

const now = new Date('2026-07-03T08:00:00Z') // Friday 10:00 Prague

describe('fmtUntil', () => {
  it('minutes', () => {
    expect(fmtUntil(now, new Date('2026-07-03T08:38:00Z'))).toBe('za 38 min')
  })
  it('starting now', () => {
    expect(fmtUntil(now, new Date('2026-07-03T08:00:30Z'))).toBe('právě začíná')
  })
  it('hours + minutes', () => {
    expect(fmtUntil(now, new Date('2026-07-03T10:30:00Z'))).toBe('za 2 h 30 min')
    expect(fmtUntil(now, new Date('2026-07-03T11:00:00Z'))).toBe('za 3 h')
  })
  it('days (Czech plurals)', () => {
    expect(fmtUntil(now, new Date('2026-07-04T08:00:00Z'))).toBe('za 1 den')
    expect(fmtUntil(now, new Date('2026-07-05T08:00:00Z'))).toBe('za 2 dny')
    expect(fmtUntil(now, new Date('2026-07-08T09:00:00Z'))).toBe('za 5 dní')
  })
})

describe('fmtDistance', () => {
  it('metres under a kilometre', () => {
    expect(fmtDistance(0.32)).toBe('300 m')
  })
  it('floors at "do 100 m" (city-centroid origins)', () => {
    expect(fmtDistance(0.004)).toBe('do 100 m')
  })
  it('kilometres with a Czech decimal comma', () => {
    expect(fmtDistance(2.44)).toBe('2,4 km')
  })
})

describe('normalizeLang (registry values → consistent Czech lowercase)', () => {
  it('Czech and empty collapse to "česky"', () => {
    expect(normalizeLang('česky')).toBe('česky')
    expect(normalizeLang('čeština')).toBe('česky')
    expect(normalizeLang('')).toBe('česky')
  })
  it('Latin variants', () => {
    expect(normalizeLang('Latine')).toBe('latinsky')
    expect(normalizeLang('latina')).toBe('latinsky')
    expect(normalizeLang('latinsky (trident)')).toBe('latinsky (tridentská)')
  })
  it('foreign endonyms become Czech adverbs', () => {
    expect(normalizeLang('English')).toBe('anglicky')
    expect(normalizeLang('po polsku')).toBe('polsky')
    expect(normalizeLang('deutsch')).toBe('německy')
    expect(normalizeLang('en español')).toBe('španělsky')
    expect(normalizeLang('en français')).toBe('francouzsky')
    expect(normalizeLang('italiana')).toBe('italsky')
    expect(normalizeLang('magyarul')).toBe('maďarsky')
    expect(normalizeLang('Viet nam')).toBe('vietnamsky')
    expect(normalizeLang('Filipino')).toBe('filipínsky')
  })
  it('unknown values pass through lowercased', () => {
    expect(normalizeLang('Esperanto')).toBe('esperanto')
  })
})

describe('fmtDateCz', () => {
  it('formats an ISO date as Czech', () => {
    expect(fmtDateCz('2026-01-30')).toBe('30. 1. 2026')
  })
  it('returns empty for garbage', () => {
    expect(fmtDateCz('')).toBe('')
  })
})

describe('fmtTime / dayLabel (Europe/Prague)', () => {
  it('formats wall-clock time in Prague', () => {
    expect(fmtTime(new Date('2026-07-03T16:00:00Z'))).toBe('18:00')
  })
  it('dnes / zítra / weekday with date', () => {
    expect(dayLabel(now, new Date('2026-07-03T16:00:00Z'))).toBe('dnes')
    expect(dayLabel(now, new Date('2026-07-04T07:00:00Z'))).toBe('zítra')
    expect(dayLabel(now, new Date('2026-07-06T07:00:00Z'))).toBe('pondělí 6. 7.')
  })
})

describe('samePragueDay / fmtWeekdayShort (the map chip day check)', () => {
  it('Prague midnight, not UTC midnight, is the day boundary', () => {
    // 22:30 UTC Friday = 00:30 Saturday in Prague (CEST)
    expect(samePragueDay(now, new Date('2026-07-03T22:30:00Z'))).toBe(false)
    expect(samePragueDay(now, new Date('2026-07-03T16:00:00Z'))).toBe(true)
  })
  it('short Czech weekday, no trailing dot', () => {
    expect(fmtWeekdayShort(new Date('2026-07-07T10:00:00Z'))).toBe('út')
    expect(fmtWeekdayShort(new Date('2026-07-05T10:00:00Z'))).toBe('ne')
  })
})

import { fmtDistance, fmtTime, fmtUntil, dayLabel } from './format'

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

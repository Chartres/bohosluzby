import { nextOccurrences, pragueInstant, pragueToday } from './occurrences'

// Europe/Prague is UTC+2 in summer (CEST), UTC+1 in winter (CET).

describe('pragueInstant', () => {
  it('summer: 18:00 Prague = 16:00 UTC', () => {
    expect(pragueInstant(2026, 7, 3, 18, 0).toISOString()).toBe('2026-07-03T16:00:00.000Z')
  })
  it('winter: 18:00 Prague = 17:00 UTC', () => {
    expect(pragueInstant(2026, 1, 15, 18, 0).toISOString()).toBe('2026-01-15T17:00:00.000Z')
  })
})

describe('pragueToday', () => {
  it('resolves the Prague calendar date across midnight', () => {
    // 23:30 UTC on 3 Jul = 01:30 on 4 Jul in Prague
    expect(pragueToday(new Date('2026-07-03T23:30:00Z'))).toEqual({ y: 2026, m: 7, d: 4 })
  })
})

describe('nextOccurrences — periodic services', () => {
  // Friday 3 Jul 2026, 10:00 in Prague (08:00 UTC)
  const now = new Date('2026-07-03T08:00:00Z')

  it('same-day service later today is the first occurrence', () => {
    const [first] = nextOccurrences({ days: '5', time: '18:00' }, now)
    expect(first.toISOString()).toBe('2026-07-03T16:00:00.000Z')
  })

  it('a service earlier today rolls to next week', () => {
    const [first] = nextOccurrences({ days: '5', time: '08:00' }, now)
    expect(first.toISOString()).toBe('2026-07-10T06:00:00.000Z')
  })

  it('day-of-week sets produce one occurrence per matching day, sorted', () => {
    const occ = nextOccurrences({ days: '67', time: '09:30' }, now, 8)
    expect(occ.map((d) => d.toISOString())).toEqual([
      '2026-07-04T07:30:00.000Z', // Saturday
      '2026-07-05T07:30:00.000Z', // Sunday
      '2026-07-11T07:30:00.000Z',
    ])
  })

  it('crosses the DST end correctly (25 Oct 2026: CEST→CET)', () => {
    const before = new Date('2026-10-24T08:00:00Z') // Saturday morning
    const occ = nextOccurrences({ days: '7', time: '10:00' }, before, 3)
    // Sunday 25 Oct 10:00 Prague is 09:00 UTC (already CET)
    expect(occ[0].toISOString()).toBe('2026-10-25T09:00:00.000Z')
  })

  it('one-off (extra) services occur exactly once, only if in the future', () => {
    expect(
      nextOccurrences({ date: '2026-07-04', time: '11:00' }, now).map((d) => d.toISOString()),
    ).toEqual(['2026-07-04T09:00:00.000Z'])
    expect(nextOccurrences({ date: '2026-07-01', time: '11:00' }, now)).toEqual([])
  })

  it('ignores unparseable times', () => {
    expect(nextOccurrences({ days: '5', time: '' }, now)).toEqual([])
  })
})

import {
  nextOccurrences,
  nextReminderAt,
  pragueInstant,
  pragueToday,
  recentOccurrence,
} from './occurrences'

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

describe('recentOccurrence — the "you were probably just there" window', () => {
  // Monday 6 Jul 2026, 13:00 Prague (11:00 UTC).
  const now = new Date('2026-07-06T11:00:00Z')
  it('returns a mass that started within the window', () => {
    // 12:00 Monday mass — an hour before now
    const r = recentOccurrence({ days: '1', time: '12:00' }, now, 150)
    expect(r?.toISOString()).toBe('2026-07-06T10:00:00.000Z')
  })
  it('ignores a mass that started longer ago than the window', () => {
    // 07:00 Monday mass is 4h back — outside a 150-min window
    expect(recentOccurrence({ days: '1', time: '07:00' }, now, 150)).toBeNull()
  })
  it('ignores a mass still in the future', () => {
    expect(recentOccurrence({ days: '1', time: '18:00' }, now, 150)).toBeNull()
  })
  it('ignores a service that does not run today', () => {
    expect(recentOccurrence({ days: '7', time: '12:00' }, now, 150)).toBeNull()
  })
})

describe('nextReminderAt', () => {
  // 2026-07-05 and 2026-07-12 are Sundays (same weekday axis as the 10-25 case).
  const sunday10 = { days: '7', time: '10:00' } // weekly Sunday 10:00 Prague

  it('fires leadMinutes before the next occurrence (Sun 10:00 → 09:30 Prague)', () => {
    const now = new Date('2026-07-02T12:00:00Z') // Thursday
    // 2026-07-05 10:00 CEST = 08:00Z; minus 30 min = 07:30Z
    expect(nextReminderAt(sunday10, now, 30)?.toISOString()).toBe('2026-07-05T07:30:00.000Z')
  })

  it('skips a mass already inside the lead window, reaching the next one', () => {
    const now = new Date('2026-07-05T07:45:00Z') // 09:45 Prague, 15 min before the 10:00
    // lead time 07:30Z has passed → next Sunday 2026-07-12
    expect(nextReminderAt(sunday10, now, 30)?.toISOString()).toBe('2026-07-12T07:30:00.000Z')
  })

  it('returns null when there is no upcoming occurrence', () => {
    expect(nextReminderAt({ days: '', time: '10:00' }, new Date('2026-07-02T12:00:00Z'), 30)).toBeNull()
  })
})

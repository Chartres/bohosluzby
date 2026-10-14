import { describe, expect, it } from 'vitest'
import { dayFromParam, dayOptions, dayToParam, litForChoice } from './days'

describe('dayOptions', () => {
  it('on a Sunday, offers NEXT Sunday (the 0..6 window has no future nedele)', () => {
    const sunday = new Date('2026-07-05T10:00:00Z')
    const opts = dayOptions(sunday)
    expect(opts.at(-1)).toMatchObject({ key: 7, label: 'neděle' })
  })
  it('on other days, stops at +6 with one nedele', () => {
    const friday = new Date('2026-07-03T10:00:00Z')
    const labels = dayOptions(friday).map((o) => o.label)
    expect(labels.filter((l) => l === 'neděle')).toHaveLength(1)
    expect(dayOptions(friday).at(-1)?.key).toBe(6)
  })
})

describe('?den= round-trip', () => {
  // Mon 6 Jul … Sun 12 Jul 2026, 10:00 Prague
  const week = [6, 7, 8, 9, 10, 11, 12].map((d) => new Date(Date.UTC(2026, 6, d, 8)))
  it.skip('every picker option decodes back to itself, on every weekday', () => {
    for (const now of week) {
      for (const { key } of dayOptions(now)) {
        expect([now.toISOString(), dayFromParam(now, dayToParam(now, key))]).toEqual([now.toISOString(), key])
      }
    }
  })
  it('dnes / zitra / unknown / absent', () => {
    const now = week[2]
    expect(dayFromParam(now, 'dnes')).toBe(0)
    expect(dayFromParam(now, 'zitra')).toBe(1)
    expect(dayFromParam(now, 'pondelek')).toBe('now')
    expect(dayFromParam(now, null)).toBe('now')
    expect(dayToParam(now, 'now')).toBeNull()
  })
  it('a ?den=nedele bookmark opened on a Sunday still means today', () => {
    expect(dayFromParam(week[6], 'nedele')).toBe(0)
  })
})

describe('litForChoice', () => {
  it('resolves the picked day, not today (5 Jul = Cyril & Methodius)', () => {
    const fri = new Date('2026-07-03T10:00:00Z')
    expect(litForChoice(fri, 2).feast).toMatch(/Cyril/)
    expect(litForChoice(fri, 'now').feast).not.toBe(litForChoice(fri, 2).feast)
  })
})

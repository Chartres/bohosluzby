import { describe, expect, it } from 'vitest'
import { ALL_SOULS, feastWeek, servicesOnDate } from './feastWeek'
import type { ChurchServices } from './data'

const at = (iso: string) => new Date(`${iso}T10:00:00Z`)

describe('feastWeek — a week before 1 Nov through 2 Nov', () => {
  it('is off outside the window', () => {
    expect(feastWeek(at('2026-10-24'))).toBeNull()
    expect(feastWeek(at('2026-11-03'))).toBeNull()
  })
  it('names both days with their distance from today', () => {
    expect(feastWeek(at('2026-10-25'))?.map((f) => f.offset)).toEqual([7, 8])
    expect(feastWeek(at('2026-10-29'))?.map((f) => [f.iso, f.offset])).toEqual([
      ['2026-11-01', 3],
      ['2026-11-02', 4],
    ])
  })
  it('on 1 Nov: today and tomorrow; on 2 Nov: only All Souls', () => {
    expect(feastWeek(at('2026-11-01'))?.map((f) => f.offset)).toEqual([0, 1])
    expect(feastWeek(at('2026-11-02'))).toEqual([{ iso: '2026-11-02', offset: 0, name: ALL_SOULS }])
  })
})

const svc = (over: Partial<ChurchServices>): ChurchServices => ({
  updated: '2026-01-01',
  parish: '',
  parishAddress: '',
  contacts: [],
  regular: [],
  extra: [],
  confession: [],
  ...over,
})
const row = (days: string, time: string, note = '', type = 'mše sv.') => ({ days, time, lang: 'česky', greek: false, type, note })

describe('servicesOnDate', () => {
  it('weekly rows on that weekday plus one-offs, chronological, dated', () => {
    const s = svc({
      regular: [row('7', '10:00'), row('17', '18:00', 'kromě 2. 11. 2026'), row('1', '07:00')],
      extra: [{ date: '2026-11-02', time: '17:00', lang: 'česky', greek: false, type: 'mše sv.', note: '' }],
    })
    expect(servicesOnDate(s, '2026-11-01').map((x) => `${x.date} ${x.time}`)).toEqual(['2026-11-01 10:00', '2026-11-01 18:00'])
    expect(servicesOnDate(s, '2026-11-02').map((x) => x.time)).toEqual(['07:00', '17:00'])
  })
  it('a one-off repeating the weekly Mass prints once', () => {
    const s = svc({
      regular: [row('1', '18:00')],
      extra: [{ date: '2026-11-02', time: '18:00', lang: 'česky', greek: false, type: '', note: '' }],
    })
    expect(servicesOnDate(s, '2026-11-02')).toHaveLength(1)
  })
})

// Sourced corrections (data/corrections.json) must really land in the committed
// shards and in what the feast pages print: a correction that silently fails
// (a typo'd id, a weekly row whose note degrades to "uncertain") would leave
// the wrong time on the busiest weekend of the year.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCorrections, exceptDate, expandCorrections, loadCorrections } from './corrections.mjs'
import { servicesOn } from '../src/domain/feast.ts'

const entry = () => ({
  u: '2015-01-01', p: '', pa: '', c: [],
  s: [['17', '18:00', 'česky', 0, 'mše sv.', ''], ['1', '07:00', 'česky', 0, 'mše sv.', 've školním roce.']],
})

describe('expandCorrections', () => {
  // roráty: one notice names weekdays over four Advent weeks — one entry, ~20 dates
  const src = { id: 'a', church: 'k', town: 't', add: [['06:30', 'mše sv.', 'roráty']], source: 'https://f.cz/ohlasky', source_date: 'ohlášky 22. 11. 2026', quote: 'roráty po–pá v 6:30', checked: '2026-11-23' }

  it('a from/to/days entry becomes one dated entry per matching day, sources kept', () => {
    const out = expandCorrections([{ ...src, from: '2026-11-30', to: '2026-12-06', days: '135' }])
    expect(out.map((c) => c.date)).toEqual(['2026-11-30', '2026-12-02', '2026-12-04'])
    for (const c of out) {
      expect(c).toMatchObject({ id: 'a', source: src.source, source_date: src.source_date, quote: src.quote, add: src.add })
      expect(c).not.toHaveProperty('from')
      expect(c).not.toHaveProperty('days')
    }
  })

  it('except removes named dates (8 Dec, a parish’s own gap); dates lists them outright', () => {
    const out = expandCorrections([{ ...src, from: '2026-12-07', to: '2026-12-11', days: '12345', except: ['2026-12-08'] }])
    expect(out.map((c) => c.date)).toEqual(['2026-12-07', '2026-12-09', '2026-12-10', '2026-12-11'])
    expect(expandCorrections([{ ...src, dates: ['2026-12-05', '2026-12-12'] }]).map((c) => c.date)).toEqual(['2026-12-05', '2026-12-12'])
  })

  it('plain dated entries pass through unchanged', () => {
    const one = { ...src, date: '2026-11-02' }
    expect(expandCorrections([one])).toEqual([one])
  })

  it('refuses a range it cannot read rather than silently adding nothing', () => {
    expect(() => expandCorrections([{ ...src, from: '2026-12-01', days: '135' }])).toThrow(/a k/)
    expect(() => expandCorrections([{ ...src, from: '2026-12-01', to: '2026-11-30', days: '1' }])).toThrow(/a k/)
    expect(() => expandCorrections([{ ...src, from: '2026-12-01', to: '2026-12-03', days: '8' }])).toThrow(/a k/)
    expect(() => expandCorrections([{ ...src, from: '2026-12-01', to: '2026-12-03', days: '6' }])).toThrow(/no date/)
  })
})

describe('applyCorrections', () => {
  // Týn, 22 Nov: the parish notice confirms the roráty the registry already lists
  // (út, so 7:00 "v adventu"). A dated copy would show the same Mass twice in the app.
  it('adds nothing when a weekly row already runs that day at that time; reports it as confirmed', () => {
    const shards = { c: { a: { u: '2016-09-06', p: '', pa: '', c: [], s: [['26', '07:00', 'česky', 0, 'rorátní mše sv.', 'v adventu']] } } }
    const r = applyCorrections(shards, expandCorrections([{ id: 'a', from: '2026-12-01', to: '2026-12-05', days: '26', add: [['07:00', 'mše sv.', 'roráty']], source: 'https://x.cz', source_date: 'ohlášky' }]), '2026-11-22')
    expect(shards.c.a.x).toBeUndefined()
    expect(r.confirmed).toEqual(['a 2026-12-01 =07:00', 'a 2026-12-05 =07:00'])
    expect(r.missing).toEqual([])
  })

  // the app's "roráty" view (Pavol, 22 Nov: option B) must find these too: a confirmed
  // roráty is marked on the entry as `r` [date, time, note]; other confirmations aren't
  it('marks a confirmed roráty as r: [date, time, note]; a confirmed ordinary Mass is not marked', () => {
    const shards = { c: { a: { u: '2016-09-06', p: '', pa: '', c: [], s: [['1234', '06:45', 'česky', 0, 'mše sv.', '']] } } }
    applyCorrections(shards, [
      { id: 'a', date: '2026-11-30', add: [['06:45', 'mše sv.', 'roráty']], source: 'https://x.cz', source_date: 'o' },
      { id: 'a', date: '2026-12-01', add: [['06:45', 'mše sv.']], source: 'https://x.cz', source_date: 'o' },
    ], '2026-11-22')
    expect(shards.c.a.r).toEqual([['2026-11-30', '06:45', 'roráty']])
    applyCorrections(shards, [{ id: 'a', date: '2026-11-30', add: [['06:45', 'mše sv.', 'roráty']], source: 'https://x.cz', source_date: 'o' }], '2026-11-22')
    expect(shards.c.a.r).toHaveLength(1) // idempotent
  })

  it('still adds the dated row when the weekly row does not run that day (its note excludes it)', () => {
    const shards = { c: { a: { u: '2016-09-06', p: '', pa: '', c: [], s: [['2', '07:00', 'česky', 0, 'mše sv.', 'kromě adventu']] } } }
    applyCorrections(shards, [{ id: 'a', date: '2026-12-01', add: [['07:00', 'mše sv.', 'roráty']], source: 'https://x.cz', source_date: 'o' }], '2026-11-22')
    expect(shards.c.a.x).toEqual([['2026-12-01', '07:00', 'česky', 0, 'mše sv.', 'roráty']])
  })

  it('adds a dated one-off and drops a weekly Mass on that date only', () => {
    const shards = { c: { a: entry() } }
    const { applied, missing } = applyCorrections(
      shards,
      [{ id: 'a', date: '2026-11-02', add: [['17:00', 'mše sv.']], drop: ['18:00', '07:00'] }],
      '2026-10-29',
    )
    expect(missing).toEqual([])
    expect(applied).toHaveLength(3)
    const e = shards.c.a
    expect(e.s[0][5]).toBe('kromě 2. 11. 2026')
    expect(e.s[1][5]).toBe('ve školním roce, kromě 2. 11. 2026')
    expect(servicesOn(e, '2026-11-02').map((s) => s.time)).toEqual(['17:00'])
    expect(servicesOn(e, '2026-11-09').map((s) => s.time)).toEqual(['07:00', '18:00'])
    expect(servicesOn(e, '2026-11-01').map((s) => s.time)).toEqual(['18:00'])
  })
  it('is idempotent and reports what it cannot place', () => {
    const shards = { c: { a: entry() } }
    const fix = [{ id: 'a', date: '2026-11-02', add: [['17:00', 'mše sv.']], drop: ['18:00'] }]
    applyCorrections(shards, fix, '2026-10-29')
    const once = JSON.stringify(shards)
    applyCorrections(shards, fix, '2026-10-29')
    expect(JSON.stringify(shards)).toBe(once)
    const r = applyCorrections(shards, [{ id: 'zz', date: '2026-11-02' }, { id: 'a', date: '2026-11-02', drop: ['09:00'] }], '2026-10-29')
    expect(r.missing).toHaveLength(2)
  })
  it('skips past dates', () => {
    const shards = { c: { a: entry() } }
    expect(applyCorrections(shards, [{ id: 'a', date: '2026-11-02', drop: ['18:00'] }], '2026-11-03').applied).toEqual([])
  })
})

// not new URL(…, import.meta.url): Vite rewrites that pattern as an asset URL
const DATA = `${dirname(dirname(fileURLToPath(import.meta.url)))}/public/data`

describe('the committed data carries every correction', () => {
  const index = JSON.parse(readFileSync(`${DATA}/churches.json`, 'utf8'))
  const cellOf = new Map(index.map((r) => [r[0], r[6]]))
  const shard = (cell) => JSON.parse(readFileSync(`${DATA}/services/${cell}.json`, 'utf8'))
  const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5)
  it('the log parses', () => expect(Array.isArray(loadCorrections())).toBe(true))
  for (const c of loadCorrections()) {
    it(`${c.id} ${c.date} (${c.church})`, () => {
      expect(c.source, 'every correction names its source').toMatch(/^https?:\/\//)
      const e = shard(cellOf.get(c.id))[c.id]
      expect(e).toBeTruthy()
      const shown = servicesOn(e, c.date).map((s) => toMin(s.time))
      for (const [t] of c.add ?? []) expect(shown).toContain(toMin(t))
      for (const t of c.drop ?? []) expect(shown).not.toContain(toMin(t))
      const dow = String(new Date(`${c.date}T12:00:00Z`).getUTCDay() || 7)
      for (const t of c.drop ?? [])
        for (const r of e.s.filter((r) => r[0].includes(dow) && toMin(r[1]) === toMin(t) && !/zpov/i.test(r[4])))
          expect(r[5]).toContain(exceptDate(c.date))
    })
  }
})

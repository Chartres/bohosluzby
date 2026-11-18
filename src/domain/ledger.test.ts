// The freshness ledger (/cerstvost/): what the app knows that the register
// doesn't say — how old each entry is, which ones the app flags as stale, the
// sourced corrections, and a few figures computed from the schedules.
import { ledgerMarkdown, ledgerPage, ledgerStats, type LedgerChurch } from './ledger'
import type { RawEntry } from './churchPage'

type Row = RawEntry['s'][number]
const row = (days: string, time: string, type = ''): Row => [days, time, '', 0, type, '']
const entry = (u: string, s: Row[]): RawEntry => ({ u, p: '', pa: '', c: [], s })

const NOW = new Date('2026-11-12T12:00:00Z')
const INDEX: LedgerChurch[] = [
  { id: '10001', name: 'kostel A', city: 'Praha 1' }, // Praha, fresh, Sunday evening Mass
  { id: '10002', name: 'kostel B', city: 'Praha 2' }, // Praha, 2 years old → stale
  { id: '80000001', name: 'kostel C', city: 'Brno' }, // Brno, 8 years old → stale
  { id: '80000002', name: 'kostel D', city: 'Brno' }, // Brno, no schedule entry at all
]
const ENTRIES: Record<string, RawEntry> = {
  '10001': entry('2026-09-01', [row('7', '09:00', 'mše sv.'), row('7', '18:00'), row('6', '17:00'), row('7', '15:00', 'adorace')]),
  '10002': entry('2024-10-01', [row('6', '08:00 - 08:45')]),
  '80000001': entry('2018-05-01', [row('1234567', '07:00', 'mše sv.')]),
}
const CORRECTIONS = [
  { id: '10001', church: 'kostel A', town: 'praha', date: '2026-11-02', add: [['18:00', 'mše sv.']], source: 'https://a.example/', source_date: 'ohlášky 25. 10. 2026', quote: '…', checked: '2026-10-29' },
  { id: '80000001', church: 'kostel C', town: 'brno', date: '2026-11-01', drop: ['07:00'], source: 'https://c.example/', source_date: 'web', quote: '…', checked: '2026-11-01' },
]

describe('ledgerStats', () => {
  const s = ledgerStats({ index: INDEX, entryOf: (id) => ENTRIES[id], corrections: CORRECTIONS, now: NOW })

  it('counts stale entries per diocese with the app’s own 18-month rule', () => {
    const praha = s.dioceses.find((d) => d.key === '1')!
    const brno = s.dioceses.find((d) => d.key === '8')!
    expect(praha).toMatchObject({ churches: 2, withSchedule: 2, stale: 1 })
    expect(brno).toMatchObject({ churches: 2, withSchedule: 1, stale: 1 })
    expect(s.total).toMatchObject({ churches: 4, withSchedule: 3, stale: 2 })
    // a diocese with no churches in the data is left out, not shown as 0 %
    expect(s.dioceses.map((d) => d.key)).toEqual(['1', '8'])
  })

  it('sorts entry ages into buckets that agree with the stale flag', () => {
    const praha = s.dioceses.find((d) => d.key === '1')!
    expect(praha.buckets).toEqual([1, 0, 1, 0, 0]) // ≤6 m · 6–18 m · 18 m–3 y · 3–6 y · >6 y
    expect(s.dioceses.find((d) => d.key === '8')!.buckets).toEqual([0, 0, 0, 0, 1])
    const fresh = s.total.buckets[0] + s.total.buckets[1]
    expect(fresh).toBe(s.total.withSchedule - s.total.stale)
    expect(s.total.oldest).toBe('2018-05-01')
  })

  it('reports the median age in months', () => {
    expect(s.total.medianMonths).toBe(25) // 2, 25, 102 months
  })

  it('counts Sunday Masses, not other services, and evening Sunday Masses', () => {
    // A: 09:00 + 18:00 (blank type = Mass); 15:00 adorace doesn't count. C: daily 07:00.
    expect(s.figures.sundayMasses).toBe(3)
    expect(s.figures.churchesWithSunday).toBe(2)
    expect(s.figures.eveningSunday).toBe(1) // A at 18:00 (≥ 17:00)
    expect(s.figures.saturdayEvening).toBe(1) // A at 17:00 (≥ 16:00); B's Saturday row is 08:00
    expect(s.dioceses.find((d) => d.key === '1')!.sundayMasses).toBe(2)
  })

  it('lists corrections newest first with the church’s own town', () => {
    expect(s.corrections.map((c) => c.id)).toEqual(['10001', '80000001'])
    expect(s.corrections[0]).toMatchObject({ city: 'Praha 1', change: 'doplněno 18:00 mše sv.' })
    expect(s.corrections[1]).toMatchObject({ city: 'Brno', change: 'nekoná se 07:00' })
  })
})

describe('ledgerPage and its Markdown twin', () => {
  const s = ledgerStats({ index: INDEX, entryOf: (id) => ENTRIES[id], corrections: CORRECTIONS, now: NOW })
  const page = ledgerPage(s, '2026-11-12')
  const md = ledgerMarkdown(s, '2026-11-12')

  it('is dated, sourced and canonical', () => {
    expect(page.url).toBe('https://bohosluzby.dravec.org/cerstvost/')
    expect(page.title).toContain('Čerstvost')
    expect(page.body).toContain('12. 11. 2026')
    expect(page.body).toContain('bohosluzby.cirkev.cz')
    expect(page.body).toContain('href="https://a.example/"')
    expect(JSON.parse(page.jsonLd)['@type']).toBe('Dataset')
  })

  it('offers no bulk download', () => {
    expect(page.body).not.toMatch(/\.(csv|json)"/)
    expect(md).not.toMatch(/\.(csv|json)\)/)
  })

  it('says the same numbers in Markdown', () => {
    expect(md).toContain('Stav k 12. 11. 2026')
    expect(md).toMatch(/\| Arcidiecéze pražská \| 2 \| 1 \| 50 % \|/)
    expect(md).toContain('[a.example](https://a.example/)')
  })

  it('escapes registry text', () => {
    const evil = ledgerStats({
      index: [{ id: '10001', name: 'kostel <b>', city: 'Praha' }],
      entryOf: () => undefined,
      corrections: [{ ...CORRECTIONS[0], church: 'kostel <b>' }],
      now: NOW,
    })
    expect(ledgerPage(evil, '2026-11-12').body).not.toContain('<b>')
  })
})

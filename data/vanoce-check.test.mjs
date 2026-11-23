// Christmas pass (docs/VANOCE-PASS.md): a batch of records is checked before it goes into
// data/corrections.json — every record names its source, is dated 24 Dec (from 15:00),
// 25 or 26 Dec of this Christmas, and shows up on its town's /vanoce/ page.
import { describe, it, expect } from 'vitest'
import { checkVanoce } from './vanoce-check.mjs'

// 25 Dec 2026 is a Friday: the church has a weekly Friday 9:00 Mass
const entry = () => ({ u: '2016-09-06', p: '', pa: '', c: [], s: [['5', '09:00', 'česky', 0, 'mše sv.', '']] })
const shards = () => ({ c: { a: entry() } })
const names = { a: { name: 'kostel sv. Michala', town: 'Brno' } }
const rec = (over = {}) => ({
  id: 'a',
  church: 'kostel sv. Michala',
  town: 'brno',
  date: '2026-12-24',
  add: [['24:00', 'mše sv.', 'půlnoční']],
  source: 'https://f.cz/vanoce-2026.pdf',
  source_date: 'vánoční pořad bohoslužeb 2026',
  quote: 'Štědrý den: půlnoční mše sv. ve 24:00 u sv. Michala',
  checked: '2026-12-14',
  ...over,
})
const run = (records) => checkVanoce({ records, shards: shards(), names, today: '2026-12-14' })

describe('checkVanoce', () => {
  it('a good record passes and prints the row the page will show', () => {
    const r = run([rec()])
    expect(r.errors).toEqual([])
    expect(r.rows).toEqual(['Brno · 24. 12. 24:00 kostel sv. Michala — půlnoční — vánoční pořad bohoslužeb 2026 <https://f.cz/vanoce-2026.pdf>'])
  })

  it('a notice that confirms the weekly Friday Mass on 25 Dec is still on the page', () => {
    const r = run([rec({ date: '2026-12-25', add: [['09:00', 'mše sv.', 'slavnost Narození Páně']] })])
    expect(r.errors).toEqual([])
    expect(r.rows[0]).toContain('25. 12. 09:00')
  })

  it('needs an http(s) source, its date and a quote', () => {
    const e = run([rec({ source: 'farnost', source_date: '', quote: '' })]).errors.join('\n')
    expect(e).toMatch(/source/)
    expect(e).toMatch(/source_date/)
    expect(e).toMatch(/quote/)
  })

  it('only 24 Dec from 15:00, 25 and 26 Dec of this Christmas', () => {
    expect(run([rec({ date: '2026-12-27' })]).errors.join('\n')).toMatch(/24\. – 26\. 12\./)
    expect(run([rec({ date: '2025-12-24' })]).errors.join('\n')).toMatch(/24\. – 26\. 12\./)
    expect(run([rec({ add: [['10:00', 'mše sv.', 'štědrovečerní']] })]).errors.join('\n')).toMatch(/before 15:00/)
  })

  it('one date per record: ranges are for roráty', () => {
    expect(run([rec({ date: undefined, from: '2026-12-24', to: '2026-12-26', days: '45' })]).errors.join('\n')).toMatch(/one date/)
  })

  it('a time is HH:MM; midnight is written 24:00, never 00:00', () => {
    expect(run([rec({ add: [['0:00', 'mše sv.', 'půlnoční']] })]).errors.join('\n')).toMatch(/24:00/)
    expect(run([rec({ add: [['půlnoc', 'mše sv.', '']] })]).errors.join('\n')).toMatch(/HH:MM/)
  })

  it('the note names the Mass, so the page, its calendar events and the Vánoce pill pick it up', () => {
    expect(run([rec({ add: [['16:00', 'mše sv.', '']] })]).errors.join('\n')).toMatch(/names the Mass/)
    expect(run([rec({ add: [['16:00', 'mše sv.', 'pro děti']] })]).errors.join('\n')).toMatch(/names the Mass/)
    expect(run([rec({ add: [['16:00', 'mše sv.', 'štědrovečerní, pro děti']] })]).errors).toEqual([])
    expect(run([rec({ date: '2026-12-26', add: [['09:00', 'mše sv.', 'svátek sv. Štěpána']] })]).errors).toEqual([])
  })

  it('flags an id that is not in the data', () => {
    expect(run([rec({ id: 'zz' })]).errors.join('\n')).toMatch(/zz.*not in the dataset/)
  })
})

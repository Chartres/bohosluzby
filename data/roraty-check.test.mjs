// Roráty pass (docs/RORATY-PASS.md): a batch of records is checked before it goes into
// data/corrections.json — every record must name its source, expand to dates in
// Advent, and actually show up on its town's roráty page. A record that would land
// silently nowhere (a typo'd id, a type without "roráty") is the failure this catches.
import { describe, it, expect } from 'vitest'
import { checkRoraty } from './roraty-check.mjs'

const entry = () => ({ u: '2016-09-06', p: '', pa: '', c: [], s: [['7', '09:00', 'česky', 0, 'mše sv.', '']] })
const shards = () => ({ c: { a: entry() } })
const names = { a: { name: 'kostel sv. Michala', town: 'Brno' } }
const rec = (over = {}) => ({
  id: 'a',
  church: 'kostel sv. Michala',
  town: 'brno',
  from: '2026-11-30',
  to: '2026-12-23',
  days: '12345',
  except: ['2026-12-08'],
  add: [['06:30', 'mše sv.', 'roráty']],
  source: 'https://f.cz/ohlasky-22-11.pdf',
  source_date: 'ohlášky 22. 11. 2026',
  quote: 'roráty po–pá v 6:30 u sv. Michala',
  checked: '2026-11-23',
  ...over,
})
const run = (records) => checkRoraty({ records, shards: shards(), names, today: '2026-11-23' })

describe('checkRoraty', () => {
  it('a good record passes and prints the row the town page will show', () => {
    const r = run([rec()])
    expect(r.errors).toEqual([])
    expect(r.rows).toEqual([
      'Brno · 06:30 kostel sv. Michala — po–pá 30. 11. – 23. 12., kromě 8. 12. — ohlášky 22. 11. 2026 <https://f.cz/ohlasky-22-11.pdf>',
    ])
  })

  it('needs an http(s) source, its date and a quote', () => {
    const r = run([rec({ source: 'farnost', source_date: '', quote: '' })])
    expect(r.errors.join('\n')).toMatch(/a .*source/)
    expect(r.errors.join('\n')).toMatch(/source_date/)
    expect(r.errors.join('\n')).toMatch(/quote/)
  })

  it('flags an id that is not in the data and dates outside Advent', () => {
    expect(run([rec({ id: 'zz' })]).errors.join('\n')).toMatch(/zz.*not in the dataset/)
    expect(run([rec({ from: '2026-11-23', to: '2026-11-27' })]).errors.join('\n')).toMatch(/outside Advent/)
  })

  it('flags a record the page would not pick up: no "roráty" in type or note', () => {
    expect(run([rec({ add: [['06:30', 'mše sv.']] })]).errors.join('\n')).toMatch(/not on the roráty page/)
  })

  it('a malformed range is an error, not a crash', () => {
    expect(run([rec({ days: '8' })]).errors.join('\n')).toMatch(/days/)
  })
})

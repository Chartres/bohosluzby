import { WITNESS_CHIPS, chipLabel, massKey, occurrenceOf, riteOf, slotKey, oneOffKey } from './feedback'

describe('witness vocabulary', () => {
  it('locks the 7 positive launch chips in display order', () => {
    expect(WITNESS_CHIPS.map((c) => c.label)).toEqual([
      'hluboký prožitek',
      'dotklo se mě kázání',
      'krásný zpěv',
      'vřelé přijetí',
      'vstřícné k dětem',
      'rodinná atmosféra',
      'důstojná atmosféra',
    ])
  })
  it('has unique ascii ids', () => {
    const ids = WITNESS_CHIPS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z_]+$/)
  })
  it('resolves a chip id back to its Czech label', () => {
    expect(chipLabel('krasny_zpev')).toBe('krásný zpěv')
    expect(chipLabel('unknown')).toBe('unknown') // graceful fallback
  })
})

describe('riteOf — rite classification', () => {
  it('Greek-Catholic → byz', () => {
    expect(riteOf({ greek: true, lang: 'česky' })).toBe('byz')
  })
  it('Latin (incl. tridentská) → lat', () => {
    expect(riteOf({ greek: false, lang: 'latinsky' })).toBe('lat')
    expect(riteOf({ greek: false, lang: 'latinsky (tridentská)' })).toBe('lat')
    expect(riteOf({ greek: false, lang: 'Latine' })).toBe('lat')
  })
  it('everything else → ord', () => {
    expect(riteOf({ greek: false, lang: 'česky' })).toBe('ord')
    expect(riteOf({ greek: false, lang: 'polsky' })).toBe('ord')
  })
})

describe('massKey — stable grouping', () => {
  // Two Sundays, same weekday+time → same key.
  const sun1 = new Date('2026-07-05T09:00:00Z') // Sunday
  const sun2 = new Date('2026-07-12T09:00:00Z') // next Sunday
  const mon = new Date('2026-07-06T09:00:00Z') // Monday
  const svc = { days: '7', time: '09:30', lang: 'česky', greek: false }

  it('groups the same weekday+time+rite+lang regardless of which date was attended', () => {
    expect(massKey('c1', svc, sun1)).toBe(massKey('c1', svc, sun2))
  })
  it('separates different weekdays', () => {
    expect(massKey('c1', svc, sun1)).not.toBe(massKey('c1', svc, mon))
  })
  it('separates different churches', () => {
    expect(massKey('c1', svc, sun1)).not.toBe(massKey('c2', svc, sun1))
  })
  it('separates different rites at the same slot (Latin vs ordinary)', () => {
    const lat = { days: '7', time: '09:30', lang: 'latinsky', greek: false }
    expect(massKey('c1', svc, sun1)).not.toBe(massKey('c1', lat, sun1))
  })
  it('separates different languages at the same slot', () => {
    const pol = { days: '7', time: '09:30', lang: 'polsky', greek: false }
    expect(massKey('c1', svc, sun1)).not.toBe(massKey('c1', pol, sun1))
  })
  it('derives the weekday from the attended date, not the service.days set', () => {
    // a daily mass attended on a Sunday keys to Sunday
    expect(massKey('c1', { days: '1234567', time: '09:30', lang: 'česky', greek: false }, sun1)).toBe(
      slotKey('c1', 7, '09:30', 'ord', 'česky'),
    )
  })
  it('keys one-off extra masses by ISO date, ignoring weekday', () => {
    const key = massKey('c1', { date: '2026-08-15', time: '10:00', lang: 'česky', greek: false }, sun1)
    expect(key).toBe(oneOffKey('c1', '2026-08-15', '10:00', 'ord', 'česky'))
  })
})

describe('occurrenceOf — write-path fields', () => {
  const sun = new Date('2026-07-05T09:00:00Z') // Sunday
  it('captures weekday, time, rite, lang, and the attended date', () => {
    expect(occurrenceOf({ days: '7', time: '09:30', lang: 'latinsky', greek: false }, sun)).toEqual({
      weekday: 7,
      time: '09:30',
      rite: 'lat',
      lang: 'latinsky',
      massDate: '2026-07-05',
    })
  })
  it('uses the one-off date for extra masses', () => {
    const occ = occurrenceOf({ date: '2026-08-15', time: '10:00', lang: 'česky', greek: false }, sun)
    expect(occ.massDate).toBe('2026-08-15')
  })
})

import { WITNESS_CHIPS, LANG_OPTIONS, chipLabel, massKey, slotKey, oneOffKey } from './feedback'

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
  it('offers exactly the four factual language values', () => {
    expect(LANG_OPTIONS).toEqual(['česky', 'latinsky', 'anglicky', 'jinak'])
  })
  it('resolves a chip id back to its Czech label', () => {
    expect(chipLabel('krasny_zpev')).toBe('krásný zpěv')
    expect(chipLabel('unknown')).toBe('unknown') // graceful fallback
  })
})

describe('massKey — stable grouping', () => {
  // Two Sundays, same weekday+time → same key.
  const sun1 = new Date('2026-07-05T09:00:00Z') // Sunday
  const sun2 = new Date('2026-07-12T09:00:00Z') // next Sunday
  const mon = new Date('2026-07-06T09:00:00Z') // Monday
  const svc = { days: '7', time: '09:30' }

  it('groups the same weekday+time regardless of which date was attended', () => {
    expect(massKey('c1', svc, sun1)).toBe(massKey('c1', svc, sun2))
  })
  it('separates different weekdays', () => {
    expect(massKey('c1', svc, sun1)).not.toBe(massKey('c1', svc, mon))
  })
  it('separates different churches', () => {
    expect(massKey('c1', svc, sun1)).not.toBe(massKey('c2', svc, sun1))
  })
  it('derives the weekday from the attended date, not the service.days set', () => {
    // a daily mass attended on a Sunday keys to Sunday
    expect(massKey('c1', { days: '1234567', time: '09:30' }, sun1)).toBe(slotKey('c1', 7, '09:30'))
  })
  it('keys one-off extra masses by ISO date, ignoring weekday', () => {
    const key = massKey('c1', { date: '2026-08-15', time: '10:00' }, sun1)
    expect(key).toBe(oneOffKey('c1', '2026-08-15', '10:00'))
  })
})

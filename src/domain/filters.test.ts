import { describe, expect, it } from 'vitest'
import { applyFilters, isMass, NO_FILTERS, serviceMatches } from './filters'
import type { ChurchServices, Service } from './data'

const svc = (overrides: Partial<Service> = {}): Service => ({
  days: '7',
  time: '10:00',
  lang: 'česky',
  greek: false,
  type: '',
  note: '',
  ...overrides,
})

describe('isMass', () => {
  it('blank type = Mass (most village parishes)', () => expect(isMass('')).toBe(true))
  it('whitespace-only type = Mass', () => expect(isMass('  ')).toBe(true))
  it('"mše sv." = Mass', () => expect(isMass('mše sv.')).toBe(true))
  it('"mše svatá" = Mass', () => expect(isMass('mše svatá')).toBe(true))
  it('"liturgie hodinek" = Mass', () => expect(isMass('liturgie hodinek')).toBe(true))
  it('"bohoslužba slova" ≠ Mass', () => expect(isMass('bohoslužba slova')).toBe(false))
  it('"svátost smíření" ≠ Mass', () => expect(isMass('svátost smíření')).toBe(false))
})

describe('serviceMatches', () => {
  it('NO_FILTERS passes everything', () => {
    expect(serviceMatches(NO_FILTERS)(svc())).toBe(true)
    expect(serviceMatches(NO_FILTERS)(svc({ type: 'bohoslužba slova', lang: 'slovensky', greek: true }))).toBe(true)
  })
  it('lang filter: passes only matching language', () => {
    const f = { ...NO_FILTERS, lang: 'slovensky' }
    expect(serviceMatches(f)(svc({ lang: 'slovensky' }))).toBe(true)
    expect(serviceMatches(f)(svc({ lang: 'česky' }))).toBe(false)
  })
  it('greek filter: passes only greek-catholic rows', () => {
    const f = { ...NO_FILTERS, greek: true }
    expect(serviceMatches(f)(svc({ greek: true }))).toBe(true)
    expect(serviceMatches(f)(svc({ greek: false }))).toBe(false)
  })
  it('massOnly filter: rejects non-Mass types', () => {
    const f = { ...NO_FILTERS, massOnly: true }
    expect(serviceMatches(f)(svc({ type: '' }))).toBe(true)
    expect(serviceMatches(f)(svc({ type: 'mše sv.' }))).toBe(true)
    expect(serviceMatches(f)(svc({ type: 'bohoslužba slova' }))).toBe(false)
  })
  it('cas filter: rejects services outside the time window', () => {
    expect(serviceMatches(NO_FILTERS, '10:00')(svc({ time: '10:00' }))).toBe(true)
    expect(serviceMatches(NO_FILTERS, '10:00')(svc({ time: '18:00' }))).toBe(false)
  })
})

describe('applyFilters', () => {
  const ch = (services: Service[]): ChurchServices => ({
    updated: '2026-01-01',
    parish: '',
    parishAddress: '',
    contacts: [],
    regular: services,
    extra: [],
    confession: [],
  })
  const byId = new Map([
    ['a', ch([svc({ type: 'mše sv.' }), svc({ type: 'bohoslužba slova' })])],
    ['b', ch([svc({ type: 'mše sv.' })])],
  ])

  it('NO_FILTERS returns the same reference (short-circuit)', () => {
    expect(applyFilters(byId, NO_FILTERS)).toBe(byId)
  })
  it('massOnly removes non-Mass rows within each church', () => {
    const f = { ...NO_FILTERS, massOnly: true }
    const out = applyFilters(byId, f)
    expect(out.get('a')!.regular).toHaveLength(1) // only mše sv.
    expect(out.get('b')!.regular).toHaveLength(1) // unchanged
  })
})

import type { ChurchServices, Service } from './data'
import { NO_FILTERS, applyFilters, serviceMatches } from './filters'

const svc = (overrides: Partial<Service> = {}): Service => ({
  days: '7',
  time: '10:00',
  lang: 'česky',
  greek: false,
  type: 'mše sv.',
  note: '',
  ...overrides,
})

const cs = (regular: Service[]): ChurchServices => ({
  updated: '2026-01-01',
  parish: 'p',
  parishAddress: 'a',
  contacts: [],
  regular,
  extra: [],
  confession: [],
})

const byId = (map: Record<string, Service[]>): ReadonlyMap<string, ChurchServices> =>
  new Map(Object.entries(map).map(([id, svcs]) => [id, cs(svcs)]))

describe('serviceMatches', () => {
  it('empty filters: all services pass', () => {
    expect(serviceMatches(NO_FILTERS)(svc())).toBe(true)
    expect(serviceMatches(NO_FILTERS)(svc({ lang: 'latinsky', greek: true, type: 'nešpory' }))).toBe(true)
  })

  it('lang filter: only matching language passes', () => {
    const f = { ...NO_FILTERS, lang: 'latinsky' }
    expect(serviceMatches(f)(svc({ lang: 'latinsky' }))).toBe(true)
    expect(serviceMatches(f)(svc({ lang: 'česky' }))).toBe(false)
  })

  it('greek filter: only greek-rite services pass', () => {
    const f = { ...NO_FILTERS, greek: true }
    expect(serviceMatches(f)(svc({ greek: true }))).toBe(true)
    expect(serviceMatches(f)(svc({ greek: false }))).toBe(false)
  })

  it('massOnly: blank type (plain Mass) and "mše sv." pass; "nešpory" does not', () => {
    const f = { ...NO_FILTERS, massOnly: true }
    expect(serviceMatches(f)(svc({ type: 'mše sv.' }))).toBe(true)
    expect(serviceMatches(f)(svc({ type: '' }))).toBe(true)
    expect(serviceMatches(f)(svc({ type: 'nešpory' }))).toBe(false)
    expect(serviceMatches(f)(svc({ type: 'liturgie' }))).toBe(true)
  })

  it('combined massOnly + lang: must satisfy both', () => {
    const f = { ...NO_FILTERS, massOnly: true, lang: 'latinsky' }
    expect(serviceMatches(f)(svc({ type: 'mše sv.', lang: 'latinsky' }))).toBe(true)
    expect(serviceMatches(f)(svc({ type: 'mše sv.', lang: 'česky' }))).toBe(false)
    expect(serviceMatches(f)(svc({ type: 'nešpory', lang: 'latinsky' }))).toBe(false)
  })
})

describe('applyFilters', () => {
  it('no filters: returns the same map reference (fast path)', () => {
    const map = byId({ c1: [svc()] })
    expect(applyFilters(map, NO_FILTERS)).toBe(map)
  })

  it('filters out non-matching regular services, keeps church entry', () => {
    const map = byId({ c1: [svc({ lang: 'česky' }), svc({ lang: 'latinsky' })] })
    const f = { ...NO_FILTERS, lang: 'latinsky' }
    const out = applyFilters(map, f)
    expect(out.get('c1')!.regular).toHaveLength(1)
    expect(out.get('c1')!.regular[0].lang).toBe('latinsky')
  })
})

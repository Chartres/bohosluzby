import { aggregateCities, findCity, normalizeCity, slugify } from './cities'
import type { Church } from './data'

const church = (id: string, city: string, lat = 50, lng = 14): Church => ({
  id,
  name: `kostel ${id}`,
  city,
  lat,
  lng,
  barrierFree: false,
  cell: '50-14',
})

describe('normalizeCity', () => {
  it('Praha districts collapse to Praha', () => {
    expect(normalizeCity('Praha 1')).toBe('Praha')
    expect(normalizeCity('Praha 22')).toBe('Praha')
  })
  it('"quarter, municipality" keeps the municipality', () => {
    expect(normalizeCity('Brno-město, Brno')).toBe('Brno')
    expect(normalizeCity('Kukleny, Hradec Králové')).toBe('Hradec Králové')
    expect(normalizeCity('České Budějovice 3, České Budějovice')).toBe('České Budějovice')
  })
  it('plain names pass through', () => {
    expect(normalizeCity('Frýdek-Místek')).toBe('Frýdek-Místek')
  })
})

describe('slugify', () => {
  it('strips diacritics and spaces', () => {
    expect(slugify('Ústí nad Labem')).toBe('usti-nad-labem')
    expect(slugify('Žďár nad Sázavou')).toBe('zdar-nad-sazavou')
    expect(slugify('Frýdek-Místek')).toBe('frydek-mistek')
  })
})

describe('aggregateCities / findCity', () => {
  const index = [
    church('1', 'Praha 1', 50.08, 14.42),
    church('2', 'Praha 6', 50.1, 14.4),
    church('3', 'Brno-město, Brno', 49.2, 16.6),
    church('4', 'Brno', 49.19, 16.61),
    church('5', 'Cheb', 50.08, 12.37),
  ]
  it('groups, counts and sorts largest first', () => {
    const cities = aggregateCities(index)
    expect(cities.map((c) => [c.name, c.count])).toEqual([
      ['Brno', 2],
      ['Praha', 2],
      ['Cheb', 1],
    ])
    const praha = cities.find((c) => c.name === 'Praha')!
    expect(praha.lat).toBeCloseTo(50.09)
    expect(praha.churches.map((c) => c.id)).toEqual(['1', '2'])
  })
  it('finds a city by slug', () => {
    expect(findCity(index, 'brno')?.name).toBe('Brno')
    expect(findCity(index, 'nowhere')).toBeUndefined()
  })
})

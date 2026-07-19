import { aggregateCities, findCity, fold, normalizeCity, searchPlaces, slugify } from './cities'
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

describe('searchPlaces — unified church + city typeahead', () => {
  const tyn: Church = {
    id: 't1',
    name: 'kostel Matky Boží před Týnem',
    city: 'Praha 1',
    lat: 50.0877,
    lng: 14.4227,
    barrierFree: false,
    cell: '50-14',
  }
  const index = [
    church('1', 'České Budějovice 3, České Budějovice'),
    church('2', 'Týn nad Vltavou'),
    church('3', 'Zlín'),
    church('4', 'Praha 1'),
    tyn,
  ]
  const cities = aggregateCities(index)

  it('fold strips Czech diacritics both sides', () => {
    expect(fold('České Budějovice')).toBe('ceske budejovice')
    expect(fold('Týnem')).toBe('tynem')
  })

  it('finds cities diacritics-insensitively ("ceske" → České Budějovice)', () => {
    const r = searchPlaces(cities, index, 'ceske')
    expect(r[0]).toMatchObject({ kind: 'city', name: 'České Budějovice' })
  })

  it('finds churches by name ("tyn" → Matky Boží před Týnem) after city matches', () => {
    const r = searchPlaces(cities, index, 'tyn')
    expect(r.map((x) => [x.kind, x.name])).toEqual([
      ['city', 'Týn nad Vltavou'],
      ['church', 'kostel Matky Boží před Týnem'],
      ['church', 'kostel 2'], // church in Týn nad Vltavou matches via its city
    ])
  })

  it('matches churches by their city too ("praha" church match)', () => {
    const r = searchPlaces(cities, index, 'praha')
    expect(r[0]).toMatchObject({ kind: 'city', name: 'Praha' })
    expect(r.some((x) => x.kind === 'church' && x.name === tyn.name)).toBe(true)
  })

  it('finds a church by its website host ("kcmt" → http://www.kcmt.cz)', () => {
    const kcmt: Church = { ...church('k1', 'Praha 4'), www: 'http://www.kcmt.cz' }
    const idx = [kcmt]
    const r = searchPlaces(aggregateCities(idx), idx, 'kcmt')
    expect(r.some((x) => x.kind === 'church' && x.church.id === 'k1')).toBe(true)
  })

  it('short or empty queries return nothing', () => {
    expect(searchPlaces(cities, index, 'z')).toEqual([])
    expect(searchPlaces(cities, index, ' ')).toEqual([])
  })

  it('caps the result list', () => {
    const many = Array.from({ length: 30 }, (_, i) => church(`m${i}`, `Novákov ${i + 10}`))
    expect(searchPlaces(aggregateCities(many), many, 'novakov').length).toBeLessThanOrEqual(10)
  })
})

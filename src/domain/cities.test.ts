import { aggregateCities, cityLabel, findCity, searchPlaces } from './cities'
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
  it('same-named towns in different regions stay apart; the larger keeps the bare slug', () => {
    const at = (id: string, city: string, lat: number, lng: number): Church => ({
      ...church(id, city, lat, lng),
      cell: `${Math.floor(lat)}-${Math.floor(lng)}`,
    })
    const idx = [
      ...['h1', 'h2', 'h3'].map((id) => at(id, 'Hranice', 49.55, 17.73)), // Hranice na Moravě
      at('a1', 'Hranice', 50.3, 12.17), // Hranice u Aše, ~400 km west
    ]
    const cities = aggregateCities(idx)
    expect(cities.map((c) => [c.slug, c.count])).toEqual([
      ['hranice', 3],
      ['hranice-5012', 1],
    ])
    expect(cities[0].lng).toBeCloseTo(17.73) // not a centroid in the middle of Bohemia
    expect(findCity(idx, 'hranice')?.churches.map((c) => c.id)).toEqual(['h1', 'h2', 'h3'])
  })
  it('a town split by a 1° cell edge is still one town', () => {
    const idx = [
      { ...church('p1', 'Praha 4', 49.98, 14.45), cell: '49-14' },
      { ...church('p2', 'Praha 1', 50.08, 14.42), cell: '50-14' },
    ]
    expect(aggregateCities(idx).map((c) => [c.slug, c.count])).toEqual([['praha', 2]])
  })
  it('slug collision resolution is stable regardless of church counts (M11)', () => {
    // "Skřipov" and "Skřípov" both fold to "skripov". Whichever has more churches
    // should not affect the slug assignment — it's name-ordered so it never drifts.
    const makeIdx = (skipovCount: number, skripovCount: number) => [
      ...Array.from({ length: skipovCount }, (_, i) => church(`s${i}`, 'Skřipov', 49.8, 17.6)),
      ...Array.from({ length: skripovCount }, (_, i) => church(`r${i}`, 'Skřípov', 49.5, 17.4)),
    ]
    const slugsA = aggregateCities(makeIdx(5, 1)).map((c) => [c.name, c.slug])
    const slugsB = aggregateCities(makeIdx(1, 5)).map((c) => [c.name, c.slug])
    // Slug assignments must be identical regardless of which town has more churches.
    const toMap = (pairs: [string, string][]) => Object.fromEntries(pairs)
    expect(toMap(slugsA as [string,string][])).toEqual(toMap(slugsB as [string,string][]))
  })
  it('pins the name-order owner of a folded-slug collision (Desná keeps /mesto/desna/)', () => {
    const idx = [
      ...['d1', 'd2'].map((id) => church(id, 'Dešná', 49.0, 15.5)),
      church('n1', 'Desná', 50.76, 15.3),
    ]
    expect(findCity(idx, 'desna')?.name).toBe('Desná')
    expect(findCity(idx, 'desna-2')?.name).toBe('Dešná')
  })
  it('namesakes carry the nearest unique town with 3+ churches; unique names carry none', () => {
    const at = (id: string, city: string, lat: number, lng: number): Church => ({
      ...church(id, city, lat, lng),
      cell: `${Math.floor(lat)}-${Math.floor(lng)}`,
    })
    const idx = [
      ...['o1', 'o2', 'o3'].map((id) => at(id, 'Opava', 49.94, 17.9)),
      ...['p1', 'p2', 'p3'].map((id) => at(id, 'Příbram', 49.69, 14.01)),
      ...['x1', 'x2'].map((id) => at(id, 'Kopřivnice', 49.6, 18.14)), // unique but < 3 churches
      at('e1', 'Petrovice', 50.0, 17.8), // near Opava
      at('w1', 'Petrovice', 49.55, 14.36), // near Příbram
    ]
    const cities = aggregateCities(idx)
    const labels = Object.fromEntries(
      cities.filter((c) => c.name === 'Petrovice').map((c) => [c.churches[0].id, cityLabel(c)]),
    )
    expect(labels).toEqual({ e1: 'Petrovice (Opava)', w1: 'Petrovice (Příbram)' })
    const opava = cities.find((c) => c.name === 'Opava')!
    expect(opava.near).toBeUndefined()
    expect(cityLabel(opava)).toBe('Opava')
    const hits = searchPlaces(cities, idx, 'petro').filter((r) => r.kind === 'city')
    expect(hits.map((r) => r.name).sort()).toEqual(['Petrovice (Opava)', 'Petrovice (Příbram)'])
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

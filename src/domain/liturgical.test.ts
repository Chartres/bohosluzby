import { easterSunday, liturgicalDay, verifySeason } from './liturgical'

describe('easterSunday (Gregorian computus)', () => {
  it.each([
    [2024, 3, 31],
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
    [2038, 4, 25], // latest possible in the era — classic computus edge
    [2008, 3, 23],
  ])('%i → %i-%i', (y, m, d) => {
    expect(easterSunday(y)).toEqual({ month: m, day: d })
  })
})

describe('liturgicalDay — seasons 2026 (Roman rite, CZ)', () => {
  const day = (y: number, m: number, d: number) => liturgicalDay(y, m, d)

  it('ordinary time is green (3 July 2026)', () => {
    expect(day(2026, 7, 3)).toMatchObject({ season: 'ordinary', color: 'green' })
  })

  it('Ash Wednesday 2026 (18 Feb) starts Lent — violet', () => {
    expect(day(2026, 2, 17)).toMatchObject({ season: 'ordinary', color: 'green' })
    expect(day(2026, 2, 18)).toMatchObject({ season: 'lent', color: 'violet' })
  })

  it('Palm Sunday 2026 (29 Mar) and Good Friday (3 Apr) are red', () => {
    expect(day(2026, 3, 29).color).toBe('red')
    expect(day(2026, 4, 3).color).toBe('red')
  })

  it('Easter Sunday 2026 (5 Apr) opens the Easter season — white/gold', () => {
    expect(day(2026, 4, 4)).toMatchObject({ season: 'lent' })
    expect(day(2026, 4, 5)).toMatchObject({ season: 'easter', color: 'gold' })
    expect(day(2026, 5, 23)).toMatchObject({ season: 'easter', color: 'gold' })
  })

  it('Pentecost 2026 (24 May) is red, then ordinary time resumes', () => {
    expect(day(2026, 5, 24)).toMatchObject({ season: 'easter', color: 'red' })
    expect(day(2026, 5, 25)).toMatchObject({ season: 'ordinary', color: 'green' })
  })

  it('Advent 2026 starts Sunday 29 Nov — violet until Christmas Eve', () => {
    expect(day(2026, 11, 28)).toMatchObject({ season: 'ordinary' })
    expect(day(2026, 11, 29)).toMatchObject({ season: 'advent', color: 'violet' })
    expect(day(2026, 12, 24)).toMatchObject({ season: 'advent', color: 'violet' })
  })

  it('Christmas season runs 25 Dec → Baptism of the Lord (10 Jan 2027) — gold', () => {
    expect(day(2026, 12, 25)).toMatchObject({ season: 'christmas', color: 'gold' })
    expect(day(2027, 1, 10)).toMatchObject({ season: 'christmas', color: 'gold' })
    expect(day(2027, 1, 11)).toMatchObject({ season: 'ordinary', color: 'green' })
  })

  it('Advent 2025 starts 30 Nov (Nov 27–Dec 3 window, other bound)', () => {
    expect(day(2025, 11, 29)).toMatchObject({ season: 'ordinary' })
    expect(day(2025, 11, 30)).toMatchObject({ season: 'advent' })
  })

  it('CZ solemnities override: sv. Václav (28 Sep) red, Cyril a Metoděj (5 Jul) gold', () => {
    expect(day(2026, 9, 28).color).toBe('red')
    expect(day(2026, 7, 5).color).toBe('gold')
  })

  it('fixed solemnities override the running season (8 Dec in Advent is gold)', () => {
    expect(day(2026, 12, 8).color).toBe('gold')
  })
})

describe('liturgicalDay — feast names (day-picker highlight + list header line)', () => {
  const day = (y: number, m: number, d: number) => liturgicalDay(y, m, d)

  it.each([
    [2026, 1, 6, 'Zjevení Páně', 'gold'],
    [2026, 7, 5, 'sv. Cyrila a Metoděje', 'gold'],
    [2026, 8, 15, 'Nanebevzetí Panny Marie', 'gold'],
    [2026, 9, 28, 'sv. Václava', 'red'],
    [2026, 11, 1, 'Všech svatých', 'gold'],
    [2026, 12, 8, 'Neposkvrněného početí Panny Marie', 'gold'],
    [2026, 12, 25, 'Narození Páně', 'gold'],
    [2026, 6, 29, 'sv. Petra a Pavla', 'red'],
  ] as const)('%i-%i-%i → %s (%s)', (y, m, d, feast, color) => {
    expect(day(y, m, d)).toMatchObject({ feast, color })
  })

  it('movable feasts via the computus (Easter 2026 = 5 Apr)', () => {
    expect(day(2026, 4, 5)).toMatchObject({ feast: 'Zmrtvýchvstání Páně', color: 'gold' })
    expect(day(2026, 5, 14)).toMatchObject({ feast: 'Nanebevstoupení Páně', color: 'gold' }) // E+39
    expect(day(2026, 5, 24)).toMatchObject({ feast: 'Seslání Ducha svatého', color: 'red' }) // E+49
    expect(day(2026, 6, 4)).toMatchObject({ feast: 'Těla a krve Páně', color: 'gold' }) // E+60, Thursday
    expect(day(2026, 11, 22)).toMatchObject({ feast: 'Ježíše Krista Krále', color: 'gold' }) // Sunday before Advent
    expect(day(2026, 3, 29)).toMatchObject({ feast: 'Květná neděle', color: 'red' })
    expect(day(2026, 4, 3)).toMatchObject({ feast: 'Velký pátek', color: 'red' })
  })

  it('ordinary days carry no feast', () => {
    expect(day(2026, 7, 3).feast).toBeUndefined()
    expect(day(2026, 12, 24).feast).toBeUndefined()
  })
})

describe('verifySeason', () => {
  const at = (iso: string) => verifySeason(new Date(iso))
  it('summer holidays win July and August', () => {
    expect(at('2026-07-19T12:00:00Z')).toBe('summer')
    expect(at('2026-08-31T12:00:00Z')).toBe('summer')
  })
  it('liturgical windows: advent, christmas, lent', () => {
    expect(at('2026-12-01T12:00:00Z')).toBe('advent')
    expect(at('2026-12-25T12:00:00Z')).toBe('christmas')
    expect(at('2026-02-20T12:00:00Z')).toBe('lent') // Ash Wednesday 2026 = 18 Feb
  })
  it('easter octave only, then quiet ordinary time', () => {
    expect(at('2026-04-05T12:00:00Z')).toBe('easter') // Easter Sunday 2026
    expect(at('2026-04-12T12:00:00Z')).toBe('easter') // octave end
    expect(at('2026-05-20T12:00:00Z')).toBe(null) // deep Easter season → no banner
    expect(at('2026-06-30T12:00:00Z')).toBe(null) // ordinary time
    expect(at('2026-10-10T12:00:00Z')).toBe(null)
  })
})

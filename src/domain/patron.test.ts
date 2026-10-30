// Mechanic B (docs/SIGNATURE.md): each church has a title (CIC can. 1218); its
// feast is the village pouť. Read from the church's name — only titles whose
// date is unambiguous; "sv. Jakuba" alone (Starší 25. 7., or Mladší 3. 5.?) and
// a bare "Panny Marie" get nothing rather than a guess.
import { patronOf, nextPatronDate } from './patron'

describe('patronOf', () => {
  it.each([
    ['farní kostel sv. Václava', 'svátek sv. Václava', '9-28'],
    ['kostel Nanebevzetí Panny Marie, Brno', 'slavnost Nanebevzetí Panny Marie', '8-15'],
    ['kostel Nanebevzetí P. Marie', 'slavnost Nanebevzetí Panny Marie', '8-15'],
    ['kapitulní kostel Všech svatých, Praha-Hrad', 'slavnost Všech svatých', '11-1'],
    ['kostel sv. Jakuba Staršího', 'svátek sv. Jakuba Staršího', '7-25'],
    ['kostel sv. Petra a sv. Pavla', 'slavnost sv. Petra a Pavla', '6-29'],
    ['kostel Stětí sv. Jana Křtitele', 'památka Umučení sv. Jana Křtitele', '8-29'],
    ['kostel Narození sv. Jana Křtitele', 'slavnost Narození sv. Jana Křtitele', '6-24'],
    ['kostel sv. Jana Křtitele', 'slavnost Narození sv. Jana Křtitele', '6-24'],
    ['kostel sv. Jana Nepomuckého', 'svátek sv. Jana Nepomuckého', '5-16'],
    ['kaple sv. Michala', 'svátek sv. Michaela archanděla', '9-29'],
    ['kostel Povýšení svatého Kříže', 'svátek Povýšení svatého Kříže', '9-14'],
  ])('%s → %s', (name, title, md) => {
    const p = patronOf(name)!
    expect(p.title).toBe(title)
    expect(p.fixed).toBe(md)
  })

  it('reads movable titles', () => {
    expect(patronOf('kostel Nejsvětější Trojice')!.title).toBe('slavnost Nejsvětější Trojice')
    expect(patronOf('kostel Nejsvětější Trojice')!.fixed).toBeUndefined()
  })

  it('reads "sv. stětí Jana Křtitele" (registry word order) as the Beheading', () => {
    expect(patronOf('kostel farní sv. stětí Jana Křtitele')!.fixed).toBe('8-29')
  })

  it('keeps a place name after the title (Ostrava names carry the quarter without a comma)', () => {
    expect(patronOf('farní kostel sv. Jana Nepomuckého Stará Bělá, Ostrava')!.fixed).toBe('5-16')
  })

  // which title is the church's own is not ours to guess
  it.each([
    'farní kostel Nanebevzetí Panny Marie a sv. Jana Křtitele',
    'filiální kostel Panny Marie Bolestné a sv. Jana Nepomuckého',
    'kaple sv. Vavřince a sv. Jana Křtitele',
    'kostel Navštívení Panny Marie a sv. Václava',
    'filiální kostel Panny Marie s kaplí sv. Vojtěcha',
    'kostel sv. Františka Xaverského a Nanebevzetí P. Marie',
    'kostel Božího Těla a Zvěstování Páně',
  ])('gives nothing for a church with two titles: %s', (name) => expect(patronOf(name)).toBeNull())

  it.each(['kostel sv. Jakuba', 'kaple Panny Marie', 'modlitebna na faře', 'kostel sv. Jana'])(
    'gives nothing for an ambiguous or missing title: %s',
    (name) => expect(patronOf(name)).toBeNull(),
  )
})

describe('nextPatronDate', () => {
  it('this year while the day is ahead, else next year', () => {
    expect(nextPatronDate(patronOf('kostel sv. Martina')!, '2026-10-27')).toBe('2026-11-11')
    expect(nextPatronDate(patronOf('kostel sv. Václava')!, '2026-10-27')).toBe('2027-09-28')
    expect(nextPatronDate(patronOf('kostel Všech svatých')!, '2026-11-01')).toBe('2026-11-01')
  })

  it('applies the calendar transfers', () => {
    // Easter 2027 = 28 Mar: 25 Mar is Maundy Thursday → Annunciation on Mon 5 Apr
    expect(nextPatronDate(patronOf('kostel Zvěstování Páně')!, '2026-10-27')).toBe('2027-04-05')
    // 2028: Easter 16 Apr, 19 Mar is the 5th Sunday of Lent → Mon 20 Mar
    expect(nextPatronDate(patronOf('kostel sv. Josefa')!, '2027-12-01')).toBe('2028-03-20')
    // 2024: Easter 31 Mar, 19 Mar in Lent (Tue) stays; 25 Mar is Holy Monday → Mon 8 Apr
    expect(nextPatronDate(patronOf('kostel Zvěstování Páně')!, '2024-01-01')).toBe('2024-04-08')
    // 2027: 8 Dec is a Wednesday; 2030: Sunday → Mon 9 Dec
    expect(nextPatronDate(patronOf('kostel Neposkvrněného početí Panny Marie')!, '2030-01-01')).toBe('2030-12-09')
  })

  it('computes the movable ones from Easter', () => {
    // Easter 2027 = 28 Mar → Trinity Sunday 23 May, Sacred Heart Fri 4 Jun
    expect(nextPatronDate(patronOf('kostel Nejsvětější Trojice')!, '2026-10-27')).toBe('2027-05-23')
    expect(nextPatronDate(patronOf('kostel Božského Srdce Páně')!, '2026-10-27')).toBe('2027-06-04')
  })
})

// Pavol 2026-10-30: ambiguous titles show nothing unless a parish source
// names the feast; each one is recorded with its source and quote.
import { PARISH_TITLES, patronOfChurch } from './patron'
import sources from '../../data/patron-sources.json'

describe('PARISH_TITLES — ambiguous titles settled by a parish source', () => {
  type Row = { id: string; name: string; confirmed: boolean; title: string | null; date: string | null; source: string | null; quote: string | null }
  const rows = (sources as { churches: Row[] }).churches
  const confirmed = rows.filter((r) => r.confirmed)

  it('holds exactly the confirmed rows of data/patron-sources.json, with their source', () => {
    expect(Object.keys(PARISH_TITLES).sort()).toEqual(confirmed.map((r) => r.id).sort())
    for (const r of confirmed) expect(PARISH_TITLES[r.id]).toEqual([r.title, r.date, r.source])
  })

  it('every confirmed row has a URL, a verbatim quote and a real month-day', () => {
    for (const r of confirmed) {
      expect(r.source).toMatch(/^https?:\/\//)
      expect((r.quote ?? '').length).toBeGreaterThan(10)
      const [m, d] = (r.date ?? '').split('-').map(Number)
      expect(m >= 1 && m <= 12 && d >= 1 && d <= 31).toBe(true)
    }
  })

  it('applies only where the name alone gives nothing', () => {
    for (const r of rows) expect(patronOf(r.name)).toBeNull()
  })

  it('shows nothing for a church no source confirmed', () => {
    for (const r of rows.filter((x) => !x.confirmed)) expect(patronOfChurch(r)).toBeNull()
  })

  it('the name still wins for an unambiguous title', () => {
    expect(patronOfChurch({ id: 'x', name: 'kostel sv. Václava' })!.fixed).toBe('9-28')
  })
})

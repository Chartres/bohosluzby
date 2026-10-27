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

  it('computes the movable ones from Easter', () => {
    // Easter 2027 = 28 Mar → Trinity Sunday 23 May, Sacred Heart Fri 4 Jun
    expect(nextPatronDate(patronOf('kostel Nejsvětější Trojice')!, '2026-10-27')).toBe('2027-05-23')
    expect(nextPatronDate(patronOf('kostel Božského Srdce Páně')!, '2026-10-27')).toBe('2027-06-04')
  })
})

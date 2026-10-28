// All Saints / All Souls pages (/dusicky/ + /dusicky/<city>/, scripts/prerender.mjs).
// The two days a year people most look up Mass times away from home — at
// their family's graves. The pages list only what the registry says for that
// date: the weekly ordo filtered by its notes, plus one-offs dated that day.
import { allSaints, servicesOn, feastCityPage, feastHubPage, churchFeastSection, feastEvents, feastBeacon } from './feast'
import type { RawEntry } from './churchPage'

type Row = [string, string, string, 0 | 1, string, string]
const entry = (s: Row[], x: Row[] = [], u = '2026-05-01'): RawEntry => ({ u, p: 'Farnost', pa: '', c: [], s, x })

describe('allSaints — which 1–2 November the pages are about', () => {
  it('is this year until All Souls has passed', () => {
    const f = allSaints('2026-10-27')
    expect(f.year).toBe(2026)
    expect(f.days.map((d) => d.iso)).toEqual(['2026-11-01', '2026-11-02'])
    // 2026: All Saints falls on a Sunday, All Souls on a Monday
    expect(f.days[0].label).toBe('neděle 1. listopadu')
    expect(f.days[1].label).toBe('pondělí 2. listopadu')
    expect(allSaints('2026-11-02').year).toBe(2026)
  })

  it('rolls to next year once 2 November is over', () => {
    const f = allSaints('2026-11-03')
    expect(f.year).toBe(2027)
    expect(f.days[0].label).toBe('pondělí 1. listopadu')
  })
})

describe('servicesOn — what the registry says for one date', () => {
  it('takes weekly rows on that weekday and one-offs dated that day, chronological', () => {
    const e = entry(
      [
        ['7', '10:30', 'česky', 0, 'mše sv.', ''],
        ['7', '08:00', 'česky', 0, '', ''],
        ['1', '18:00', 'česky', 0, '', ''], // Monday, not Sunday
      ],
      [
        ['2026-11-01', '15:00', 'česky', 0, 'pobožnost', 'na hřbitově'],
        ['2026-11-08', '15:00', 'česky', 0, 'mše sv.', ''],
      ],
    )
    const got = servicesOn(e, '2026-11-01')
    expect(got.map((s) => s.time)).toEqual(['08:00', '10:30', '15:00'])
    expect(got[2]).toMatchObject({ extra: true, type: 'pobožnost', note: 'na hřbitově' })
  })

  it('drops a weekly row its note provably excludes, keeps one it cannot read', () => {
    const e = entry([
      ['7', '09:00', 'česky', 0, '', '2. neděle v měsíci'], // 1 Nov 2026 is the 1st Sunday
      ['7', '11:00', 'česky', 0, '', '1. neděle v měsíci'],
      ['7', '17:00', 'česky', 0, '', 'nepravidelně, viz ohlášky'],
    ])
    const got = servicesOn(e, '2026-11-01')
    expect(got.map((s) => s.time)).toEqual(['11:00', '17:00'])
    expect(got[1].uncertain).toBe(true)
  })

  it('prints a weekly row once when the parish re-entered it as a one-off for the day', () => {
    const e = entry([['7', '8:00', 'česky', 0, '', '']], [['2026-11-01', '08:00', 'česky', 0, '', 'slavnost']])
    expect(servicesOn(e, '2026-11-01')).toHaveLength(1)
  })

  it('a blank-type weekly Mass and a "mše sv." one-off at that time are the same service', () => {
    const e = entry([['7', '09:00', 'česky', 0, '', '']], [['2026-11-01', '09:00', 'česky', 0, 'mše sv.', '']])
    expect(servicesOn(e, '2026-11-01')).toHaveLength(1)
  })

  it('a different one-off at the same time never hides the weekly Mass', () => {
    const e = entry([['7', '15:00', 'česky', 0, 'mše sv.', '']], [['2026-11-01', '15:00', 'česky', 0, 'pobožnost', 'na hřbitově']])
    expect(servicesOn(e, '2026-11-01').map((s) => s.type)).toEqual(['mše sv.', 'pobožnost'])
  })

  it('never lists confession windows', () => {
    const e = entry([['7', '08:30 - 09:30', 'česky', 0, 'svátost smíření', '']])
    expect(servicesOn(e, '2026-11-01')).toEqual([])
  })
})

const CITY = {
  name: 'Brno',
  slug: 'brno',
  churches: [
    { id: '1', name: 'katedrála sv. Petra a Pavla', city: 'Brno' },
    { id: '2', name: 'kostel sv. Jakuba', city: 'Brno' },
    { id: '3', name: 'kaple sv. Anny', city: 'Brno' },
  ],
}
const ENTRIES: Record<string, RawEntry> = {
  '1': entry([['7', '09:00', 'česky', 0, '', ''], ['1', '07:00', 'česky', 0, '', '']], [['2026-11-02', '18:00', 'česky', 0, 'mše sv.', 'za zemřelé']]),
  '2': entry([['7', '08:00', 'latinsky', 0, '', '']]),
  '3': entry([['7', '10:00', 'česky', 0, '', '']], [], '2022-01-10'), // stale: flagged
}

describe('feastCityPage — /dusicky/<city>/', () => {
  const page = feastCityPage({ city: CITY, entries: ENTRIES, today: '2026-10-27' })

  it('has its own URL, a title that matches the searches, and a description', () => {
    expect(page.url).toBe('https://bohosluzby.dravec.org/dusicky/brno/')
    expect(page.title).toContain('Brno')
    expect(page.title).toContain('Všech svatých')
    expect(page.title).toContain('Dušičky')
    expect(page.description.length).toBeLessThanOrEqual(200)
  })

  it('lists each day chronologically with the church linked, extras marked', () => {
    const sun = page.body.indexOf('id="den-1"')
    const mon = page.body.indexOf('id="den-2"')
    expect(page.body.slice(sun, sun + 80)).toContain('neděle 1. listopadu')
    expect(page.body.slice(mon, mon + 80)).toContain('pondělí 2. listopadu')
    expect(sun).toBeGreaterThan(-1)
    expect(mon).toBeGreaterThan(sun)
    const sunday = page.body.slice(sun, mon)
    expect(sunday.indexOf('08:00')).toBeLessThan(sunday.indexOf('09:00'))
    expect(sunday).toContain('href="https://bohosluzby.dravec.org/kostel/2/"')
    expect(sunday).toContain('latinsky')
    const monday = page.body.slice(mon)
    expect(monday).toContain('07:00')
    expect(monday).toContain('18:00')
    expect(monday).toContain('za zemřelé')
  })

  // a whole diocese (Ostrava-Opava) last touched its entries in April 2024 —
  // hiding them emptied 12 city pages; the time is still the parish's own word
  it('lists a church whose schedule is older than 18 months with its date on the row', () => {
    const row = page.body.slice(page.body.indexOf('kaple sv. Anny'))
    expect(row.slice(0, 200)).toContain('rozpis ověřen naposledy 10. 1. 2022')
  })

  it('names the quarter when the city has several churches of one name', () => {
    const p = feastCityPage({
      city: { name: 'Ostrava', slug: 'ostrava', churches: [{ id: '7', name: 'farní kostel Nanebevzetí P. Marie', city: 'Hrabová, Ostrava' }] },
      entries: { '7': entry([['7', '09:00', 'česky', 0, '', '']]) },
      today: '2026-10-27',
    })
    expect(p.body).toContain('Nanebevzetí P. Marie</a>, Hrabová</span>')
  })

  it('names the source and the fact that parishes change feast schedules', () => {
    expect(page.body).toContain('bohosluzby.cirkev.cz')
    expect(page.body).toMatch(/ohlášk/)
  })

  it('counts its services, so a town with none on both days gets no page', () => {
    expect(page.services).toBe(5)
  })

  it('links the week view only where a city page exists', () => {
    expect(page.body).toContain('href="https://bohosluzby.dravec.org/mesto/brno/"')
    const small = feastCityPage({ city: { ...CITY, cityPage: false }, entries: ENTRIES, today: '2026-10-27' })
    expect(small.body).not.toContain('/mesto/')
    expect(small.body).toContain('Bohoslužby podle vaší polohy')
  })

  it('carries breadcrumb JSON-LD that cannot close its script tag', () => {
    const ld = JSON.parse(page.jsonLd)
    expect(ld['@type']).toBe('BreadcrumbList')
    expect(page.jsonLd).not.toContain('<')
  })

  it('escapes registry text', () => {
    const p = feastCityPage({
      city: { ...CITY, churches: [{ id: '9', name: 'kostel <script>', city: 'Brno' }] },
      entries: { '9': entry([['7', '09:00', 'česky', 0, '', 'a & b']]) },
      today: '2026-10-27',
    })
    expect(p.body).not.toContain('<script>')
    expect(p.body).toContain('a &amp; b')
  })
})

describe('feastHubPage — /dusicky/', () => {
  const hub = feastHubPage({ cities: [{ name: 'Praha', slug: 'praha', count: 200 }, { name: 'Brno', slug: 'brno', count: 80 }], today: '2026-10-27' })

  it('links every city page and states the dates', () => {
    expect(hub.url).toBe('https://bohosluzby.dravec.org/dusicky/')
    expect(hub.body).toContain('href="https://bohosluzby.dravec.org/dusicky/praha/"')
    expect(hub.body).toContain('href="https://bohosluzby.dravec.org/dusicky/brno/"')
    expect(hub.body).toContain('neděle 1. listopadu')
    expect(hub.body).toContain('pondělí 2. listopadu')
  })

  it('answers the common questions in visible text and as FAQ JSON-LD', () => {
    const ld = JSON.parse(hub.jsonLd)
    expect(ld['@type']).toBe('FAQPage')
    for (const q of ld.mainEntity) expect(hub.body).toContain(q.name)
  })
})

describe('churchFeastSection — the feast days on each /kostel/<id>/ page', () => {
  const e = ENTRIES['1']

  it('lists both days in the month before All Souls', () => {
    const html = churchFeastSection(e, '2026-10-27')
    expect(html).toContain('Všech svatých')
    expect(html).toContain('09:00')
    expect(html).toContain('18:00')
  })

  it('is empty outside that window', () => {
    expect(churchFeastSection(e, '2026-09-15')).toBe('')
    expect(churchFeastSection(e, '2026-11-03')).toBe('')
  })

  it('says plainly when the registry has nothing for a day', () => {
    const html = churchFeastSection(entry([['7', '09:00', 'česky', 0, '', '']]), '2026-10-27')
    expect(html).toContain('rejstřík neuvádí')
  })
})

describe('feastEvents — schema.org Event per feast-day service', () => {
  it('gives each service a dated start in Prague time', () => {
    const ev = feastEvents(ENTRIES['1'], '2026-10-27', { name: 'katedrála', url: 'https://x' })
    expect(ev.map((e) => e.startDate)).toEqual(['2026-11-01T09:00+01:00', '2026-11-02T07:00+01:00', '2026-11-02T18:00+01:00'])
    expect(ev[0].name).toContain('Všech svatých')
  })

  it('is empty outside the window', () => {
    expect(feastEvents(ENTRIES['1'], '2026-08-01', { name: 'k', url: 'u' })).toEqual([])
  })
})

describe('feastBeacon — the static pages count their own visit', () => {
  it('is empty without Supabase config', () => {
    expect(feastBeacon(undefined, 'k')).toBe('')
    expect(feastBeacon('https://x.supabase.co', undefined)).toBe('')
  })

  it('posts one page_view with the app ids, and cannot be broken out of', () => {
    const s = feastBeacon('https://x.supabase.co/', 'sb_publishable_</script>')
    expect(s).toContain('https://x.supabase.co/rest/v1/events')
    expect(s).toContain("event:'page_view'")
    expect(s).toContain("'fw:vid'")
    expect(s.match(/<\/script>/g)).toHaveLength(1)
    expect(s).not.toMatch(/\(\?<[=!]/) // no lookbehind (iOS 15)
  })
})

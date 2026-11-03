// Advent (roráty) and Christmas (půlnoční) town pages — DRAFT, see docs/SEASON-PAGES.md.
// The registry barely carries either (31 roráty rows, no 24 Dec one-offs), so the
// pages list only what is seasonal: roráty rows that run in Advent, and rows dated
// for 24–26 Dec. Every row says where it comes from.
import { adventOf, seasonCityPage, seasonHubPage } from './season'
import type { RawEntry } from './churchPage'

type Row = [string, string, string, 0 | 1, string, string]
const entry = (s: Row[], x: Row[] = [], u = '2026-05-01'): RawEntry => ({ u, p: 'Farnost', pa: '', c: [], s, x })
const CITY = {
  name: 'Brno',
  slug: 'brno',
  churches: [
    { id: '1', name: 'kostel sv. Jakuba', city: 'Brno' },
    { id: '2', name: 'kostel sv. Tomáše', city: 'Brno' },
    { id: '3', name: 'kostel sv. Michala', city: 'Brno' },
  ],
}

describe('adventOf — which Advent the pages are about', () => {
  it('1st Sunday of Advent to Christmas Eve; rolls over after Christmas', () => {
    expect(adventOf('2026-11-03')).toMatchObject({ year: 2026, start: '2026-11-29', end: '2026-12-24' })
    expect(adventOf('2026-12-24').year).toBe(2026)
    expect(adventOf('2026-12-27')).toMatchObject({ year: 2027, start: '2027-11-28', end: '2027-12-24' })
    expect(adventOf('2028-11-01').start).toBe('2028-12-03')
  })
})

describe('seasonCityPage advent — roráty', () => {
  const entries = {
    // a roráty-only row (type + "v adventu") and its ordinary-time pair
    '1': entry([
      ['12345', '06:30', 'česky', 0, 'rorátní mše sv.', 'v adventu'],
      ['12345', '06:30', 'česky', 0, 'mše sv.', 'kromě adventu'],
      ['7', '09:00', 'česky', 0, 'mše sv.', ''],
    ]),
    // the all-year Mass whose Advent form is roráty ("v adventu rorátní", #90)
    '2': entry([['35', '18:00', 'česky', 0, 'mše sv.', 'v adventu rorátní']], [], '2016-09-06'),
    // a one-off roráty the parish announced (applied by data/corrections.mjs)
    '3': entry([], [['2026-12-05', '07:00', 'česky', 0, 'rorátní mše sv.', '']]),
  }
  const corrections = [
    {
      id: '3',
      date: '2026-12-05',
      add: [['07:00', 'rorátní mše sv.']],
      source: 'https://example.cz/ohlasky.pdf',
      source_date: 'ohlášky 22. 11. 2026',
    },
  ]
  const page = seasonCityPage({ kind: 'advent', city: CITY, entries, corrections, today: '2026-11-03' })

  it('lists roráty only, chronological, with their Advent weekdays', () => {
    const rows = [...page.body.matchAll(/<li><span class="t">([^<]+)<\/span>/g)].map((m) => m[1])
    expect(rows).toEqual(['06:30', '07:00', '18:00'])
    expect(page.body).toContain('po–pá')
    expect(page.body).toContain('st, pá')
    expect(page.body).toContain('so 5. 12.')
    expect(page.body).not.toContain('09:00')
    expect(page.services).toBe(3)
  })

  it('says where each row comes from: the parish notice (linked) or the registry with its date', () => {
    expect(page.body).toContain('<a href="https://example.cz/ohlasky.pdf">ohlášky farnosti</a> (ohlášky 22. 11. 2026)')
    expect(page.body).toContain('rejstřík ČBK, ověřen 6. 9. 2016')
    expect(page.body).toContain('rejstřík ČBK, ověřen 1. 5. 2026')
  })

  it('skips a roráty row whose note names a past year ("v adventu 2019")', () => {
    const p = seasonCityPage({
      kind: 'advent',
      city: CITY,
      entries: { '1': entry([['35', '06:00', 'česky', 0, 'rorátní mše sv.', 'v adventu 2019'], ['24', '06:00', 'česky', 0, 'rorátní mše sv.', 'v adventu 2026']]) },
      corrections: [],
      today: '2026-11-03',
    })
    expect(p.services).toBe(1)
    expect(p.body).not.toContain('2019')
  })

  it('is a plain page: title, canonical url, no script, escapes registry text', () => {
    expect(page.url).toBe('https://bohosluzby.dravec.org/advent/brno/')
    expect(page.title).toContain('Roráty 2026')
    expect(page.title).toContain('Brno')
    expect(page.body).not.toContain('<script')
    const evil = seasonCityPage({
      kind: 'advent',
      city: { ...CITY, churches: [{ id: '9', name: 'kostel <b>', city: 'Brno' }] },
      entries: { '9': entry([['1', '06:00', 'česky', 0, 'rorátní mše sv.', 'v adventu & <i>']]) },
      corrections: [],
      today: '2026-11-03',
    })
    expect(evil.body).toContain('kostel &lt;b&gt;')
    expect(evil.body).toContain('&amp; &lt;i&gt;')
  })
})

describe('seasonCityPage vanoce — 24.–26. 12.', () => {
  const entries = {
    // Thursday 18:00 weekly: 24 Dec 2026 is a Thursday, but a weekly row says
    // nothing about Christmas Eve — not listed
    '1': entry([['4', '18:00', 'česky', 0, 'mše sv.', '']], [['2026-12-24', '24:00', 'česky', 0, 'mše sv.', 'půlnoční']]),
    '2': entry([['5', '09:00', 'česky', 0, 'mše sv.', '']], [['2026-12-25', '09:30', 'česky', 0, 'mše sv.', '']]),
    '3': entry([], [['2026-12-24', '08:00', 'česky', 0, 'mše sv.', '']]), // Christmas Eve morning: still Advent
  }
  const page = seasonCityPage({
    kind: 'vanoce',
    city: CITY,
    entries,
    corrections: [{ id: '1', date: '2026-12-24', add: [['24:00', 'mše sv.', 'půlnoční']], source: 'https://ex.cz/', source_date: 'vánoční pořad 2026' }],
    today: '2026-11-03',
  })

  it('lists only rows dated for the day, Christmas Eve from the afternoon', () => {
    expect(page.body).toContain('24:00')
    expect(page.body).toContain('půlnoční')
    expect(page.body).toContain('09:30')
    expect(page.body).not.toContain('18:00')
    expect(page.body).not.toContain('08:00')
    expect(page.body).not.toMatch(/<span class="t">09:00/)
    expect(page.url).toBe('https://bohosluzby.dravec.org/vanoce/brno/')
    expect(page.title).toContain('Vánoce 2026')
  })

  it('a day with nothing dated says so, plainly', () => {
    expect(page.body).toContain('sobota 26. prosince')
    expect(page.body).toContain('Zatím tu nic není')
  })
})

describe('seasonHubPage', () => {
  it('links every town page and says how many there are', () => {
    const hub = seasonHubPage({ kind: 'advent', towns: [{ name: 'Brno', slug: 'brno', count: 3 }], today: '2026-11-03' })
    expect(hub.url).toBe('https://bohosluzby.dravec.org/advent/')
    expect(hub.body).toContain('href="https://bohosluzby.dravec.org/advent/brno/"')
    expect(hub.body).not.toContain('<script')
  })
})

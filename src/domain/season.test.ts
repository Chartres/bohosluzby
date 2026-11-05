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

  it('lists the roráty time the note gives, not the weekly time of the row (Chrudim)', () => {
    const p = seasonCityPage({
      kind: 'advent',
      city: CITY,
      entries: {
        '1': entry([['6', '07:30', 'česky', 0, '', 'v adventu od 7:00 hodin roráty']]),
        '2': entry([['6', '07:30', 'česky', 0, '', 'zimní čas, v adventu od 6.30 hodin roráty']]),
      },
      corrections: [],
      today: '2026-11-03',
    })
    const times = [...p.body.matchAll(/<span class="t">([^<]+)<\/span>/g)].map((m) => m[1])
    expect(times).toEqual(['06:30', '07:00'])
  })

  it('leaves out Sundays (no roráty on an Advent Sunday) and year-round rows that never say Advent', () => {
    const p = seasonCityPage({
      kind: 'advent',
      city: CITY,
      entries: {
        '1': entry([['7', '08:30', 'česky', 0, 'mše sv.', 'v adventu rorátní'], ['357', '18:00', 'česky', 0, 'mše sv.', 'v adventu rorátní']]),
        '2': entry([['12346', '07:30', 'česky', 0, 'rorátní mše sv.', '']]),
      },
      corrections: [],
      today: '2026-11-03',
    })
    expect(p.services).toBe(1)
    expect(p.body).toContain('st, pá')
    expect(p.body).not.toContain('08:30')
    expect(p.body).not.toContain('07:30')
  })

  it('links only http(s) sources', () => {
    const p = seasonCityPage({
      kind: 'advent',
      city: CITY,
      entries: { '3': entry([], [['2026-12-05', '07:00', 'česky', 0, 'rorátní mše sv.', '']]) },
      corrections: [{ id: '3', date: '2026-12-05', add: [['7:00', 'rorátní mše sv.']], source: 'javascript:alert(1)', source_date: 'x' }],
      today: '2026-11-03',
    })
    expect(p.body).not.toContain('javascript:')
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

describe('seasonCityPage advent — a roráty notice over the whole Advent (pass 1 record)', () => {
  // one corrections.json entry: "roráty po–pá v 6:30" from 30 Nov, not on 8 Dec
  const notice = {
    id: '3',
    church: 'kostel sv. Michala',
    town: 'brno',
    from: '2026-11-30',
    to: '2026-12-23',
    days: '12345',
    except: ['2026-12-08'],
    add: [['06:30', 'mše sv.', 'roráty']],
    source: 'https://example.cz/ohlasky-22-11.pdf',
    source_date: 'ohlášky 22. 11. 2026',
  }
  // what data/corrections.mjs makes of it: one dated row per day, each with the source
  // (the expansion itself is tested in data/corrections.test.mjs and data/roraty-check.test.mjs)
  const dates: string[] = []
  for (let d = 30; d <= 53; d++) {
    const t = new Date(Date.UTC(2026, 10, d))
    const iso = t.toISOString().slice(0, 10)
    if (t.getUTCDay() >= 1 && t.getUTCDay() <= 5 && iso !== '2026-12-08') dates.push(iso)
  }
  const { from: _f, to: _t, days: _d, except: _e, ...rest } = notice
  const corrections = dates.map((date) => ({ ...rest, date }))
  const shards = { c: { '3': entry([['7', '09:00', 'česky', 0, 'mše sv.', '']], dates.map((d): Row => [d, '06:30', 'česky', 0, 'mše sv.', 'roráty'])) } }
  const page = seasonCityPage({ kind: 'advent', city: CITY, entries: shards.c, corrections, today: '2026-11-23' })

  it('lands as one row, not one per date: weekdays, first – last, the gap named', () => {
    const rows = [...page.body.matchAll(/<li>.*?<\/li>/g)]
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toContain('<span class="t">06:30</span>')
    expect(rows[0][0]).toContain('po–pá 30. 11. – 23. 12., kromě 8. 12.')
    expect(page.services).toBe(1)
  })

  it('links the notice and its date as the source', () => {
    expect(page.body).toContain('<a href="https://example.cz/ohlasky-22-11.pdf">ohlášky farnosti</a> (ohlášky 22. 11. 2026)')
    expect(page.body).not.toContain('rejstřík ČBK')
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

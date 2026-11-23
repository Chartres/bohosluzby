// Advent (roráty) and Christmas (půlnoční) town pages — DRAFT, see docs/SEASON-PAGES.md.
// The registry barely carries either (31 roráty rows, no 24 Dec one-offs), so the
// pages list only what is seasonal: roráty rows that run in Advent, and rows dated
// for 24–26 Dec. Every row says where it comes from.
import { adventOf, seasonCityPage, seasonHubPage, seasonSections } from './season'
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

// Pass 1, 22 Nov: a notice that confirms a Mass the registry already lists adds no dated row
// (data/corrections.mjs, "confirmed"), so the page builds the roráty row from the notice itself.
describe('seasonCityPage advent — a notice confirming a weekly registry Mass', () => {
  const tue = ['2026-12-01', '2026-12-15', '2026-12-22'] // 8 Dec is the solemnity
  const sat = ['2026-12-05', '2026-12-12', '2026-12-19']
  const fromNotice = (id: string, dates: string[], time: string) =>
    dates.map((date) => ({ id, date, add: [[time, 'mše sv.', 'roráty']], source: 'https://tyn.cz/a?b=1&c=2', source_date: 'aktuality 22. 11. 2026' }))

  it('Týn: the registry roráty row and the notice make one row, cited to the notice', () => {
    const entries = { '1': entry([['26', '07:00', 'česky', 0, 'rorátní mše sv.', 'v adventu']], [], '2016-09-06') }
    const page = seasonCityPage({ kind: 'advent', city: CITY, entries, corrections: fromNotice('1', [...tue, ...sat].sort(), '07:00'), today: '2026-11-22' })
    const rows = [...page.body.matchAll(/<li><span class="t">.*?<\/li>/g)].map((m) => m[0])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('út, so 1. 12. – 22. 12.')
    expect(rows[0]).toContain('href="https://tyn.cz/a?b=1&amp;c=2"')
    expect(rows[0]).not.toContain('rejstřík ČBK')
  })

  it('Stará Bělá: the ordinary weekday Mass the notice calls roráty is listed as roráty', () => {
    const entries = { '1': entry([['1234', '06:45', 'česky', 0, 'mše sv.', '']]) }
    const mon = ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21']
    const page = seasonCityPage({ kind: 'advent', city: CITY, entries, corrections: fromNotice('1', mon, '06:45'), today: '2026-11-22' })
    const rows = [...page.body.matchAll(/<li><span class="t">.*?<\/li>/g)].map((m) => m[0])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('<span class="t">06:45</span>')
    expect(rows[0]).toContain('po 30. 11. – 21. 12.')
    expect(rows[0]).toContain('roráty')
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
    const rows = [...page.body.split('<details')[0].matchAll(/<li>.*?<\/li>/g)]
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
    expect(page.body).toContain('V rejstříku ČBK zatím pro toto město na tento den nic není')
  })
})

// The Christmas pass (docs/VANOCE-PASS.md): 25 Dec 2026 is a Friday. A notice for "25. 12. v 9:00"
// at a church whose registry has Friday 9:00 is confirmed, not copied (data/corrections.mjs), so the
// shard gains no dated row. The page must still list it, from the notice.
describe('vanoce — a notice that confirms a weekly Mass is listed, with the notice as source', () => {
  const entries = { '2': entry([['5', '09:00', 'česky', 0, 'mše sv.', '']]) }
  const corrections = [{ id: '2', date: '2026-12-25', add: [['09:00', 'mše sv.', 'slavnost Narození Páně']], source: 'https://ex.cz/vanoce.pdf', source_date: 'vánoční pořad 2026' }]
  const s = seasonSections({ kind: 'vanoce', city: CITY, entries, corrections, today: '2026-12-14' })
  it('listed on its day, once', () => {
    expect(s[1].rows.map((r) => [r.churchId, r.time, r.note, r.source.from])).toEqual([['2', '09:00', 'slavnost Narození Páně', 'farnost']])
    expect(s[0].rows).toEqual([])
  })
  it('not twice when the shard has the dated row too', () => {
    const both = { '2': entry([['5', '09:00', 'česky', 0, 'mše sv.', '']], [['2026-12-25', '09:00', 'česky', 0, 'mše sv.', 'slavnost Narození Páně']]) }
    const t = seasonSections({ kind: 'vanoce', city: CITY, entries: both, corrections, today: '2026-12-14' })
    expect(t[1].rows).toHaveLength(1)
  })
  it('Christmas Eve before 15:00 stays off, from a notice too', () => {
    const morning = [{ id: '2', date: '2026-12-24', add: [['08:00', 'mše sv.', '']], source: 'https://ex.cz/v.pdf', source_date: 'vánoční pořad 2026' }]
    const t = seasonSections({ kind: 'vanoce', city: CITY, entries: { '2': entry([['4', '08:00', 'česky', 0, 'mše sv.', '']]) }, corrections: morning, today: '2026-12-14' })
    expect(t[0].rows).toEqual([])
  })
})

// GIRM 374–376: no votive Mass (roráty = votive Mass of Our Lady in Advent) on a
// solemnity or an Advent Sunday. Immaculate Conception is 8 Dec, or 9 Dec when the 8th is a Sunday.
describe('roráty — not on 8 Dec (Immaculate Conception) nor Advent Sundays', () => {
  const weekly = { '1': entry([['123456', '06:30', 'česky', 0, 'rorátní mše sv.', 'v adventu']]) }
  it('a weekly roráty row skips the solemnity', () => {
    const s = seasonSections({ kind: 'advent', city: CITY, entries: weekly, corrections: [], today: '2026-11-18' })
    expect(s[0].rows[0].dates).not.toContain('2026-12-08')
    expect(s[0].rows[0].dates).toContain('2026-12-09')
  })
  it('the solemnity moves to Monday 9 Dec when 8 Dec is an Advent Sunday (2024)', () => {
    const s = seasonSections({ kind: 'advent', city: CITY, entries: weekly, corrections: [], today: '2024-11-10' })
    expect(s[0].rows[0].dates).not.toContain('2024-12-08')
    expect(s[0].rows[0].dates).not.toContain('2024-12-09')
    expect(s[0].rows[0].dates).toContain('2024-12-10')
  })
  it('no Event in the JSON-LD on 8 Dec', () => {
    const p = seasonCityPage({ kind: 'advent', city: CITY, entries: weekly, corrections: [], today: '2026-11-18' })
    expect(p.jsonLd).not.toContain('2026-12-08T')
    expect(p.body).toContain('po–so, kromě 8. 12.')
  })
  it("a parish's own notice that lists 8 Dec stands, shown as theirs", () => {
    const p = seasonCityPage({
      kind: 'advent',
      city: CITY,
      entries: { '3': entry([], [['2026-12-08', '06:00', 'česky', 0, 'rorátní mše sv.', '']]) },
      corrections: [{ id: '3', date: '2026-12-08', add: [['06:00', 'rorátní mše sv.']], source: 'https://ex.cz/o.pdf', source_date: 'ohlášky 29. 11. 2026' }],
      today: '2026-11-18',
    })
    expect(p.body).toContain('út 8. 12.')
    expect(p.body).toContain('<a href="https://ex.cz/o.pdf">ohlášky farnosti</a>')
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

describe('seasonSections — which services a feast date gets', () => {
  it('Christmas: only rows dated 24 Dec from 15:00, 25 and 26 Dec; each with its real date', () => {
    const entries = {
      '1': entry([['4', '18:00', 'česky', 0, 'mše sv.', '']], [['2026-12-24', '24:00', 'česky', 0, 'mše sv.', 'půlnoční'], ['2026-12-24', '08:00', 'česky', 0, 'mše sv.', '']]),
      '2': entry([], [['2026-12-25', '09:30', 'slovensky', 1, 'sv. liturgie', ''], ['2026-12-27', '09:30', 'česky', 0, 'mše sv.', '']]),
    }
    const s = seasonSections({ kind: 'vanoce', city: CITY, entries, corrections: [], today: '2026-11-12' })
    expect(s.map((x) => x.date)).toEqual(['2026-12-24', '2026-12-25', '2026-12-26'])
    expect(s[0].rows.map((r) => [r.churchId, r.time, r.dates])).toEqual([['1', '24:00', ['2026-12-24']]])
    expect(s[1].rows.map((r) => [r.churchId, r.time, r.lang, r.greek])).toEqual([['2', '09:30', 'slovensky', true]])
    expect(s[2].rows).toEqual([])
  })

  it('roráty: a weekly row carries every Advent date it runs on (po–pá in Advent 2026 = 19 days)', () => {
    const s = seasonSections({ kind: 'advent', city: CITY, entries: { '1': entry([['12345', '06:30', 'česky', 0, 'rorátní mše sv.', 'v adventu']]) }, corrections: [], today: '2026-11-12' })
    expect(s).toHaveLength(1)
    const dates = s[0].rows[0].dates
    expect(dates).toHaveLength(18) // 19 weekdays minus 8 Dec
    expect(dates[0]).toBe('2026-11-30')
    expect(dates.at(-1)).toBe('2026-12-24')
  })
})

describe('season pages — honest when empty, dated, with Events and a Markdown twin', () => {
  const city = {
    name: 'Brno',
    slug: 'brno',
    churches: [
      { id: '1', name: 'kostel sv. Jakuba', city: 'Brno-střed', lat: 49.19645, lng: 16.60863, www: 'https://jakub.example.cz', access: true },
      { id: '2', name: 'kostel sv. Tomáše', city: 'Brno', lat: 49.2, lng: 16.6 },
      { id: '3', name: 'kaple sv. Michala', city: 'Brno' },
    ],
  }
  const entries = {
    '1': entry([], [['2026-12-24', '24:00', 'česky', 0, 'mše sv.', 'půlnoční']], '2026-05-01'),
    '2': entry([['7', '09:00', 'česky', 0, 'mše sv.', '']], [], '2019-03-02'),
  }
  const page = seasonCityPage({ kind: 'vanoce', city, entries, corrections: [], today: '2026-11-12', checked: '2026-10-27' })

  it('names the build date, the register date and the source', () => {
    expect(page.body).toContain('Aktualizováno 12. 11. 2026')
    expect(page.body).toContain('27. 10. 2026')
    expect(page.body).toContain('href="https://bohosluzby.cirkev.cz/"')
  })

  it('a church with nothing dated is listed, honestly, with where to check — never a made-up time', () => {
    expect(page.body).toMatch(/kostel sv\. Tomáše<\/a> — v rejstříku ČBK zatím bez vánočního rozpisu \(stav k 27\. 10\. 2026\)/)
    expect(page.body).not.toMatch(/<span class="t">09:00/)
    expect(page.missing).toBe(2)
    expect(page.services).toBe(1)
  })

  it('a day with nothing says so with the date we checked', () => {
    expect(page.body).toContain('V rejstříku ČBK zatím pro toto město na tento den nic není (stav k 27. 10. 2026). Další plánované načtení rejstříku: 3. 12. 2026.')
  })

  it('claims nothing about parishes: only what the registry snapshot shows', () => {
    const empty = seasonCityPage({ kind: 'vanoce', city, entries: {}, corrections: [], today: '2026-11-18', checked: '2026-10-27' })
    const emptyA = seasonCityPage({ kind: 'advent', city, entries: {}, corrections: [], today: '2026-11-18', checked: '2026-10-27' })
    const hub = seasonHubPage({ kind: 'advent', towns: [{ name: 'Brno', slug: 'brno', count: 0 }], today: '2026-11-18', checked: '2026-10-27' })
    for (const t of [empty.body, empty.markdown, empty.description, emptyA.body, emptyA.markdown, emptyA.description, hub.body, hub.markdown])
      expect(t).not.toMatch(/nezveřejn|zveřejnil/)
    expect(emptyA.description).not.toContain('0 záznamů')
    expect(emptyA.description).toContain('v rejstříku ČBK zatím bez záznamu')
  })

  it('JSON-LD parses; every node has an @type', () => {
    const hub = seasonHubPage({ kind: 'advent', towns: [], today: '2026-11-18' })
    for (const ld of [JSON.parse(page.jsonLd), JSON.parse(hub.jsonLd)]) {
      expect(ld['@context']).toBe('https://schema.org')
      for (const node of ld['@graph'] ?? [ld]) expect(node['@type']).toBeTruthy()
    }
  })

  it('every service is a schema.org Event; půlnoční 24:00 starts at midnight of the 25th', () => {
    const ld = JSON.parse(page.jsonLd)
    const events = ld['@graph'].filter((x: { '@type': string }) => x['@type'] === 'Event')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      startDate: '2026-12-25T00:00+01:00',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'Church', name: 'kostel sv. Jakuba', url: 'https://bohosluzby.dravec.org/kostel/1/' },
    })
    expect(ld['@graph'].some((x: { '@type': string }) => x['@type'] === 'BreadcrumbList')).toBe(true)
  })

  it('the Markdown twin holds every detail: church, address, time, rite, language, access, verified, link', () => {
    const md = page.markdown
    expect(md).toMatch(/^# Vánoce 2026/)
    expect(md).toContain('https://bohosluzby.dravec.org/vanoce/brno/')
    expect(md).toContain('bohosluzby.cirkev.cz')
    expect(md).toContain('2026-11-12')
    expect(md).toContain('2026-10-27')
    const row = md.split('\n').find((l) => l.includes('24:00'))!
    for (const s of ['kostel sv. Jakuba', 'Brno-střed', '49.19645, 16.60863', 'římskokatolický', 'česky', 'bezbariérový', '2026-05-01', 'https://bohosluzby.dravec.org/kostel/1/', 'půlnoční'])
      expect(row).toContain(s)
    expect(md).toContain('kostel sv. Tomáše')
    expect(md).toContain('https://jakub.example.cz')
    expect(md).not.toContain('<')
  })

  it('a town with nothing at all still gets an honest page', () => {
    const p = seasonCityPage({ kind: 'advent', city, entries: {}, corrections: [], today: '2026-11-12', checked: '2026-10-27' })
    expect(p.services).toBe(0)
    expect(p.missing).toBe(3)
    expect(p.body).toContain('v rejstříku ČBK zatím bez rorátů (stav k 27. 10. 2026)')
    expect(p.markdown).toContain('kaple sv. Michala')
  })

  it('the hub has a twin linking every town twin', () => {
    const hub = seasonHubPage({ kind: 'vanoce', towns: [{ name: 'Brno', slug: 'brno', count: 1 }], today: '2026-11-12', checked: '2026-10-27' })
    expect(hub.markdown).toContain('https://bohosluzby.dravec.org/vanoce/brno/index.md')
    expect(hub.markdown).toContain('2026-10-27')
  })
})

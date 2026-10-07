// Prerendered /kostel/<id>/ pages (scripts/prerender.mjs, web deploy only).
// Before these existed every church link — the share sheet, the .ics URL, the
// city pages' church lists — answered HTTP 404 on GitHub Pages (the SPA booted
// on top of 404.html, so people never noticed; crawlers and unfurlers did).
import { churchPage } from './churchPage'

const CHURCH = {
  id: '1',
  name: 'kostel Nejsvětějšího Salvátora',
  city: 'Praha 1',
  lat: 50.086,
  lng: 14.417,
  www: 'https://www.farnostsalvator.cz',
}
const ENTRY = {
  u: '2026-06-01',
  p: 'Akademická farnost Praha',
  pa: 'Křižovnické nám. 4, Praha 1',
  c: [['www', 'https://www.farnostsalvator.cz']] as [string, string][],
  s: [
    ['5', '18:00', 'česky', 0, 'mše sv.', ''],
    ['7', '20:00', 'česky', 0, 'mše sv.', 'studentská'],
    ['7', '14:00', 'Latine', 0, '', ''], // registry rows often omit the type
    ['7', '08:30 - 11:30', 'česky', 0, 'svátost smíření', ''],
  ] as [string, string, string, 0 | 1, string, string][],
  x: [
    ['2026-07-05', '15:00', 'česky', 0, 'pobožnost', 'první neděle'],
    ['2026-01-06', '18:00', 'česky', 0, 'mše sv.', 'Tři králové'], // past → not listed
  ] as [string, string, string, 0 | 1, string, string][],
}
const TODAY = '2026-07-03'

describe('church page', () => {
  const page = churchPage({ church: CHURCH, entry: ENTRY, today: TODAY, city: { slug: 'praha', name: 'Praha' } })

  it('has its own canonical URL, title and description', () => {
    expect(page.url).toBe('https://bohosluzby.dravec.org/kostel/1/')
    expect(page.title).toBe('kostel Nejsvětějšího Salvátora (Praha 1) — pořad bohoslužeb | Kam na mši')
    expect(page.description).toContain('neděle 14:00, 20:00')
    expect(page.description).toContain('aktualizace 1. 6. 2026')
    expect(page.description.length).toBeLessThanOrEqual(200)
  })

  it('does not repeat the city when the name already carries it', () => {
    const p = churchPage({
      church: { ...CHURCH, name: 'kostel sv. Jakuba, Brno', city: 'Brno' },
      entry: ENTRY,
      today: TODAY,
    })
    expect(p.title).toBe('kostel sv. Jakuba, Brno — pořad bohoslužeb | Kam na mši')
  })

  it('lists the regular schedule Sunday first (printed-ordo order), sorted by time', () => {
    const b = page.body
    expect(b).toContain('<h1>kostel Nejsvětějšího Salvátora</h1>')
    expect(b.indexOf('<h3>neděle</h3>')).toBeLessThan(b.indexOf('<h3>pátek</h3>'))
    expect(b.indexOf('14:00')).toBeLessThan(b.indexOf('20:00'))
    expect(b).toContain('20:00 mše sv. — studentská')
    // language normalized like the app does; a missing type reads as a service
    expect(b).toContain('14:00 bohoslužba (latinsky)')
  })

  it('keeps confession windows out of the Mass schedule', () => {
    const b = page.body
    const schedule = b.slice(b.indexOf('Pořad bohoslužeb'), b.indexOf('Svátost smíření'))
    expect(schedule).not.toContain('08:30 - 11:30')
    expect(b.slice(b.indexOf('Svátost smíření'))).toContain('08:30 - 11:30')
  })

  it('lists only upcoming one-off services', () => {
    expect(page.body).toContain('5. 7. 2026 15:00 pobožnost — první neděle')
    expect(page.body).not.toContain('Tři králové')
  })

  it('names its source and date, links the parish site and the city page', () => {
    const b = page.body
    expect(b).toContain('bohosluzby.cirkev.cz')
    expect(b).toContain('aktualizace 1. 6. 2026')
    expect(b).toContain('href="https://www.farnostsalvator.cz"')
    expect(b).toContain('href="https://bohosluzby.dravec.org/mesto/praha/"')
    expect(b).not.toContain('naposledy ověřen') // fresh entry: no stale warning
  })

  it('warns when the registry entry is older than 18 months', () => {
    const p = churchPage({ church: CHURCH, entry: { ...ENTRY, u: '2016-09-06' }, today: TODAY })
    expect(p.body).toContain('Rozpis byl naposledy ověřen 6. 9. 2016 — před cestou si ho ověřte u farnosti.')
  })

  it('escapes registry text (it is free text from a third party)', () => {
    const p = churchPage({
      church: { ...CHURCH, name: 'kaple <script>alert(1)</script> & "sv. Anny"' },
      entry: { ...ENTRY, s: [['7', '9:00', 'česky', 0, 'mše sv.', '<b>pozor</b>']] },
      today: TODAY,
    })
    expect(p.body).not.toContain('<script>')
    expect(p.body).not.toContain('<b>')
    expect(p.body).toContain('&lt;script&gt;')
    expect(p.title).toContain('&') // titles are escaped where they are written, not here
    expect(p.jsonLd).not.toContain('</script>')
  })

  it('describes the church as schema.org JSON-LD with place and coordinates', () => {
    const ld = JSON.parse(page.jsonLd)
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Church',
      name: 'kostel Nejsvětějšího Salvátora',
      url: 'https://www.farnostsalvator.cz',
      mainEntityOfPage: 'https://bohosluzby.dravec.org/kostel/1/',
      address: { '@type': 'PostalAddress', addressLocality: 'Praha 1', addressCountry: 'CZ' },
      geo: { '@type': 'GeoCoordinates', latitude: 50.086, longitude: 14.417 },
    })
  })

  it('a church without a website points JSON-LD at its own page', () => {
    const p = churchPage({ church: { ...CHURCH, www: undefined }, entry: ENTRY, today: TODAY })
    expect(JSON.parse(p.jsonLd).url).toBe('https://bohosluzby.dravec.org/kostel/1/')
  })

  it('a church with no shard entry still gets an honest page', () => {
    const p = churchPage({ church: CHURCH, entry: undefined, today: TODAY })
    expect(p.body).toContain('<h1>kostel Nejsvětějšího Salvátora</h1>')
    expect(p.body).toContain('bohosluzby.cirkev.cz')
    expect(p.body).not.toContain('<h2>Pořad bohoslužeb</h2>')
  })
})

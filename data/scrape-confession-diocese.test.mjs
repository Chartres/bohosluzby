// The pure parse + match logic of the diocesan confession scraper. The point is
// precision: a Prague table row parses to a verbatim {den,cas,note}; a
// dedication+place agreement resolves to the RIGHT church id (the two sv. Josefa
// churches must not be confused); an ambiguous or unmatched row returns null.
import { describe, it, expect } from 'vitest'
import { cellText, parseTables, rowsFromTable, placeTokens, matchChurch } from './scrape-confession-diocese.mjs'

const TABLE_HTML = `
<table><thead><tr>
  <th>DEN</th><th>ČAS</th><th>KOSTEL</th><th>MÍSTO</th><th>&nbsp;Poznámka</th>
</tr></thead><tbody>
<tr><td>Po – Pá <br>(kromě poslední so)</td><td>9.00 &#8211; 15.00</td>
    <td>Panny Marie Sněžné (Jungmannovo nám.)</td><td>Praha &#8211; Nové Město</td>
    <td>Běžná zpovědní služba: 30 min. přede mší sv.</td></tr>
<tr><td>Ne</td><td>9.00 &#8211; 9.45 16.00 &#8211; 16.45</td>
    <td>sv. Josefa (náměstí Republiky)</td><td>Praha &#8211; Nové Město</td><td></td></tr>
</tbody></table>`

// A slice of the real registry: two sv. Josefa churches in different Prague
// districts (the precision trap) plus the Sněžná church.
const CHURCHES = [
  { id: '100017', name: 'farní kostel Panny Marie Sněžné, Praha-Nové Město', city: 'Praha 1' },
  { id: '100013', name: 'klášterní kostel sv. Josefa, Praha-Malá Strana', city: 'Praha 1' },
  { id: '100019', name: 'klášterní kostel sv. Josefa, Praha-Nové Město', city: 'Praha 1' },
  { id: '1000663', name: 'poutní bazilika Nanebevzetí Panny Marie, Příbram-Svatá Hora', city: 'Příbram' },
  { id: '100038', name: 'filiální kostel Nanebevzetí Panny Marie, Praha-Nové Město', city: 'Praha 2' },
]

describe('cellText', () => {
  it('drops <br>, tags and decodes the en-dash / nbsp the tables use', () => {
    expect(cellText('9.00 <br>&#8211;&nbsp;15.00')).toBe('9.00 – 15.00')
  })
})

describe('parseTables + rowsFromTable', () => {
  const rows = rowsFromTable(parseTables(TABLE_HTML)[0])
  it('skips the header and yields one row per data <tr>', () => {
    expect(rows).toHaveLength(2)
  })
  it('parses a row to a verbatim {den, cas, note} (multi-range time kept intact)', () => {
    expect(rows[0]).toMatchObject({
      den: 'Po – Pá (kromě poslední so)',
      cas: '9.00 – 15.00',
      note: 'Běžná zpovědní služba: 30 min. přede mší sv.',
    })
    expect(rows[1].cas).toBe('9.00 – 9.45 16.00 – 16.45') // two windows, not parsed apart
  })
})

describe('placeTokens', () => {
  it('folds the MÍSTO to district tokens', () => {
    expect(placeTokens('Praha – Nové Město')).toEqual(['praha', 'nove', 'mesto'])
  })
})

describe('matchChurch (precision over coverage)', () => {
  it('matches on dedication + distinctive name', () => {
    expect(matchChurch('Panny Marie Sněžné (Jungmannovo nám.)', 'Praha – Nové Město', CHURCHES)).toBe('100017')
  })
  it('picks the RIGHT sv. Josefa by district (Nové Město, not Malá Strana)', () => {
    expect(matchChurch('sv. Josefa (náměstí Republiky)', 'Praha – Nové Město', CHURCHES)).toBe('100019')
  })
  it('pins Svatá Hora to Příbram, not a Praha Nanebevzetí church', () => {
    expect(matchChurch('Nanebevzetí Panny Marie (Svatá Hora)', 'Příbram', CHURCHES)).toBe('1000663')
  })
  it('returns null when nothing matches the dedication', () => {
    expect(matchChurch('sv. Bartoloměje', 'Praha – Nové Město', CHURCHES)).toBeNull()
  })
  it('returns null when place agrees but no dedication token does', () => {
    expect(matchChurch('sv. Mikuláše', 'Praha – Nové Město', CHURCHES)).toBeNull()
  })
})

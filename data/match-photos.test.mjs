// Precision of the photo matcher: the pure logic that decides which Commons
// file (if any) belongs to a church. The neighbour-bleed guard is the point —
// a nearby church's file must be REJECTED, the right one ACCEPTED, no match null.
import { describe, it, expect } from 'vitest'
import {
  dedicationTokens,
  fileQualifies,
  rankFiles,
  isReusableLicense,
  stripHtml,
  titleFromThumbUrl,
} from './match-photos.mjs'

describe('dedicationTokens', () => {
  it('keeps the patron, drops building nouns and sv.', () => {
    expect(dedicationTokens('farní kostel sv. Tomáše', 'Praha 1')).toEqual(['tomase'])
  })
  it('keeps feast + Marian name, drops Panny/bazilika', () => {
    expect(dedicationTokens('bazilika Nanebevzetí Panny Marie')).toEqual(['nanebevzeti', 'marie'])
  })
  it('splits multiple patrons and drops the trailing place segment', () => {
    expect(
      dedicationTokens('katedrála sv. Víta, Václava a Vojtěcha, Praha-Hradčany', 'Praha 1'),
    ).toEqual(['vita', 'vaclava', 'vojtecha'])
  })
})

describe('fileQualifies (neighbour-bleed guard)', () => {
  const tokens = dedicationTokens('farní kostel sv. Tomáše', 'Praha 1')
  it('ACCEPTS the correct church file', () => {
    expect(fileQualifies('File:Kostel svatého Tomáše (Praha).jpg', tokens)).toBe(true)
  })
  it('REJECTS a neighbouring church file (keyword but wrong patron)', () => {
    expect(fileQualifies('File:Kostel svatého Mikuláše (Praha).jpg', tokens)).toBe(false)
  })
  it('REJECTS a non-church file that happens to carry the patron name', () => {
    expect(fileQualifies('File:Ulice svatého Tomáše.jpg', tokens)).toBe(false)
  })
  it('REJECTS a street-name coincidence (sv. Josefa vs "Josefská" on a Tomáš file)', () => {
    const josef = dedicationTokens('klášterní kostel sv. Josefa', 'Praha 1')
    expect(fileQualifies('File:Josefská, kostel svatého Tomáše.jpg', josef)).toBe(false)
  })
})

// Brno run, 2026-10-25: right dedication, wrong subject — a view taken FROM the tower
// and the parish house. Geo-near + patron isn't enough when the file isn't of the church.
describe('fileQualifies (subject guard)', () => {
  it('REJECTS a view from the church', () => {
    const t = dedicationTokens('kostel farní sv. Jakuba Brno-město', 'Brno')
    expect(fileQualifies('File:Žerotínovo náměstí z věže kostela sv. Jakuba asi 1867.png', t)).toBe(false)
    expect(fileQualifies('File:View from the tower of St. James church Brno.jpg', ['james'])).toBe(false)
  })
  it('REJECTS the rectory / parish house', () => {
    const t = dedicationTokens('kostel rektorátní sv. Maří Magdalény Brno-město', 'Brno')
    expect(fileQualifies('File:Rectory of church of Saint Mary Magdalene in Brno, Brno-City District.jpg', t)).toBe(false)
    expect(fileQualifies('File:Fara u kostela sv. Tomáše.jpg', ['tomase'])).toBe(false)
  })
  it('REJECTS drawings and scans (png/svg/gif/tif) — the hero is a photo', () => {
    expect(fileQualifies('File:Kostel svatého Tomáše (Praha).png', ['tomase'])).toBe(false)
  })
  it('still ACCEPTS the church itself, square in the name or not', () => {
    expect(fileQualifies('File:Brno, Moravské náměstí, kostel svatého Tomáše.jpg', ['tomase'])).toBe(true)
    expect(fileQualifies('File:Kostel sv. Augustina Brno, vstup.jpg', ['augustina'])).toBe(true)
    // "pohled zleva" = a view of the church from the left, not a view from it
    expect(fileQualifies('File:Kostel Povýšení svatého Kříže - pohled zleva.jpg', ['povyseni'])).toBe(true)
  })
})

describe('titleFromThumbUrl', () => {
  it('recovers the File: title from a stored Commons thumbnail URL', () => {
    const u =
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Chr%C3%A1m_svat%C3%A9ho_V%C3%ADta%2C_Praha_-_Hrad%C4%8Dany_03.jpg/500px-Chr%C3%A1m_svat%C3%A9ho_V%C3%ADta%2C_Praha_-_Hrad%C4%8Dany_03.jpg?utm_source=x'
    expect(titleFromThumbUrl(u)).toBe('File:Chrám svatého Víta, Praha - Hradčany 03.jpg')
  })
})

describe('rankFiles', () => {
  const tokens = dedicationTokens('kostel sv. Víta', 'Brno')
  it('returns [] when nothing qualifies (no photo is the correct answer)', () => {
    expect(rankFiles(['File:Kostel svatého Jakuba.jpg'], tokens)).toEqual([])
  })
  it('puts the exterior before the interior/detail shot', () => {
    const ranked = rankFiles(
      ['File:Kostel sv. Víta interiér oltář.jpg', 'File:Kostel sv. Víta.jpg'],
      tokens,
    )
    expect(ranked[0]).toBe('File:Kostel sv. Víta.jpg')
  })
})

describe('isReusableLicense', () => {
  it('accepts CC / public domain', () => {
    expect(isReusableLicense('CC BY-SA 4.0')).toBe(true)
    expect(isReusableLicense('Public domain')).toBe(true)
    expect(isReusableLicense('CC0')).toBe(true)
  })
  it('rejects all-rights-reserved and empty', () => {
    expect(isReusableLicense('All rights reserved')).toBe(false)
    expect(isReusableLicense('')).toBe(false)
  })
})

describe('stripHtml', () => {
  it('reduces an anchor blob to plain text', () => {
    expect(stripHtml('<a href="/wiki/User:Jan">Jan Novák</a>')).toBe('Jan Novák')
    expect(stripHtml('Foo &amp; Bar')).toBe('Foo & Bar')
  })
})

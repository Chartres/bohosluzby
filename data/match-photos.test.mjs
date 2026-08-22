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

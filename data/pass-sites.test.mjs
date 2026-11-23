// The site list a data pass reads (docs/VANOCE-PASS.md, docs/RORATY-PASS.md): the largest towns,
// one entry per parish website with the churches it covers, and the sites known to block
// automated reads (data/pass-blocked.json) left out up front, never worked around.
import { describe, it, expect } from 'vitest'
import { passSites } from './pass-sites.mjs'

const index = [
  { id: '1', name: 'kostel A', city: 'Brno', lat: 49.19, lng: 16.6, cell: '49-16', www: 'https://a.cz' },
  { id: '2', name: 'kaple A2', city: 'Brno', lat: 49.19, lng: 16.61, cell: '49-16', www: 'https://a.cz' },
  { id: '3', name: 'kostel B', city: 'Brno', lat: 49.2, lng: 16.6, cell: '49-16', www: 'https://blocked.cz' },
  { id: '4', name: 'kostel C', city: 'Brno', lat: 49.2, lng: 16.62, cell: '49-16' },
  { id: '5', name: 'kostel D', city: 'Jihlava', lat: 49.4, lng: 15.59, cell: '49-15', www: 'https://d.cz' },
]
const shards = {
  '49-16': { 1: { p: 'farnost A', s: [['12345', '06:30', 'česky', 0, 'mše sv.', 'v adventu roráty']] }, 2: { p: 'farnost A', s: [] }, 3: { p: 'farnost B', s: [] }, 4: { p: 'farnost C', s: [] } },
  '49-15': { 5: { p: 'farnost D', s: [] } },
}

describe('passSites', () => {
  const out = passSites({ index, shards, towns: 1, blocked: [{ site: 'https://blocked.cz', reason: 'Cloudflare challenge' }], mark: /rorát/i })
  it('the largest towns first, one entry per website with its churches', () => {
    expect(out.map((t) => t.town)).toEqual(['Brno'])
    expect(out[0].sites.map((s) => s.site)).toEqual(['https://a.cz', '(no web) farnost C'])
    expect(out[0].sites[0].churches.map((c) => c.id)).toEqual(['1', '2'])
  })
  it('flags a site whose registry rows already mention the season', () => {
    expect(out[0].sites[0].marked).toBe(true)
  })
  it('known bot walls are listed apart, with the reason, never queued', () => {
    expect(out[0].blocked).toEqual([{ site: 'https://blocked.cz', reason: 'Cloudflare challenge', churches: ['3'] }])
  })
})

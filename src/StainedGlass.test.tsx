// The stained-glass band (Pavol's pick, 24 Nov 2026): panes cut from a jittered grid, so no
// slivers; the same day gives the same window; colours from glassPalette (src/domain/glass.ts).
import { glassPanes } from './StainedGlass'

describe('glassPanes', () => {
  it('the same day, the same window; the next day, another', () => {
    expect(glassPanes(20261130, 390, 10, 'violet')).toEqual(glassPanes(20261130, 390, 10, 'violet'))
    expect(glassPanes(20261201, 390, 10, 'violet')).not.toEqual(glassPanes(20261130, 390, 10, 'violet'))
  })
  it('covers the band with even panes: about one every 15 px a row, never a cluster', () => {
    const panes = glassPanes(20261130, 390, 10, 'violet')
    expect(panes.length).toBeGreaterThan(390 / 15)
    expect(panes.length).toBeLessThan(4 * (390 / 15 + 3))
    const inside = panes.filter((p) => p.x >= 0 && p.x <= 390)
    for (let i = 0; i < 390; i += 30) expect(inside.some((p) => Math.abs(p.x - i) < 20)).toBe(true)
  })
  it('most panes are the season colour, a few are accents', () => {
    const panes = glassPanes(20261130, 1200, 10, 'violet')
    const accents = panes.filter((p) => p.accent).length
    expect(accents / panes.length).toBeGreaterThan(0.03)
    expect(accents / panes.length).toBeLessThan(0.25)
  })
})

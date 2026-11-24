import { glassPalette, oklchToHex, type GlassColor } from './glass'

const hexL = (h: string) => {
  // relative luminance (WCAG)
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

describe('oklchToHex', () => {
  it('converts known colours', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff')
    expect(oklchToHex(0, 0, 0)).toBe('#000000')
  })
})

describe('glassPalette', () => {
  const colors: GlassColor[] = ['violet', 'green', 'gold', 'red']
  it('is the same palette for the same day (seed)', () => {
    expect(glassPalette('violet', 20261130)).toEqual(glassPalette('violet', 20261130))
  })
  it('varies from day to day', () => {
    const days = new Set(Array.from({ length: 7 }, (_, i) => glassPalette('violet', 20261130 + i).glass.join()))
    expect(days.size).toBe(7)
  })
  it.each(colors)('%s: every pane stays deep enough to read as glass, never muddy or neon', (c) => {
    for (let s = 0; s < 60; s++) {
      const p = glassPalette(c, 20260000 + s * 37)
      expect(p.glass.length).toBeGreaterThanOrEqual(4)
      for (const h of [...p.glass, ...p.accents]) {
        expect(h).toMatch(/^#[0-9a-f]{6}$/)
        const L = hexL(h)
        expect(L).toBeGreaterThan(0.02)
        expect(L).toBeLessThan(0.55)
      }
    }
  })
  it('the lead is darker than every pane', () => {
    const p = glassPalette('gold', 1)
    for (const h of p.glass) expect(hexL(p.lead)).toBeLessThan(hexL(h))
  })
})

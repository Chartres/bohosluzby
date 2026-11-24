// Stained glass in the liturgical colour (Pavol, 23 Nov 2026: "a variation every day, in
// liturgical colour, and still looking reliably beautiful"). The palette is built in OKLCH,
// where equal steps look equal: panes are the season's hue with small hue and lightness
// shifts (analogous, so they never clash), plus one or two accents a glazier would use with
// that colour (gold and deep blue with violet, ruby with green…). The day's date is the seed,
// so a day keeps its window and the next day gets a new one.

export type GlassColor = 'violet' | 'green' | 'gold' | 'red'

// base hue (OKLCH degrees), chroma, and the accents traditional windows pair with it
const BASE: Record<GlassColor, { h: number; c: number; L?: [number, number]; spread?: number; accents: [number, number, number][] }> = {
  violet: { h: 305, c: 0.12, accents: [[0.58, 0.12, 85], [0.4, 0.12, 262], [0.42, 0.13, 15]] },
  green: { h: 150, c: 0.1, accents: [[0.6, 0.12, 85], [0.4, 0.14, 25], [0.42, 0.1, 240]] },
  gold: { h: 82, c: 0.11, L: [0.5, 0.7], accents: [[0.42, 0.12, 262], [0.42, 0.14, 25], [0.45, 0.1, 150]] },
  red: { h: 27, c: 0.15, spread: 8, accents: [[0.6, 0.12, 85], [0.38, 0.12, 262], [0.42, 0.1, 305]] },
}

function rng(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

/** OKLCH → sRGB hex, chroma reduced until it fits the gamut. */
export function oklchToHex(L: number, C: number, hDeg: number): string {
  for (let c = C; ; c -= 0.005) {
    const h = (hDeg * Math.PI) / 180
    const a = Math.max(0, c) * Math.cos(h)
    const b = Math.max(0, c) * Math.sin(h)
    const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    const lin = [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ]
    const inGamut = lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4)
    if (inGamut || c <= 0) {
      return '#' + lin.map((v) => {
        const x = Math.min(1, Math.max(0, v))
        const g = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
        return Math.round(g * 255).toString(16).padStart(2, '0')
      }).join('')
    }
  }
}

export interface GlassPalette {
  /** the season's panes, most of the window */
  glass: string[]
  /** one or two accent panes, used sparingly */
  accents: string[]
  /** the lead came between panes */
  lead: string
}

export function glassPalette(color: GlassColor, seed: number): GlassPalette {
  const r = rng(seed)
  const base = BASE[color]
  const hue = base.h + (r() - 0.5) * (base.spread ? 10 : 24) // the day's tint of the season colour
  const spread = base.spread ?? 10 + r() * 14 // how far the panes wander from it
  const glass = Array.from({ length: 5 }, (_, i) => {
    const [lo, hi] = base.L ?? [0.34, 0.54]
    const L = lo + (i / 4) * (hi - lo) + (r() - 0.5) * 0.04
    const C = base.c * (0.75 + r() * 0.45)
    return oklchToHex(L, C, hue + (r() - 0.5) * 2 * spread)
  })
  const picks = [...base.accents].sort(() => r() - 0.5).slice(0, r() < 0.5 ? 1 : 2)
  const accents = picks.map(([L, C, h]) => oklchToHex(L, C, h + (r() - 0.5) * 10))
  return { glass, accents, lead: oklchToHex(0.2, 0.01, hue) }
}

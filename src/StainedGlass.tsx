// The signature (Pavol, 24 Nov 2026): the masthead's season rule is a band of stained glass in
// the day's liturgical colour, under the arch mark and the wordmark.
// Procedural, no images: panes are cut from a jittered grid (even sizes, no slivers), leaded by
// a Voronoi edge, coloured by glassPalette (src/domain/glass.ts). The Prague date seeds the window,
// so a day keeps its glass and the next day gets new glass. Nothing moves.
import { useEffect, useRef } from 'react'
import { glassPalette, type GlassColor } from './domain/glass'

function rng(seed: number) {
  let s = seed >>> 0
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32
}

export interface Pane {
  x: number
  y: number
  color: string
  accent: boolean
}

/** The panes of a band `width` × `height` px for one day (seed YYYYMMDD) and colour. */
export function glassPanes(seed: number, width: number, height: number, color: GlassColor): Pane[] {
  const r = rng(seed)
  const pal = glassPalette(color, seed)
  const step = 15
  const panes: Pane[] = []
  for (let row = -1; row <= 2; row++) {
    for (let x = -step + (row % 2) * (step / 2); x < width + step; x += step) {
      const accent = r() < 0.12
      const list = accent ? pal.accents : pal.glass
      panes.push({
        x: x + (r() - 0.5) * step * 0.7,
        y: (row + 0.5) * (height / 1.6) + (r() - 0.5) * height * 0.5,
        color: list[Math.floor(r() * list.length)],
        accent,
      })
    }
  }
  return panes
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export function GlassBand({ seed, color, height = 10 }: { seed: number; color: GlassColor; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext?.('2d')
    if (!c || !ctx) return // no canvas (tests, very old WebViews): the band's background colour stays
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth || 390
      c.width = Math.round(w * dpr)
      c.height = Math.round(height * dpr)
      const panes = glassPanes(seed, w, height, color).map((p) => ({ ...p, rgb: rgb(p.color) }))
      const lead = rgb(glassPalette(color, seed).lead)
      const img = ctx.createImageData(c.width, c.height)
      for (let py = 0; py < c.height; py++) {
        for (let px = 0; px < c.width; px++) {
          const x = px / dpr
          const y = py / dpr
          let d1 = Infinity
          let d2 = Infinity
          let best = panes[0]
          for (const p of panes) {
            const d = (p.x - x) ** 2 + (p.y - y) ** 2
            if (d < d1) {
              d2 = d1
              d1 = d
              best = p
            } else if (d < d2) d2 = d
          }
          const edge = Math.sqrt(d2) - Math.sqrt(d1) < 0.9
          // light through glass: a little brighter towards the middle of a pane
          const glow = 1 + 0.3 * Math.max(0, 1 - Math.sqrt(d1) / 10)
          const i = (py * c.width + px) * 4
          const [R, G, B] = edge ? lead : best.rgb.map((v) => Math.min(255, v * glow))
          img.data[i] = R
          img.data[i + 1] = G
          img.data[i + 2] = B
          img.data[i + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
    }
    draw()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null
    ro?.observe(c)
    return () => ro?.disconnect()
  }, [seed, color, height])
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-glass={color}
      data-seed={seed}
      className="block w-full"
      style={{ height, backgroundColor: 'var(--season)' }}
    />
  )
}

/** The app icon's arch (public/favicon.svg), set before the wordmark in the season's rubric red. */
export function ArchMark({ size = 22 }: { size?: number }) {
  return (
    <svg data-mark="" aria-hidden="true" viewBox="0 0 32 32" width={size} height={size} className="mr-1.5 inline-block align-[-0.12em]">
      <path
        fill="var(--color-rubric)"
        fillRule="evenodd"
        d="M8 28 L8 13 A13 13 0 0 1 16 3 A13 13 0 0 1 24 13 L24 28 Z M11.5 28 L11.5 13 A7.5 7.5 0 0 1 16 6.5 A7.5 7.5 0 0 1 20.5 13 L20.5 28 Z"
      />
    </svg>
  )
}

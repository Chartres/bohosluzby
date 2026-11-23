// PROTOTYPE (not for merge): five seasonal design proposals for Pavol, 23 Nov 2026.
// ?navrh=1..5 — 1 věnec (photo), 2 nástěnka (photo), 3 vitráž (procedural),
// 4 úsvit (sky from the real sun position), 5 rubrika (typography).
import { useEffect, useRef } from 'react'
import { glassPalette, type GlassColor } from '../domain/glass'

// ?radek=a|b|c — row verbs: a icons only, b a text line under the meta, c none (the time unfolds them)
export const RADEK = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('radek') ?? '' : ''
export const PROPOSAL = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('navrh') ?? 0) : 0

// --- 3: stained glass, procedural (Voronoi cells, lead lines), seeded by the date -------------
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
export function GlassBand({ seed, height = 10, color = 'violet' }: { seed: number; height?: number; color?: GlassColor }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = height
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    const ctx = c.getContext('2d')!
    const r = rng(seed)
    const pal = glassPalette(color, seed)
    const pick = () => (r() < 0.12 ? pal.accents[Math.floor(r() * pal.accents.length)] : pal.glass[Math.floor(r() * pal.glass.length)])
    // a jittered grid, not random points: even-sized panes as a glazier cuts them, no slivers
    const pts: { x: number; y: number; c: string }[] = []
    const step = 15
    for (let row = -1; row <= 2; row++)
      for (let x = -step + (row % 2) * (step / 2); x < w + step; x += step)
        pts.push({ x: x + (r() - 0.5) * step * 0.7, y: (row + 0.5) * (h / 1.6) + (r() - 0.5) * h * 0.5, c: pick() })
    const lead = pal.lead
    const img = ctx.createImageData(c.width, c.height)
    const hex = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
    for (let py = 0; py < c.height; py++) {
      for (let px = 0; px < c.width; px++) {
        const x = px / dpr
        const y = py / dpr
        let d1 = Infinity, d2 = Infinity, best = pts[0]
        for (const p of pts) {
          const d = (p.x - x) ** 2 + (p.y - y) ** 2
          if (d < d1) { d2 = d1; d1 = d; best = p } else if (d < d2) d2 = d
        }
        const edge = Math.sqrt(d2) - Math.sqrt(d1) < 0.9
        const [R, G, B] = hex(best.c)
        // light through glass: brighter in the middle of a cell, a little grain
        const glow = 1 + 0.35 * Math.max(0, 1 - Math.sqrt(d1) / 10) + (r() - 0.5) * 0.06
        const i = (py * c.width + px) * 4
        img.data[i] = edge ? parseInt(lead.slice(1, 3), 16) : Math.min(255, R * glow)
        img.data[i + 1] = edge ? parseInt(lead.slice(3, 5), 16) : Math.min(255, G * glow)
        img.data[i + 2] = edge ? parseInt(lead.slice(5, 7), 16) : Math.min(255, B * glow)
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [seed, height, color])
  return <canvas ref={ref} aria-hidden="true" style={{ display: 'block', width: '100%', height }} />
}

// --- 4: the sky at the user's position, from the sun's real altitude ------------------------
function sunAltitude(date: Date, lat: number, lng: number) {
  const rad = Math.PI / 180
  const d = date.getTime() / 86400000 - 10957.5 // days since J2000
  const g = (357.529 + 0.98560028 * d) * rad
  const q = 280.459 + 0.98564736 * d
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad
  const e = (23.439 - 0.00000036 * d) * rad
  const dec = Math.asin(Math.sin(e) * Math.sin(L))
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24
  const ha = ((gmst * 15 + lng) * rad - ra)
  return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad
}
export function sunrise(date: Date, lat: number, lng: number): Date | null {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  for (let m = 0; m < 24 * 60; m += 2) {
    const t = new Date(start.getTime() + m * 60000)
    if (sunAltitude(t, lat, lng) > -0.833 && sunAltitude(new Date(t.getTime() - 120000), lat, lng) <= -0.833) return t
  }
  return null
}
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k))
export function skyGradient(now: Date, lat: number, lng: number): string | null {
  const alt = sunAltitude(now, lat, lng)
  if (alt > -1) return null // after sunrise the masthead is paper again
  // night → astronomical dawn → civil dawn → day, colours from real dawn photographs
  const stops: [number, number[], number[]][] = [
    [-18, [14, 18, 38], [24, 28, 56]],
    [-12, [24, 30, 66], [58, 48, 96]],
    [-6, [52, 58, 110], [176, 110, 120]],
    [0, [118, 140, 190], [242, 176, 120]],
    [10, [150, 190, 230], [236, 222, 190]],
  ]
  let i = stops.findIndex((s) => alt < s[0])
  if (i <= 0) i = i === 0 ? 1 : stops.length - 1
  const [a0, top0, bot0] = stops[i - 1]
  const [a1, top1, bot1] = stops[i]
  const k = Math.max(0, Math.min(1, (alt - a0) / (a1 - a0)))
  const top = mix(top0, top1, k)
  const bot = mix(bot0, bot1, k)
  return `linear-gradient(to bottom, rgb(${top}), rgb(${bot}))`
}

// --- shared bits ---------------------------------------------------------------------------
const ADVENT1 = Date.UTC(2026, 10, 29) // 1st Sunday of Advent 2026
export function adventWeek(now: Date) {
  const days = Math.floor((now.getTime() - ADVENT1) / 86400000)
  return days < 0 || days > 27 ? 0 : Math.floor(days / 7) + 1
}
const ORD = ['', 'první', 'druhá', 'třetí', 'čtvrtá']
const CREDIT = 'text-[10px] leading-tight text-ink-faded'

// --- 1: the wreath, a real photograph, the week's candle named ------------------------------
export function WreathStrip({ now }: { now: Date }) {
  const w = adventWeek(now)
  if (!w) return null
  return (
    <figure className="mt-2 flex items-center gap-3">
      <img src="/proto/wreath.jpg" alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full object-cover" />
      <figcaption className="text-sm leading-snug">
        <span className="font-semibold" style={{ color: 'var(--season)' }}>{w}. týden adventu</span>
        <span className="text-ink-faded"> · na věnci hoří {ORD[w]} svíce</span>
        <span className={`block ${CREDIT}`}>foto: Wikimedia Commons, CC BY-SA</span>
      </figcaption>
    </figure>
  )
}

// --- 2: the parish notice board, a real photograph; what the notices told us ----------------
export function NoticeBoard() {
  return (
    <section className="mt-3 overflow-hidden border border-hairline">
      <img src="/proto/board.jpg" alt="" className="block h-24 w-full object-cover" />
      <div className="px-3 py-2 text-sm leading-snug">
        <p className="text-xs font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--season)' }}>Z ohlášek farností</p>
        <p className="mt-1">Roráty podle ohlášek ze 17 kostelů, každý řádek s odkazem na ohlášky.</p>
        <p className="mt-1 text-ink-faded">Ostatní farnosti ohlášky na advent zatím nevyvěsily. Díváme se znovu ve čtvrtek.</p>
      </div>
    </section>
  )
}

// --- 3: stained glass in place of the season rule -------------------------------------------
export function seedOf(now: Date) {
  return Number(now.toISOString().slice(0, 10).replace(/-/g, ''))
}

// --- 4: the dawn sky behind the masthead ----------------------------------------------------
export function DawnLine({ now, lat, lng }: { now: Date; lat: number; lng: number }) {
  const sr = sunrise(now, lat, lng)
  if (!sr) return null
  const hm = sr.toLocaleTimeString('cs-CZ', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Prague' })
  if (now >= sr) return null
  const before = true
  return (
    <p className="mt-1 text-xs" style={{ color: 'rgba(255,248,235,.85)' }}>
      Slunce vyjde v {hm}{before ? ' · roráty začínají za tmy' : ''}
    </p>
  )
}

// --- 5: the missal: a rubric line, a ribbon on today, two footer slots ----------------------
export function Rubric() {
  return (
    <p className="mt-1 font-display text-sm italic" style={{ color: 'var(--season)' }}>
      Rosu dejte, nebesa, shůry <span className="not-italic text-ink-faded">· Iz 45,8</span>
    </p>
  )
}
export function Ribbon() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-8 top-full block h-12 w-[8px]"
      style={{
        background: 'linear-gradient(90deg, color-mix(in srgb, var(--season) 80%, black), var(--season) 45%, color-mix(in srgb, var(--season) 75%, black))',
        clipPath: 'polygon(0 0,100% 0,100% 100%,50% 88%,0 100%)',
        boxShadow: '0 1px 2px rgba(0,0,0,.2)',
      }}
    />
  )
}
export function FooterSlots() {
  return (
    <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="font-semibold" style={{ color: 'var(--season)' }}>V adventu</dt>
      <dd>roráty v řádku dnů; časy z ohlášek mají odkaz na zdroj.</dd>
      <dt className="font-semibold" style={{ color: 'var(--season)' }}>Opravili jsme</dt>
      <dd>22. 11. Liberec-Ruprechtice: roráty v pátek v 6:30 podle ohlášek.</dd>
    </dl>
  )
}

// gallery for Pavol: four liturgical colours, a week of days each
export function GlassGallery() {
  const colors: [GlassColor, string][] = [['violet', 'fialová · advent, půst'], ['green', 'zelená · liturgické mezidobí'], ['gold', 'bílá/zlatá · Vánoce, Velikonoce'], ['red', 'červená · Letnice, mučedníci']]
  const days = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne']
  return (
    <div className="py-3">
      {colors.map(([c, name]) => (
        <section key={c} className="mb-4">
          <p className="mb-1 text-xs font-semibold tracking-[0.08em] uppercase text-ink-faded">{name}</p>
          {days.map((d, i) => (
            <div key={d} className="mb-1 flex items-center gap-2">
              <span className="w-5 text-xs text-ink-faded">{d}</span>
              <div className="flex-1"><GlassBand seed={20261130 + i} color={c} /></div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

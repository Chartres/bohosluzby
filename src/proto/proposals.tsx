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
        <span className={`block ${CREDIT}`}>foto Kora27 · CC BY-SA 4.0 · Wikimedia Commons</span>
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
        <p className={`mt-1 ${CREDIT}`}>foto vývěska v Dolních Chabrech, ŠJů · CC BY-SA 4.0</p>
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

// --- 6: the next Mass as a photograph of the church you'll walk into ----------------------
// photos.json holds real Commons photos for ~1,450 churches; the first row gets one, full bleed.
import { loadData } from '../lib/dataStore'
import { useState } from 'react'
type Photo = { url: string; credit: string; license: string }
export function usePhotos() {
  const [p, setP] = useState<Record<string, Photo>>({})
  useEffect(() => {
    loadData<Record<string, Photo>>('photos.json').then(setP).catch(() => {})
  }, [])
  return p
}
export function PhotoHero({ photo, time, until, name, meta, onOpen }: { photo?: Photo; time: string; until: string; name: string; meta: string; onOpen: () => void }) {
  if (!photo) return null
  const big = photo.url.replace(/\/\d+px-/, '/960px-')
  return (
    <button type="button" onClick={onOpen} className="relative -mx-5 mt-3 block w-[calc(100%+2.5rem)] overflow-hidden text-left sm:-mx-8 sm:w-[calc(100%+4rem)]">
      <img src={big} alt="" className="block h-64 w-full object-cover" />
      <span className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(20,16,12,.88) 0%, rgba(20,16,12,.6) 50%, rgba(20,16,12,0) 80%)' }} />
      <span className="absolute inset-x-5 bottom-4 block text-[#fbf6ea] sm:inset-x-8">
        <span className="block text-xs font-semibold tracking-[0.1em] uppercase opacity-80">nejbližší · {until}</span>
        <span className="font-display block text-5xl font-semibold tabular-nums leading-none">{time}</span>
        <span className="font-display mt-1 block text-lg leading-snug font-semibold">{name}</span>
        <span className="block text-sm opacity-80">{meta}</span>
      </span>
      <span className="absolute top-2 right-3 text-[10px] text-white/70">foto {photo.credit} · {photo.license}</span>
    </button>
  )
}

// --- 7: light through the window: the day's glass falls on the page -----------------------
export function WindowLight({ seed, color = 'violet' }: { seed: number; color?: GlassColor }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const w = window.innerWidth
    const h = Math.round(window.innerHeight * 0.9)
    c.width = Math.round(w / 2)
    c.height = Math.round(h / 2)
    const ctx = c.getContext('2d')!
    const r = rng(seed + 7)
    const pal = glassPalette(color, seed)
    // the window's panes fall on the page as one slanted patch, the way light from a high
    // window lies on a church floor: a lancet (pointed arch) of panes, skewed and stretched
    const cols = 6, rows = 9, pw = c.width * 0.11, ph = c.height * 0.075
    ctx.save()
    ctx.translate(c.width * 0.42, c.height * 0.02)
    ctx.transform(1, 0, 0.62, 1, 0, 0) // the sun is low and to the left
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // pointed arch at the top: the outer columns start lower
        const arch = Math.abs(col - (cols - 1) / 2) / ((cols - 1) / 2)
        if (row < Math.round(arch * arch * 3)) continue
        const pick = r() < 0.16 ? pal.accents[Math.floor(r() * pal.accents.length)] : pal.glass[Math.floor(r() * pal.glass.length)]
        ctx.globalAlpha = 0.85 * (1 - (row / rows) * 0.55)
        ctx.fillStyle = pick
        ctx.fillRect(col * pw + 1.2, row * ph + 1.2, pw - 2.4, ph - 2.4)
      }
    }
    ctx.restore()
  }, [seed, color])
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-0"
      style={{ width: '100%', height: '90vh', filter: 'blur(7px) saturate(1.5)', opacity: 0.42, mixBlendMode: 'multiply' }}
    />
  )
}

// --- 8: roráty by candlelight: before sunrise the page is the dark church -----------------
export function CandleNight({ on }: { on: boolean }) {
  if (!on) return null
  return (
    <style>{`
      header.sticky { background: linear-gradient(rgba(14,11,8,.55), rgba(14,11,8,.92)), url(/proto/rorate.jpg) center 60% / cover !important; padding-bottom: 2.2rem !important; }
      header.sticky::after { content: 'foto HubertSt · CC BY-SA 4.0'; position: absolute; right: 1.25rem; bottom: .35rem; font-size: 10px; color: rgba(241,230,207,.55); }
      header.sticky { position: sticky; }
      :root { --color-paper:#16120d; --color-ink:#f1e6cf; --color-ink-faded:#a8987a; --color-hairline:#3a3024; --season:#b996e0 !important; }
      body { background:#16120d; }
      ol[data-testid="seznam"] li .font-display.text-2xl {
        color:#ffe2a8;
        text-shadow: 0 0 6px rgba(255,190,90,.55), 0 0 18px rgba(255,150,40,.35);
        animation: flame 2.6s infinite alternate ease-in-out;
      }
      ol[data-testid="seznam"] li:nth-child(2n) .font-display.text-2xl { animation-duration: 3.1s; animation-delay: -.7s }
      ol[data-testid="seznam"] li:nth-child(3n) .font-display.text-2xl { animation-duration: 2.2s; animation-delay: -1.3s }
      @keyframes flame {
        0% { text-shadow: 0 0 6px rgba(255,190,90,.55), 0 0 18px rgba(255,150,40,.35) }
        35% { text-shadow: 0 0 5px rgba(255,190,90,.45), 0 0 14px rgba(255,150,40,.28) }
        60% { text-shadow: 0 0 8px rgba(255,200,100,.65), 0 0 22px rgba(255,150,40,.42) }
        100% { text-shadow: 0 0 6px rgba(255,185,85,.5), 0 0 17px rgba(255,150,40,.32) }
      }
      @media (prefers-reduced-motion: reduce) { ol[data-testid="seznam"] li .font-display.text-2xl { animation: none } }
    `}</style>
  )
}
export function beforeSunrise(now: Date, lat: number, lng: number) {
  const sr = sunrise(now, lat, lng)
  return !!sr && now < sr
}

// Rasterize PWA icons + the native icon/splash sources from the cross mark using
// Playwright (no native SVG tools needed). Outputs PWA icons to public/icons/
// and @capacitor/assets sources to resources/. Run: node scripts/gen-icons.mjs
// then (for native) `npx capacitor-assets generate --ios`.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT = 'public/icons'
const RES = 'resources'
mkdirSync(OUT, { recursive: true })
mkdirSync(RES, { recursive: true })

// Gothic pointed arch (lancet portal) centred in a 32x32 box (matches
// public/favicon.svg): outer silhouette minus inner opening (evenodd) = a frame.
const markSVG = (color) => `
  <path fill="${color}" fill-rule="evenodd"
    d="M8 28 L8 13 A13 13 0 0 1 16 3 A13 13 0 0 1 24 13 L24 28 Z
       M11.5 28 L11.5 13 A7.5 7.5 0 0 1 16 6.5 A7.5 7.5 0 0 1 20.5 13 L20.5 28 Z"/>`

const RUBRIC = '#9a2b1e'

function pageSVG(px, bg, markScale, markColor = RUBRIC) {
  const m = px * markScale
  const off = (px - m) / 2
  return `<!doctype html><meta charset="utf-8">
  <style>html,body{margin:0}#c{width:${px}px;height:${px}px;background:${bg}}</style>
  <div id="c"><svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${off} ${off}) scale(${m / 32})">${markSVG(markColor)}</g>
  </svg></div>`
}

const PAPER = '#f6f1e5'
const INK = '#1a1712'

const jobs = [
  // PWA / web icons
  { dir: OUT, file: 'icon-192.png', px: 192, bg: PAPER, scale: 0.86 },
  { dir: OUT, file: 'icon-512.png', px: 512, bg: PAPER, scale: 0.86 },
  { dir: OUT, file: 'maskable-512.png', px: 512, bg: PAPER, scale: 0.6 },
  { dir: OUT, file: 'apple-touch-icon.png', px: 180, bg: PAPER, scale: 0.7 },
  // Native sources for @capacitor/assets (App Store icon must be opaque, no alpha).
  // 0.70 mark: 1/φ ≈ 0.62 read small at homescreen size — HIG grids run the
  // key shape nearer 70% of the canvas.
  { dir: RES, file: 'icon.png', px: 1024, bg: PAPER, scale: 0.7 },
  { dir: RES, file: 'splash.png', px: 2732, bg: PAPER, scale: 0.16 },
  { dir: RES, file: 'splash-dark.png', px: 2732, bg: INK, scale: 0.16, mark: PAPER },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const j of jobs) {
  await page.setViewportSize({ width: j.px, height: j.px })
  await page.setContent(pageSVG(j.px, j.bg, j.scale, j.mark ?? RUBRIC))
  await page.locator('#c').screenshot({ path: `${j.dir}/${j.file}` })
  console.log(`  ${j.dir}/${j.file} (${j.px}px)`)
}
await browser.close()
console.log('icons done')

// Rasterize PWA icons from the cross mark using Playwright (no native SVG tools needed).
// Outputs to public/icons/. Run: node scripts/gen-icons.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT = 'public/icons'
mkdirSync(OUT, { recursive: true })

// Latin cross in rubric red, centred in a 32x32 box (matches public/favicon.svg).
const mark = `
  <rect x="14" y="4" width="4" height="24" fill="#9a2b1e"/>
  <rect x="7" y="10" width="18" height="4" fill="#9a2b1e"/>`

function pageSVG(px, bg, markScale) {
  const m = px * markScale
  const off = (px - m) / 2
  return `<!doctype html><meta charset="utf-8">
  <style>html,body{margin:0}#c{width:${px}px;height:${px}px;background:${bg}}</style>
  <div id="c"><svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${off} ${off}) scale(${m / 32})">${mark}</g>
  </svg></div>`
}

const PAPER = '#f6f1e5'

const jobs = [
  { file: 'icon-192.png', px: 192, bg: PAPER, scale: 0.86 },
  { file: 'icon-512.png', px: 512, bg: PAPER, scale: 0.86 },
  { file: 'maskable-512.png', px: 512, bg: PAPER, scale: 0.6 },
  { file: 'apple-touch-icon.png', px: 180, bg: PAPER, scale: 0.7 },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const j of jobs) {
  await page.setViewportSize({ width: j.px, height: j.px })
  await page.setContent(pageSVG(j.px, j.bg, j.scale))
  await page.locator('#c').screenshot({ path: `${OUT}/${j.file}` })
  console.log(`  ${OUT}/${j.file} (${j.px}px)`)
}
await browser.close()
console.log('icons done')

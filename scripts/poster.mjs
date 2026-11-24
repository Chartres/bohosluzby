// The church notice-board poster (Pavol, 24 Nov 2026): A4, one QR code that opens /app/
// (src/domain/appLink.ts: iPhone → App Store, Android → Play once live, else the web app),
// in the app's own look: paper and ink, Fraunces, the stained glass in the season's colour
// (src/domain/glass.ts) and a ribbon bookmark.
//   node --experimental-strip-types scripts/poster.mjs   → store-assets/poster/plakat-a4.{pdf,png}
//   (a sandbox whose Playwright build differs: PW_CHROMIUM=/path/to/chrome)
// After writing, the QR in the rendered page is decoded (jsqr) and must give the /app/ URL.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { APP_LINK_URL } from '../src/domain/appLink.ts'
import { glassPalette } from '../src/domain/glass.ts'

const ROOT = `${dirname(fileURLToPath(import.meta.url))}/../`
export const QR_MM = 70
const PAPER = '#f6f1e5'
const INK = '#1a1712'
const FADED = '#655c4d'
const RUBRIC = '#9a2b1e'
const HAIR = '#d8d0bd'
const VIOLET = '#5b3a7e'

function fontFaces() {
  const f = (pkg, file) => readFileSync(`${ROOT}node_modules/${pkg}/files/${file}`).toString('base64')
  const face = (family, data, weight, range) =>
    `@font-face { font-family: '${family}'; src: url(data:font/woff2;base64,${data}) format('woff2'); font-weight: ${weight}; unicode-range: ${range}; }`
  const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
  const EXT = 'U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
  return [
    face('Fraunces', f('@fontsource-variable/fraunces', 'fraunces-latin-opsz-normal.woff2'), '100 900', LATIN),
    face('Fraunces', f('@fontsource-variable/fraunces', 'fraunces-latin-ext-opsz-normal.woff2'), '100 900', EXT),
    face('Source Sans 3', f('@fontsource/source-sans-3', 'source-sans-3-latin-400-normal.woff2'), 400, LATIN),
    face('Source Sans 3', f('@fontsource/source-sans-3', 'source-sans-3-latin-ext-400-normal.woff2'), 400, EXT),
    face('Source Sans 3', f('@fontsource/source-sans-3', 'source-sans-3-latin-600-normal.woff2'), 600, LATIN),
    face('Source Sans 3', f('@fontsource/source-sans-3', 'source-sans-3-latin-ext-600-normal.woff2'), 600, EXT),
  ].join('\n')
}

/** The poster as one self-contained HTML page. `seed` picks the window (YYYYMMDD). */
export async function posterHtml({ fonts = fontFaces(), seed = 20261129, color = 'violet' } = {}) {
  const qr = (await QRCode.toString(APP_LINK_URL, { type: 'svg', errorCorrectionLevel: 'Q', margin: 4, color: { dark: INK, light: PAPER } }))
    .replace('<svg ', `<svg class="qr" data-url="${APP_LINK_URL}" role="img" aria-label="QR kód: ${APP_LINK_URL}" `)
  const pal = glassPalette(color, seed)
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><title>Kam na mši — plakát</title>
<style>
${fonts}
@page { size: A4 portrait; margin: 0 }
* { box-sizing: border-box }
html, body { margin: 0; background: ${PAPER}; color: ${INK}; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; font-family: 'Source Sans 3', sans-serif }
#glass { position: absolute; top: 0; left: 0; width: 210mm; height: 20mm; display: block }
.ribbon { position: absolute; top: 20mm; right: 30mm; width: 9mm; height: 78mm;
  background: linear-gradient(90deg, #3f2758, ${VIOLET} 45%, #47305f);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 92%, 0 100%) }
.body { position: absolute; top: 40mm; left: 24mm; right: 24mm; bottom: 26mm; display: flex; flex-direction: column }
.rubric { color: ${RUBRIC}; font-weight: 600; font-variant-caps: all-small-caps; letter-spacing: .06em; font-size: 15pt }
h1 { font-family: 'Fraunces', serif; font-weight: 650; font-size: 58pt; line-height: 1; margin: 3mm 0 0; letter-spacing: -.01em }
.lead { font-family: 'Fraunces', serif; font-style: italic; font-size: 22pt; margin: 5mm 0 0; color: ${VIOLET} }
.rule { border: 0; border-top: .35mm solid ${HAIR}; margin: 9mm 0 7mm; width: 100% }
.what { margin: 0; padding: 0; list-style: none; font-size: 15pt; line-height: 1.45 }
.what li { padding-left: 7mm; position: relative; margin: 0 0 2.5mm }
.what li::before { content: '✠'; position: absolute; left: 0; color: ${RUBRIC}; font-size: 11pt; top: .8mm }
.scan { margin: auto 0; display: flex; align-items: center; gap: 10mm }
.qr { width: ${QR_MM}mm; height: ${QR_MM}mm; flex: none }
.scan .rubric { font-size: 17pt }
.url { font-family: 'Fraunces', serif; font-size: 21pt; margin: 2mm 0 0 }
.where { font-size: 12pt; color: ${FADED}; margin: 4mm 0 0; line-height: 1.4 }
.foot { position: absolute; left: 24mm; right: 24mm; bottom: 12mm; border-top: .35mm solid ${HAIR}; padding-top: 3mm; font-size: 10pt; color: ${FADED} }
</style></head>
<body><div class="page">
<canvas id="glass" width="2480" height="236"></canvas>
<div class="ribbon"></div>
<div class="body">
  <div class="rubric">Katolické bohoslužby v Česku</div>
  <h1>Kam na mši</h1>
  <p class="lead">Mše svatá poblíž, právě teď</p>
  <hr class="rule">
  <ul class="what">
    <li>Ukáže nejbližší mše svaté podle toho, kde právě jste.</li>
    <li>V adventu roráty, o Vánocích půlnoční, podle ohlášek farností.</li>
    <li>Zdarma, bez reklam a bez registrace.</li>
  </ul>
  <div class="scan">
    ${qr}
    <div>
      <div class="rubric">Naskenujte telefonem</div>
      <div class="url">bohosluzby.dravec.org</div>
      <p class="where">Na iPhonu otevře aplikaci v App Store,<br>jinde stránku v prohlížeči.</p>
    </div>
  </div>
</div>
<div class="foot">Data z rejstříku bohoslužeb ČBK a z ohlášek farností</div>
</div>
<script>
// the stained glass (src/domain/glass.ts palette): a jittered grid of panes, lead between them
(() => {
  const pal = ${JSON.stringify(pal)}
  const c = document.getElementById('glass'), ctx = c.getContext('2d'), w = c.width, h = c.height
  let s = ${seed} >>> 0
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  const hex = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16))
  const pick = () => hex(r() < 0.14 ? pal.accents[Math.floor(r() * pal.accents.length)] : pal.glass[Math.floor(r() * pal.glass.length)])
  const step = 120, pts = []
  for (let row = -1; row <= 3; row++)
    for (let x = -step + (row % 2) * step / 2; x < w + step; x += step)
      pts.push({ x: x + (r() - 0.5) * step * 0.7, y: (row + 0.5) * (h / 2.4) + (r() - 0.5) * h * 0.35, c: pick() })
  const lead = hex(pal.lead), img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let d1 = Infinity, d2 = Infinity, best = pts[0]
    for (const p of pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < d1) { d2 = d1; d1 = d; best = p } else if (d < d2) d2 = d }
    const edge = Math.sqrt(d2) - Math.sqrt(d1) < 7
    const g = edge ? 1 : 1 + 0.3 * Math.max(0, 1 - Math.sqrt(d1) / 80)
    const col = edge ? lead : best.c, i = (y * w + x) * 4
    img.data[i] = Math.min(255, col[0] * g); img.data[i + 1] = Math.min(255, col[1] * g); img.data[i + 2] = Math.min(255, col[2] * g); img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  document.body.dataset.ready = '1'
})()
</script>
</body></html>`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { chromium } = await import('playwright')
  const { PNG } = await import('pngjs')
  const jsQR = (await import('jsqr')).default
  const out = `${ROOT}store-assets/poster/`
  mkdirSync(out, { recursive: true })
  const html = await posterHtml()
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 })
  await page.setContent(html)
  await page.waitForSelector('body[data-ready="1"]', { timeout: 120_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({ path: `${out}plakat-a4.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
  await page.screenshot({ path: `${out}plakat-a4.png` })
  const qrShot = await page.locator('svg.qr').screenshot({ scale: 'device' })
  await browser.close()
  const png = PNG.sync.read(qrShot)
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
  if (code?.data !== APP_LINK_URL) {
    console.error(`✗ QR decodes to ${JSON.stringify(code?.data)}, expected ${APP_LINK_URL}`)
    process.exit(1)
  }
  console.log(`✓ QR decodes to ${code.data}`)
  console.log(`wrote ${out}plakat-a4.pdf and .png`)
}

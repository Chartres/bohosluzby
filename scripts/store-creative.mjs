// App Store "Header and Search Results" creative assets (new product-page slots, iOS 27+).
// Composed from the committed store screenshots in the app's own type and colours, so they
// never show a screen the app doesn't have. Regenerate after the screenshots change:
//   node scripts/store-creative.mjs            (needs Playwright's Chromium; PW_CHROMIUM=…)
// Output (no alpha, PNG), sizes per Apple's creative assets specifications:
//   store-assets/ios/creative/header-3840x1646.png         product page header, 21:9
//   store-assets/ios/creative/search-results-3840x2560.png  search results card, 3:2
// Uploaded by hand in App Store Connect with the next version (Pavol, 8 Nov 2026):
//   version → Product Page Information → Header and Search Results.
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = `${root}store-assets/ios/creative`
const b64 = (p) => readFileSync(`${root}${p}`).toString('base64')
const font = (p) => `url(data:font/woff2;base64,${b64(`node_modules/${p}`)}) format('woff2')`
const shot = (name) => `data:image/png;base64,${b64(`store-assets/ios/iphone-6.9/${name}.png`)}`

const css = `
@font-face { font-family: Fraunces; src: ${font('@fontsource-variable/fraunces/files/fraunces-latin-ext-opsz-normal.woff2')}; font-weight: 100 900; unicode-range: U+0100-024F; }
@font-face { font-family: Fraunces; src: ${font('@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2')}; font-weight: 100 900; unicode-range: U+0000-00FF; }
@font-face { font-family: Sans; src: ${font('@fontsource/source-sans-3/files/source-sans-3-latin-ext-400-normal.woff2')}; unicode-range: U+0100-024F; }
@font-face { font-family: Sans; src: ${font('@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2')}; unicode-range: U+0000-00FF; }
* { margin: 0; box-sizing: border-box; }
html, body { background: #f6f1e5; color: #1a1712; }
body { width: var(--w); height: var(--h); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.mark { width: var(--mark); height: var(--mark); }
h1 { font-family: Fraunces; font-weight: 600; font-size: var(--title); line-height: 1; letter-spacing: -0.01em; }
p { font-family: Sans; font-size: var(--lead); color: #655c4d; line-height: 1.25; }
.rule { height: calc(var(--lead) * 0.12); width: calc(var(--title) * 1.6); background: #9a2b1e; margin: calc(var(--lead) * 0.7) 0; }
.phone { height: var(--phone); aspect-ratio: 1320 / 2868; border-radius: calc(var(--phone) * 0.07); overflow: hidden;
  border: calc(var(--phone) * 0.012) solid #1a1712; background: #1a1712; box-shadow: 0 calc(var(--phone) * 0.02) calc(var(--phone) * 0.06) rgba(26,23,18,.18); }
.phone img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: calc(var(--phone) * 0.058); }
.phones { display: flex; gap: calc(var(--phone) * 0.08); align-items: center; }
.phones .phone:nth-child(2) { transform: translateY(calc(var(--phone) * 0.06)); }
`
const MARK = `<svg class="mark" viewBox="0 0 32 32"><path fill="#9a2b1e" fill-rule="evenodd" d="M8 28 L8 13 A13 13 0 0 1 16 3 A13 13 0 0 1 24 13 L24 28 Z M11.5 28 L11.5 13 A7.5 7.5 0 0 1 16 6.5 A7.5 7.5 0 0 1 20.5 13 L20.5 28 Z"/></svg>`
const words = (align) => `<div style="text-align:${align}">${MARK}<h1 style="margin-top:calc(var(--lead)*0.5)">Kam na mši</h1><div class="rule" style="${align === 'center' ? 'margin-inline:auto' : ''}"></div><p>Nejbližší mše svatá podle polohy.<br>Kterou dnes ještě stihnete.</p></div>`
const phones = `<div class="phones"><div class="phone"><img src="${shot('1-map')}"></div><div class="phone"><img src="${shot('3-detail')}"></div></div>`

const ASSETS = [
  {
    // 21:9, fixed size. Key content kept in the middle half of the width (the header is
    // cropped on narrower screens).
    file: 'header-3840x1646.png', w: 3840, h: 1646,
    vars: { '--title': '220px', '--lead': '84px', '--mark': '150px', '--phone': '1300px' },
    body: `<div style="display:flex;align-items:center;gap:200px">${words('left')}${phones}</div>`,
  },
  {
    file: 'search-results-3840x2560.png', w: 3840, h: 2560,
    vars: { '--title': '210px', '--lead': '84px', '--mark': '140px', '--phone': '1320px' },
    body: `<div style="display:flex;flex-direction:column;align-items:center;gap:110px">${words('center')}${phones}</div>`,
  },
]

mkdirSync(out, { recursive: true })
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
for (const a of ASSETS) {
  const page = await browser.newPage({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 1 })
  const vars = Object.entries({ '--w': `${a.w}px`, '--h': `${a.h}px`, ...a.vars }).map(([k, v]) => `${k}:${v}`).join(';')
  await page.setContent(`<!doctype html><html style="${vars}"><head><meta charset="utf-8"><style>${css}</style></head><body>${a.body}</body></html>`)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  // opaque PNG: Apple rejects images with an alpha channel
  await page.screenshot({ path: `${out}/${a.file}`, omitBackground: false })
  console.log(`${a.file} ${a.w}x${a.h}`)
  await page.close()
}
await browser.close()

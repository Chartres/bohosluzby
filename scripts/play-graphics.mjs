// Google Play graphics from the same sources as the app icon (resources/icon.png):
//   store-assets/android/icon-512.png        512×512 (Play's hi-res icon)
//   store-assets/android/feature-graphic.png 1024×500 (required by Play)
// Deterministic, rendered with the repo's Playwright Chromium — same idea as the
// flywheel og-image generator. Re-run after a brand/tagline change.
//   node scripts/play-graphics.mjs   (PW_CHROMIUM=/path/to/chromium in sandboxes)
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'

const OUT = 'store-assets/android'
mkdirSync(OUT, { recursive: true })
const icon = `data:image/png;base64,${readFileSync('resources/icon.png').toString('base64')}`

const feature = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:#f6f1e5;}
  body{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;color:#1a1712;position:relative}
  .bar{position:absolute;left:0;top:0;bottom:0;width:18px;background:#9a2b1e}
  .row{position:absolute;left:84px;top:0;bottom:0;right:64px;display:flex;align-items:center;gap:44px}
  .mark{width:210px;height:210px;border-radius:44px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.16);flex:none}
  .mark img{width:100%;height:100%;display:block}
  h1{margin:0;font-size:78px;line-height:1.02;letter-spacing:-.01em}
  p{margin:14px 0 0;font-size:31px;line-height:1.25;max-width:600px;opacity:.86}
  .foot{position:absolute;left:84px;bottom:36px;font-size:24px;color:#9a2b1e;font-weight:600}
</style></head><body><div class="bar"></div>
<div class="row"><div class="mark"><img src="${icon}"></div>
<div><h1>Kam na mši</h1><p>Nejbližší mše svatá podle vaší polohy — kterou ještě stihnete. Celá ČR, offline.</p></div></div>
<div class="foot">zdarma · bez reklam · bez registrace</div></body></html>`

const iconPage = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:512px;height:512px;overflow:hidden;background:#f6f1e5}
  img{width:512px;height:512px;display:block}
</style></head><body><img src="${icon}"></body></html>`

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
})
try {
  const p1 = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })
  await p1.setContent(feature, { waitUntil: 'load' })
  await p1.screenshot({ path: `${OUT}/feature-graphic.png`, type: 'png' })
  const p2 = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })
  await p2.setContent(iconPage, { waitUntil: 'load' })
  await p2.screenshot({ path: `${OUT}/icon-512.png`, type: 'png' })
  console.log(`wrote ${OUT}/feature-graphic.png (1024×500) + ${OUT}/icon-512.png (512×512)`)
} finally {
  await browser.close()
}

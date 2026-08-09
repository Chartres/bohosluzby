// Regression guard: a single church time-chip must stay GLUED to its geographic
// point. The device symptom (build 60, iPhone) was one chip visibly travelling
// relative to the map on pan — root cause was reusing marker DOM nodes across
// renders (an off-cycle render could recreate one node mid-settle; WKWebView
// also committed a reused composited node a frame late). The fix rebuilds
// markers fresh and stops off-cycle renders (callback refs); this test pins the
// invariant those rely on.
//
// Invariant, checked WITHOUT a test hook via the always-present origin marker:
// a chip's screen vector to the origin is a pure function of geography + zoom —
// UNCHANGED by a pan, and SCALED ×2 by a one-step zoom-in. A travelling chip
// breaks it. Deterministic (mock data + stubbed paper tiles) so it runs in CI.
// NOTE: the reuse/compositing failure is WKWebView-specific and not reproducible
// in headless Chrome; this guards position-correctness and would catch any
// coordinate regression. Final travel confirmation is on-device.
import { test, expect, type Page } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'], viewport: { width: 440, height: 900 } })

const PAPER_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4+/waAAVvAqtuqbGpAAAAAElFTkSuQmCC',
  'base64',
)

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PAPER_TILE }),
  )
})

const center = (r: { left: number; top: number; width: number; height: number }): [number, number] => [
  r.left + r.width / 2,
  r.top + r.height / 2,
]

// Each single chip's screen-space vector FROM the origin marker, keyed by the
// church name (aria-label, present on singles only — clusters have none).
const chipVectorsToOrigin = (page: Page) =>
  page.evaluate(() => {
    const origin = document.querySelector('.map-origin-wrap')?.getBoundingClientRect()
    if (!origin) return null
    const ox = origin.left + origin.width / 2
    const oy = origin.top + origin.height / 2
    const out: Record<string, [number, number]> = {}
    document.querySelectorAll('.leaflet-marker-icon[aria-label]').forEach((icon) => {
      const key = icon.getAttribute('aria-label') || ''
      const r = icon.getBoundingClientRect()
      out[key] = [r.left + r.width / 2 - ox, r.top + r.height / 2 - oy]
    })
    return out
  })

test('chips stay glued to geography across a pan (vector to origin is pan-invariant)', async ({ page }) => {
  await page.goto('/?zobrazeni=mapa')
  await expect(page.locator('.map-chip').first()).toBeVisible()
  await page.waitForTimeout(600)

  const before = await chipVectorsToOrigin(page)
  expect(before && Object.keys(before).length).toBeGreaterThanOrEqual(2)

  await page.mouse.move(300, 760)
  await page.mouse.down()
  await page.mouse.move(200, 690, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(900) // settle the moveend render

  const after = await chipVectorsToOrigin(page)
  const common = Object.keys(before!).filter((k) => k in after!)
  expect(common.length).toBeGreaterThanOrEqual(2)

  const drift = common.map((k) => Math.hypot(after![k][0] - before![k][0], after![k][1] - before![k][1]))
  // eslint-disable-next-line no-console
  console.log('GLUE pan drift px:', common.map((k, i) => `${k}=${drift[i].toFixed(1)}`).join(' '))
  // Every chip holds its position relative to the origin → it moved with the map.
  expect(Math.max(...drift)).toBeLessThanOrEqual(2)
})

test('chips stay glued to geography across a zoom (vector to origin scales ×2)', async ({ page }) => {
  await page.goto('/?zobrazeni=mapa')
  await expect(page.locator('.map-chip').first()).toBeVisible()
  await page.waitForTimeout(600)

  const before = await chipVectorsToOrigin(page)
  await page.locator('.leaflet-control-zoom-in').click() // one step: zoom 13 → 14, pixel scale ×2
  await page.waitForTimeout(900)
  const after = await chipVectorsToOrigin(page)

  const common = Object.keys(before!).filter((k) => k in after!)
  expect(common.length).toBeGreaterThanOrEqual(1)
  // Measure the most-distant common chip: a long vector is dominated by the real
  // geometry, not by per-marker integer rounding or cluster-membership shifts
  // that muddy short ones. One clean check that a fixed geo point scales ×2.
  const far = common.reduce((a, b) =>
    Math.hypot(...before![b]) > Math.hypot(...before![a]) ? b : a,
  )
  const ratio = Math.hypot(...after![far]) / Math.hypot(...before![far])
  // eslint-disable-next-line no-console
  console.log(`ZOOM ${far}: ${Math.hypot(...before![far]).toFixed(0)}→${Math.hypot(...after![far]).toFixed(0)} ratio ${ratio.toFixed(3)}`)
  // Expect ≈2 (one zoom level doubles the pixel scale). Band is wide: this test
  // only guards against a chip left BEHIND on zoom — the precise position guard
  // is the pan test above. Leaflet's zoom-settle + edge re-clustering add a few %.
  expect(ratio).toBeGreaterThan(1.7)
  expect(ratio).toBeLessThan(2.3)
})

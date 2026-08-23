// Regression: pinch-zoom "jumped" on release — Leaflet's default zoomSnap:1
// snapped a fractional pinch to the nearest whole zoom on finger-lift (owner
// report, build 70). The map is now created with zoomSnap:0 so it rests at the
// exact fractional zoom. setZoom routes through the same _limitZoom the gesture
// uses, so this catches the exact regression without simulating touch.
import { test, expect } from '@playwright/test'
import { PRAGUE } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'], viewport: { width: 393, height: 760 } })

test('map rests at a fractional zoom (zoomSnap:0, no jump on release)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bohosluzby:introSeen', '1'))
  await page.goto('/?zobrazeni=mapa&diag=1')
  await page.getByTestId('mapa').waitFor()
  await page.waitForFunction(() => (window as unknown as { __map?: unknown }).__map != null, { timeout: 10000 })

  const settled = await page.evaluate(() => {
    const m = (window as unknown as { __map: { setZoom: (z: number, o?: unknown) => void; getZoom: () => number } }).__map
    m.setZoom(13.3, { animate: false })
    return m.getZoom()
  })
  // With zoomSnap:1 this would be 13 (snapped). zoomSnap:0 keeps 13.3.
  expect(settled).toBeCloseTo(13.3, 2)
  // clustering still renders at a fractional rest (buckets at Math.round(zoom))
  await expect(page.locator('.map-chip').first()).toBeVisible()
})

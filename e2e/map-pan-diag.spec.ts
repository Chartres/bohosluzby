import { test, expect } from '@playwright/test'
import { PRAGUE } from './fixtures'

test.use({ viewport: { width: 440, height: 900 }, geolocation: PRAGUE, permissions: ['geolocation'], locale: 'cs-CZ' })

// Regression: the map chips "danced" on pan. Two root causes were fixed earlier
// (pan-invariant clustering + a render-sequence guard) — those stabilised final
// POSITIONS. This test also pins the third, perceptual cause: every moveend used
// to clearLayers() and rebuild all ~45 markers, so each marker blinked out and
// repainted (read as dancing). The fix reuses marker DOM nodes across a pan.
// Asserts: (i) in-view chips don't change screen position, (ii) marker DOM nodes
// PERSIST across pans (not destroyed/recreated), (iii) clusters stay clusters.
test('rapid pans: chips hold position and marker DOM nodes persist', async ({ page }) => {
  test.skip(!!process.env.CI, 'diagnostic, local only (needs system Chrome + real data)')
  await page.goto('/')
  await page.getByRole('button', { name: 'mapa' }).click()
  await page.getByTestId('mapa').waitFor()
  await page.waitForTimeout(2500)

  // Stamp every current church/cluster marker so we can tell whether the SAME
  // DOM node survives a pan (incremental reuse) or gets wiped (clearLayers).
  const stamp = () => page.evaluate(() => {
    let n = 0
    document.querySelectorAll('.map-chip-wrap, .map-marker, .map-cluster').forEach((el) => {
      const icon = el.closest('.leaflet-marker-icon') as HTMLElement | null
      if (icon) { icon.dataset.probe = 'P' + n; n++ }
    })
    return n
  })
  const survivors = () => page.evaluate(() => document.querySelectorAll('.leaflet-marker-icon[data-probe]').length)
  const clusterCount = () => page.evaluate(() => document.querySelectorAll('.map-cluster').length)
  const chipPositions = () => page.evaluate(() => {
    const out: Record<string, string> = {}
    document.querySelectorAll('.map-chip-wrap[aria-label], .map-marker[aria-label]').forEach((el) => {
      const label = el.getAttribute('aria-label') || ''
      const icon = el.closest('.leaflet-marker-icon') as HTMLElement | null
      const m = (icon?.style.transform || '').match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/)
      if (m) out[label] = `${Math.round(+m[1])},${Math.round(+m[2])}`
    })
    return out
  })

  const stamped = await stamp()
  const beforePos = await chipPositions()
  const clustersBefore = await clusterCount()

  // Rapid overlapping pans in four directions, net-zero displacement (returns to
  // the start view). Small (80px) so nothing leaves the padded viewport — every
  // marker stays in view the whole time, so with reuse every DOM node must live.
  const drag = async (x1: number, y1: number, x2: number, y2: number, steps = 5) => {
    await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps }); await page.mouse.up()
  }
  await drag(240, 500, 160, 500) // left
  await drag(160, 500, 240, 500) // right (back)
  await drag(220, 480, 220, 560) // up
  await drag(220, 560, 220, 480) // down (back)
  await page.waitForTimeout(1500) // let the last async render settle

  const surv = await survivors()
  const afterPos = await chipPositions()
  const clustersAfter = await clusterCount()

  const common = Object.keys(beforePos).filter((k) => k in afterPos)
  const moved = common.filter((k) => beforePos[k] !== afterPos[k])
  console.log('DIAG stamped:', stamped, 'survivors:', surv, 'common:', common.length, 'moved:', moved.length,
    'clusters:', clustersBefore, '->', clustersAfter)

  // (i) churches that stayed in view did not shift on screen
  expect(moved).toEqual([])
  // (ii) marker DOM nodes were reused, not destroyed+recreated (pre-fix: 0)
  expect(surv).toBeGreaterThanOrEqual(Math.floor(stamped * 0.8))
  // (iii) clusters stayed clusters (count didn't collapse/flip)
  expect(clustersAfter).toBeGreaterThan(0)
  expect(Math.abs(clustersAfter - clustersBefore)).toBeLessThanOrEqual(1)
})

import { test, expect } from '@playwright/test'
import { PRAGUE } from './fixtures'
test.use({ viewport: { width: 440, height: 900 }, geolocation: PRAGUE, permissions: ['geolocation'], locale: 'cs-CZ' })

test('marker DOM nodes survive a pan (incremental, no flash)', async ({ page }) => {
  test.skip(!!process.env.CI, 'local diagnostic')
  await page.goto('/'); await page.getByRole('button', { name: 'mapa' }).click()
  await page.getByTestId('mapa').waitFor(); await page.waitForTimeout(2500)
  // tag every current marker element
  const tagged = await page.evaluate(() => {
    const els = document.querySelectorAll('.leaflet-marker-icon')
    els.forEach((e, i) => e.setAttribute('data-probe', 'P' + i))
    return els.length
  })
  // small pan
  await page.mouse.move(220, 500); await page.mouse.down(); await page.mouse.move(150, 460, { steps: 10 }); await page.mouse.up()
  await page.waitForTimeout(1800)
  // how many tagged nodes still exist? (survivors = reused; missing = destroyed+recreated)
  const survived = await page.evaluate(() => document.querySelectorAll('.leaflet-marker-icon[data-probe]').length)
  const total = await page.evaluate(() => document.querySelectorAll('.leaflet-marker-icon').length)
  console.log(`TAGGED before: ${tagged} | SURVIVED after pan: ${survived} | total now: ${total}`)
  console.log(survived >= tagged * 0.7 ? 'PASS: markers reused across pan (no flash)' : 'FAIL: markers destroyed+recreated (flash present)')
})

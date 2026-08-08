// App-preview walkthrough recorder (not a CI gate). Records a ~20s scripted
// tour at Sunday 07:00 over the real bundled data — same story as the phone
// App Preview, for the landing page / social + as a rehearsal storyboard.
// Run: PW_CHANNEL=chrome npx playwright test e2e/preview-video.spec.ts
// Then: the .webm lands in test-results/; convert with ffmpeg (see below).
import { test } from '@playwright/test'
import { PRAGUE, FIXED_NOW, mockData } from './fixtures'

test.use({
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 3,
  geolocation: PRAGUE,
  permissions: ['geolocation'],
  locale: 'cs-CZ',
  video: { mode: 'on', size: { width: 440, height: 956 } },
})

test('bohosluzby app preview walkthrough', async ({ page }) => {
  test.skip(!!process.env.CI, 'local preview generation only')
  await page.clock.install({ time: new Date('2026-07-12T05:00:00Z') })

  // 0-3s: opens straight to the nearest-mass list (real data, no loading/login)
  await page.goto('/')
  await page.waitForTimeout(3000)

  // 3-9s: MAP — a field of green time chips; a slow pan proves the times sit ON
  // the map (and no longer dance)
  await page.getByRole('button', { name: 'mapa' }).click()
  await page.getByTestId('mapa').waitFor()
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 4, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.mouse.move(220, 620)
  await page.mouse.down()
  for (let i = 0; i <= 20; i++) { await page.mouse.move(220 - i * 4, 620 - i * 3); await page.waitForTimeout(30) }
  await page.mouse.up()
  await page.waitForTimeout(2000)

  // 9-14s: tap a time chip → popover with church + next mass
  const chip = page.locator('.map-chip').first()
  await chip.click().catch(() => {})
  await page.waitForTimeout(2500)

  // 14-20s: back to the list, then a church's full schedule
  await page.getByRole('button', { name: 'seznam' }).click()
  await mockData(page)
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/')
  await page.getByText('kostel Panny Marie Sněžné').first().waitFor()
  await page.waitForTimeout(1500)
  await page.getByText('kostel Panny Marie Sněžné').click()
  await page.getByLabel('Pořad bohoslužeb').waitFor()
  await page.waitForTimeout(2500)
})

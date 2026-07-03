// Persona journey: a traveler plans around her day — "večer" for tonight,
// "v neděli kolem 9:00" for the weekend. The kdy filters read like rubric
// annotations, live in the URL, and a church falls back to its next matching
// service instead of vanishing.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
})

test('večer narrows to evening services; ?cas=vecer is bookmarkable', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  await page.getByRole('button', { name: 'večer' }).click()
  await expect(page).toHaveURL(/\?cas=vecer/)
  // tonight's evening line-up (Mon 6 Jul): liturgie 17:00, PMS 18:00, Havel 19:30
  await expect(page.getByText('kostel sv. Klimenta (řeckokatolická katedrála)')).toBeVisible()
  await expect(page.getByText('kostel Panny Marie Sněžné')).toBeVisible()
  // the cathedral has no evening service at all → drops out entirely
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).not.toBeVisible()
  await shot(page, 'kdy-vecer')

  // sticky across a plain revisit (localStorage re-applies the band)
  await page.goto('/')
  await expect(page).toHaveURL(/\?cas=vecer/)
})

test('kolem 09:00: fallback to the next matching service, composes with neděle', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  // kolem 09:00 (±90 min): the cathedral's 09:30 today stays; Panny Marie
  // Sněžné falls back from tonight's 18:00 to its Sunday 09:00
  await page.getByLabel('Kolem času').fill('09:00')
  await expect(page).toHaveURL(/\?cas=09:00/)
  await expect(page.getByText('09:30')).toBeVisible()
  await expect(page.getByText('kostel Panny Marie Sněžné')).toBeVisible()
  await expect(page.getByText('kostel sv. Klimenta (řeckokatolická katedrála)')).not.toBeVisible()
  await shot(page, 'kdy-kolem')

  // the planning question: v neděli kolem 9:00
  await page.getByRole('button', { name: 'neděle' }).click()
  await expect(page).toHaveURL(/cas=09:00/)
  await expect(page).toHaveURL(/den=nedele/)
  await expect(page.getByText('neděle 12. 7.')).toBeVisible()
  await expect(page.getByText('08:30')).toBeVisible() // katedrála
  await expect(page.getByText('11:30')).not.toBeVisible() // outside ±90 min
  await shot(page, 'kdy-kolem-nedele')
})

test('bookmark /?den=nedele&cas=9:00 restores both; 375px wraps typographically', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/?den=nedele&cas=9:00')
  await expect(page.getByText('neděle 12. 7.')).toBeVisible()
  await expect(page.getByText('08:30')).toBeVisible()
  await expect(page.getByText('kostel Nejsvětějšího Salvátora')).not.toBeVisible() // 12:00 Sunday
  await shot(page, 'kdy-mobile-375')
})

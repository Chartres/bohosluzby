// English UI e2e: device/browser locale en-US → lang() resolves to 'en'.
// Registry DATA (church names, service types) stays Czech; only UI chrome
// is translated. Playwright defaults every other spec to cs-CZ (see
// playwright.config.ts) — this spec opts back into en-US per-test.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ locale: 'en-US', geolocation: PRAGUE, permissions: ['geolocation'] })

test('English UI: translated day rubric, pill, and footer', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')

  // registry data (church name) stays Czech even under English UI
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  // day-group rubric for today's services
  await expect(page.getByText('today').first()).toBeVisible()

  // the day pill: translated group + value, same `${group}: ${label}` pattern
  await expect(page.getByRole('button', { name: /^day: now/ })).toBeVisible()

  // footer: "free, no ads" register
  await expect(page.locator('footer')).toContainText('free, no ads')

  await shot(page, 'english-list')
})

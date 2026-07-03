// Persona-visual e2e: on Monday morning Marie plans ahead — "kdy je v neděli
// mše?" — and flips the ordo to Sunday.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test('Sunday ordo: every service that day, chronological, no countdowns', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  await page.getByRole('button', { name: 'neděle' }).click()
  await expect(page.getByText('neděle 12. 7.')).toBeVisible()

  // chronological Sunday schedule across churches
  const times = await page.locator('ol li a > p:first-child').allTextContents()
  expect(times).toEqual(['08:30', '09:00', '09:00', '11:30', '12:00', '17:00', '20:00'])
  // planning view drops the countdown column
  await expect(page.getByText(/za \d+ (min|h)/)).toHaveCount(0)

  await shot(page, 'day-sunday', true)

  // "hned" restores the reachable-now ranking — no phantom rows from the ordo view
  await page.getByRole('button', { name: 'hned' }).click()
  await expect(page.getByText('za 29 min')).toBeVisible()
  await expect(page.locator('ol li a > p:first-child').first()).toHaveText('09:30')
  await shot(page, 'day-back-to-hned', true)
})

test('day picker at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await page.getByRole('button', { name: 'zítra' }).click()
  await expect(page.getByText('zítra').first()).toBeVisible()
  await shot(page, 'day-mobile-375')
})

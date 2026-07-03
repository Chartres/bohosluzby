// Persona-visual e2e: Marie wants the nearest mass she can still make.
// Every state of the one stage-1 journey is screenshotted into e2e/shots/
// (committed — the Standard says persona testing is visual; a human reviews
// these before stage 2).
import { test, expect, type Page } from '@playwright/test'
import { FIXED_NOW, PRAGUE, REMOTE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

async function fixTime(page: Page) {
  await page.clock.install({ time: FIXED_NOW })
}

test('loading state', async ({ page }) => {
  await fixTime(page)
  await mockData(page, { delayMs: 4000 })
  await page.goto('/')
  await expect(page.getByRole('status')).toContainText('Hledám bohoslužby poblíž')
  await shot(page, 'loading')
})

test('hero list: nearest services, soonest first', async ({ page }) => {
  await fixTime(page)
  await mockData(page)
  await page.goto('/')

  // Monday 09:00 → the 09:30 cathedral mass is the first row you can make
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  const firstRow = page.locator('ol li').first()
  await expect(firstRow).toContainText('09:30')
  await expect(firstRow).toContainText(/za (29|30) min/) // clock ticks in real time from the fixed start

  // day grouping rubric, language chip, greek-rite chip, barrier-free chip
  await expect(page.getByText('dnes').first()).toBeVisible()
  await expect(page.locator('ol').getByText('latinsky', { exact: true })).toBeVisible()
  await expect(page.getByText('řeckokatolická', { exact: true })).toBeVisible()
  await expect(page.getByText('bezbariérový přístup').first()).toBeVisible()

  // note parser: Havel's 10:30 "kromě července a srpna" must not run on 6 July…
  await expect(page.locator('ol').getByText('10:30')).toHaveCount(0)
  // …Ludmila's unverifiable "dle ohlášení" stays, set as a warning rubric
  await expect(page.locator('ol').getByText(/dle ohlášení/)).toHaveClass(/text-rubric/)

  // seasonal accent: 6 Jul 2026 is ordinary time → green
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--season').trim(),
  )
  expect(accent).toBe('#3d6b46') // green — getComputedStyle resolves the var chain

  await shot(page, 'list')
  await shot(page, 'hero-desktop', true)
})

test('hero at 375px (mobile)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await fixTime(page)
  await mockData(page)
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await shot(page, 'hero-mobile-375', true)
})

test.describe('without geolocation permission', () => {
  test.use({ permissions: [] })
  test('explains and offers the manual city fallback', async ({ page }) => {
    await fixTime(page)
    await mockData(page)
    await page.goto('/')
    await expect(page.getByText('Bez přístupu k poloze')).toBeVisible()
      await shot(page, 'no-permission')

    // picking a city recovers the journey
    await page.getByLabel('Zvolte obec').fill('Praha 1')
    await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
    await shot(page, 'city-fallback-list')
  })
})

test.describe('empty area', () => {
  test.use({ geolocation: REMOTE })
  test('reports nothing within 30 km and keeps the picker', async ({ page }) => {
    await fixTime(page)
    await mockData(page)
    await page.goto('/')
    await expect(page.getByText('V okolí nic nenacházím')).toBeVisible()
    await expect(page.getByLabel('Zvolte obec')).toBeVisible()
      await shot(page, 'empty-area')
  })
})

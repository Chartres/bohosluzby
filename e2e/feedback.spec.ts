// Persona-visual e2e: a parishioner reports a stale schedule via the footer
// feedback card; the Podpořit link is there but quiet.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test('feedback card: collapsed line → Sean Ellis + text → thanks', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  // collapsed by default; Podpořit sits in the same footer line
  await expect(page.getByRole('link', { name: 'Podpořit' })).toHaveAttribute(
    'href',
    'https://github.com/sponsors/Chartres',
  )
  await expect(page.getByRole('button', { name: 'Odeslat' })).not.toBeVisible()

  await page.getByRole('button', { name: /Napište nám/ }).click()
  await page.getByRole('button', { name: 'Hodně by mi chyběla' }).click()
  await page.getByLabel('Zpětná vazba').fill('rozpis u nás ve farnosti je starý')
  await shot(page, 'feedback-open', true)

  await page.getByRole('button', { name: 'Odeslat' }).click()
  await expect(page.getByText('Díky, zpětnou vazbu jsme dostali.')).toBeVisible()
  await shot(page, 'feedback-sent', true)
})

test('feedback at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await page.getByRole('button', { name: /Napište nám/ }).click()
  await page.getByRole('button', { name: /Napište nám/ }).waitFor({ state: 'hidden' })
  await page
    .locator('footer')
    .scrollIntoViewIfNeeded()
  await shot(page, 'feedback-mobile-375', true)
})

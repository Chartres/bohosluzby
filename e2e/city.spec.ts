// Persona-visual e2e: a searcher lands on /mesto/praha/ from Google ("mše
// praha dnes") — the city ordo renders without any location prompt.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, mockData, shot } from './fixtures'

test.use({ permissions: [] }) // no geolocation — the landing must not need it

test('city landing renders the Praha list from the centroid', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/mesto/praha/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await expect(page.getByText('Praha ·')).toBeVisible()
  await expect(page).toHaveTitle(/Bohoslužby Praha — mše svatá dnes/)
  await shot(page, 'city-praha', true)

  // a church detail still opens from the landing list
  await page.getByText('kostel sv. Havla').click()
  await expect(page).toHaveURL('/kostel/3/')
  await expect(page.getByLabel('Pořad bohoslužeb')).toBeVisible()
})

test('stale city slug falls back to the picker', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/mesto/atlantida/')
  await expect(page.getByLabel('Zvolte obec')).toBeVisible()
})

// Persona-visual e2e: a searcher lands on /mesto/praha/ from Google ("mše
// praha dnes") — the city ordo renders without any location prompt.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

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
  await expect(page.getByLabel('Kostel nebo obec')).toBeVisible()
})

test('unified search: a specific church by name, no geolocation, keyboard only', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')
  // no geolocation permission → search panel is the hero
  await expect(page.getByText('Bez přístupu k poloze')).toBeVisible()

  const input = page.getByLabel('Kostel nebo obec')
  await input.fill('vita') // diacritics-insensitive: matches sv. Víta
  await shot(page, 'search-church')
  await expect(page.getByRole('option', { name: /katedrála sv. Víta/ })).toBeVisible()
  await input.press('Enter')
  await expect(page).toHaveURL('/kostel/2/')
  await expect(page.getByLabel('Pořad bohoslužeb')).toBeVisible()
  // shareable/bookmarkable target: deep link carries the church name in the title
  await expect(page).toHaveTitle(/katedrála sv. Víta.*pořad bohoslužeb/)
})

test('změnit opens the search over the list; zpět returns with the origin intact', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 50.0875, longitude: 14.4213 })
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  await page.getByRole('button', { name: 'změnit' }).click()
  await expect(page.getByText('Jiná obec nebo kostel')).toBeVisible()
  await shot(page, 'search-open')
  await page.getByRole('button', { name: '‹ zpět na seznam' }).click()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
})

test('moje poloha: the way back from a picked city to geolocation', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(PRAGUE)
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')
  await expect(page.getByText('podle vaší polohy')).toBeVisible()
  // geolocation origin → no affordance needed
  await expect(page.getByRole('button', { name: 'moje poloha' })).toHaveCount(0)

  await page.getByRole('button', { name: 'změnit' }).click()
  await page.getByLabel('Kostel nebo obec').fill('praha')
  await page.getByRole('option', { name: /^Praha/ }).click()
  await expect(page.getByText('Praha ·')).toBeVisible()
  await shot(page, 'city-my-location')

  await page.getByRole('button', { name: 'moje poloha' }).click()
  await expect(page.getByText('podle vaší polohy')).toBeVisible()
  await expect(page.getByRole('button', { name: 'moje poloha' })).toHaveCount(0)
})

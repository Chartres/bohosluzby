// Persona-visual e2e: Oleh (Ukrainian, Greek-Catholic) narrows the list to his
// rite; the filters read like rubric annotations, persist across visits.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
})

test('greek-catholic filter narrows to the liturgy; persists across reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await shot(page, 'filters-default')

  await page.getByRole('button', { name: 'řeckokatolické' }).click()
  await expect(page.getByText('kostel sv. Klimenta (řeckokatolická katedrála)')).toBeVisible()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).not.toBeVisible()
  await shot(page, 'filters-greek')

  // persisted: reload keeps the rite filter active
  await page.reload()
  await expect(page.getByText('kostel sv. Klimenta (řeckokatolická katedrála)')).toBeVisible()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'řeckokatolické' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('language filter + over-narrow combination explains itself', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('kostel sv. Havla')).toBeVisible()

  await page.getByLabel('Jazyk bohoslužby').selectOption('latinsky')
  await expect(page.getByText('kostel sv. Havla')).toBeVisible()
  await expect(page.getByText('kostel sv. Ludmily')).not.toBeVisible()
  await shot(page, 'filters-lang')

  // latinsky + řeckokatolické matches nothing → honest empty state with a reset
  await page.getByRole('button', { name: 'řeckokatolické' }).click()
  await expect(page.getByText(/neodpovídá žádná bohoslužba/)).toBeVisible()
  await shot(page, 'filters-empty')
  await page.getByRole('button', { name: 'Zrušit filtry' }).click()
  await expect(page.getByText('kostel sv. Ludmily')).toBeVisible()
})

test('filters at 375px wrap as one typographic line', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await shot(page, 'filters-mobile-375')
})

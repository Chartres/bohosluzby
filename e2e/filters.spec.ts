// Persona-visual e2e: Oleh (Ukrainian, Greek-Catholic) narrows the list to his
// rite; the filters live behind the pill row (ordo sheet), persist across visits.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, openControls, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
})

test('greek-catholic filter narrows to the liturgy; persists across reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await shot(page, 'filters-default')

  await openControls(page)
  await page.getByRole('button', { name: 'řeckokatolické' }).click()
  await expect(page.getByText('kostel sv. Klimenta (řeckokatolická katedrála)')).toBeVisible()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).not.toBeVisible()
  await shot(page, 'filters-greek')

  // persisted: reload keeps the rite filter active — the pill row says so
  await page.reload()
  await expect(page.getByText('kostel sv. Klimenta (řeckokatolická katedrála)')).toBeVisible()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).not.toBeVisible()
  await expect(page.getByRole('button', { name: /^co: filtry \(1\)/ })).toBeVisible()
  await openControls(page)
  await expect(page.getByRole('button', { name: 'řeckokatolické' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('language filter + over-narrow combination explains itself', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('kostel sv. Havla')).toBeVisible()

  await openControls(page)
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

test('okruh: distance filter narrows the list to walking range', async ({ page, context }) => {
  // stand NE of the centre so 2 km splits the fixture: Havel/Salvátor stay
  // inside, the cathedral (~2.6 km) and Ludmily (~2.5 km) fall out
  await context.setGeolocation({ latitude: 50.098, longitude: 14.435 })
  await page.goto('/')
  await expect(page.getByText('kostel sv. Ludmily')).toBeVisible()

  await openControls(page)
  await page.getByRole('button', { name: '< 2 km' }).click()
  await expect(page.getByText('kostel sv. Ludmily')).not.toBeVisible()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).not.toBeVisible()
  await expect(page.getByText('kostel sv. Havla')).toBeVisible()
  await expect(page.getByRole('button', { name: /^okruh: < 2 km/ })).toBeVisible()
  await shot(page, 'filters-okruh')

  // vše resets the radius
  await page.getByRole('button', { name: 'vše', exact: true }).click()
  await expect(page.getByText('kostel sv. Ludmily')).toBeVisible()
})

test('375px: one pill row; the ordo sheet opens as a bottom sheet and closes with hotovo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  // closed by default: pills visible, controls hidden
  await expect(page.getByRole('button', { name: /^den: hned/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'večer' })).not.toBeVisible()
  await shot(page, 'filters-mobile-375')

  // open → grouped controls in a dialog; picks show on the pills
  await openControls(page)
  await expect(page.getByRole('dialog', { name: 'Den a filtry' })).toBeVisible()
  await page.getByRole('button', { name: 'večer' }).click()
  await page.getByRole('button', { name: 'bezbariérové' }).click()
  await shot(page, 'filters-mobile-375-open')
  await page.getByRole('button', { name: 'hotovo' }).click()
  await expect(page.getByRole('dialog', { name: 'Den a filtry' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /^kdy: večer/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^co: filtry \(1\)/ })).toBeVisible()
  await shot(page, 'filters-mobile-375-summary')
})

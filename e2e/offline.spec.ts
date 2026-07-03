// Persona-visual e2e: Marie's train enters a tunnel — the list stays, the
// footer quietly says offline; on a later visit with location denied, the
// last known position still yields a list.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test('going offline shows the quiet footer indicator, list stays', async ({ page, context }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await expect(page.getByText('offline — zobrazuji uložená data')).not.toBeVisible()

  await context.setOffline(true)
  await expect(page.getByText('offline — zobrazuji uložená data')).toBeVisible()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await shot(page, 'offline-indicator', true)

  await context.setOffline(false)
  await expect(page.getByText('offline — zobrazuji uložená data')).not.toBeVisible()
})

test.describe('last known position', () => {
  test.use({ permissions: [] })
  test('geolocation denied + saved position → list, not the picker', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bohosluzby:lastOrigin', JSON.stringify({ lat: 50.0875, lng: 14.4213 }))
    })
    await page.clock.install({ time: FIXED_NOW })
    await mockData(page)
    await page.goto('/')
    await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
    await expect(page.getByText('poslední známá poloha')).toBeVisible()
    await shot(page, 'offline-last-position')
  })
})

// Persona journey: a visitor toggles the hero list to "mapa" — muted OSM
// tiles, seasonal markers, a typographic popover with the next mass time.
// Tiles are stubbed to a paper-colored pixel so shots are deterministic.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

const PAPER_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4+/waAAVvAqtuqbGpAAAAAElFTkSuQmCC',
  'base64',
)

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PAPER_TILE }),
  )
})

test('seznam · mapa toggle: markers, popover with next mass, otevřít → detail', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  await page.getByRole('button', { name: 'mapa' }).click()
  await expect(page).toHaveURL(/zobrazeni=mapa/)
  await expect(page.getByTestId('mapa')).toBeVisible()
  // OSM attribution is non-negotiable
  await expect(page.getByText('OpenStreetMap')).toBeVisible()
  // markers in the seasonal accent; the tight centre pair clusters
  await expect(page.locator('.map-dot').first()).toBeVisible()
  await shot(page, 'map-view')

  // the cathedral sits alone west of the centre → a single dot with a popover
  await page.locator('.map-marker[title="katedrála sv. Víta, Václava a Vojtěcha"]').click()
  await expect(page.locator('.map-pop-name')).toHaveText('katedrála sv. Víta, Václava a Vojtěcha')
  await expect(page.locator('.map-pop-line')).toHaveText(/dnes v 09:30/)
  await shot(page, 'map-popover')

  await page.locator('.map-pop-open').click()
  await expect(page).toHaveURL(/\/kostel\/2\//)
  await expect(page.getByRole('heading', { name: 'katedrála sv. Víta, Václava a Vojtěcha' })).toBeVisible()

  // zpět returns to the map view (?zobrazeni survived the round trip)
  await page.getByRole('button', { name: '‹ zpět na seznam' }).click()
  await expect(page.getByTestId('mapa')).toBeVisible()
})

test('map respects filters: večer drops the cathedral (no evening service ever)', async ({ page }) => {
  await page.goto('/?zobrazeni=mapa')
  await expect(page.locator('.map-marker[title="katedrála sv. Víta, Václava a Vojtěcha"]')).toBeVisible()

  await page.getByRole('button', { name: 'večer' }).click()
  await expect(page.locator('.map-marker[title="katedrála sv. Víta, Václava a Vojtěcha"]')).toHaveCount(0)
  // the daily 17:00 liturgy remains on the map (dot or inside a cluster)
  await expect(page.locator('.map-dot, .map-cluster')).not.toHaveCount(0)

  // back to the list — the toggle is a round trip, filters intact
  await page.getByRole('button', { name: 'seznam' }).click()
  await expect(page).not.toHaveURL(/zobrazeni/)
  await expect(page.getByText('kostel sv. Klimenta (řeckokatolická katedrála)')).toBeVisible()
})

test('offline: the map excuses itself quietly, the list stays the offline path', async ({ page, context }) => {
  await page.goto('/?zobrazeni=mapa')
  await expect(page.getByTestId('mapa')).toBeVisible()

  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(page.getByText(/Mapa potřebuje připojení/)).toBeVisible()
  await shot(page, 'map-offline')

  await page.getByRole('button', { name: 'seznam' }).click()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
})

test('mapa at 375px: one-hand view, bookmarkable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/?zobrazeni=mapa')
  await expect(page.getByTestId('mapa')).toBeVisible()
  await expect(page.locator('.map-dot').first()).toBeVisible()
  await shot(page, 'map-mobile-375')
})

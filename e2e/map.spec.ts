// Persona journey: a visitor toggles the hero list to "mapa" — muted OSM
// tiles, Booking-style markers where the time IS the marker: season-accent
// time chips for churches matching the current context, tiny faded dots for
// the rest, and a typographic popover. Tiles are stubbed to a paper-colored
// pixel so shots are deterministic.
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

test('seznam · mapa toggle: time chips as markers, popover with next mass, otevřít → detail', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  await page.getByRole('button', { name: 'mapa' }).click()
  await expect(page).toHaveURL(/zobrazeni=mapa/)
  await expect(page.getByTestId('mapa')).toBeVisible()
  // OSM attribution is non-negotiable
  await expect(page.getByText('OpenStreetMap')).toBeVisible()
  // matching churches carry their next time as the marker; the centre pair clusters
  await expect(page.locator('.map-chip').first()).toBeVisible()
  await shot(page, 'map-view')

  // the cathedral sits alone west of the centre → its chip is today's 09:30 mass
  const cathedral = page.locator('.map-chip-wrap[title="katedrála sv. Víta, Václava a Vojtěcha"]')
  await expect(cathedral.locator('.map-chip')).toHaveText('9:30')
  await cathedral.click()
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

test('map matches the seznam: večer fades the cathedral to a dot, keeps the evening chips', async ({ page }) => {
  await page.goto('/?zobrazeni=mapa')
  await expect(
    page.locator('.map-chip-wrap[title="katedrála sv. Víta, Václava a Vojtěcha"]'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'večer' }).click()
  // no evening service ever → not in the seznam → a faded dot, not a chip (still tappable)
  const cathedral = page.locator('.map-marker[title="katedrála sv. Víta, Václava a Vojtěcha"]')
  await expect(cathedral.locator('.map-dot--faded')).toBeVisible()
  // the daily 17:00 liturgy and the 18:00 mass keep their accent chips
  await expect(page.locator('.map-chip').first()).toBeVisible()
  await shot(page, 'map-mixed')

  // a tapped faded dot is honest: leads with the miss, then the real next mass
  await cathedral.click()
  await expect(page.locator('.map-pop-miss')).toHaveText('pro váš výběr nic')
  await expect(page.locator('.map-pop-line')).toHaveText(/nejbližší: dnes v 09:30 · mše sv\./)
  await shot(page, 'map-popover-miss')
  await page.keyboard.press('Escape') // close the popover before leaving the map

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
  await expect(page.locator('.map-chip').first()).toBeVisible()
  await shot(page, 'map-mobile-375')
})

test('money shot at 375px: mixed chips and faded dots — matches vs everything else', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/?zobrazeni=mapa&cas=vecer')
  await expect(page.locator('.map-chip').first()).toBeVisible()
  await expect(page.locator('.map-dot--faded').first()).toBeVisible()
  await shot(page, 'map-mixed-375')
})

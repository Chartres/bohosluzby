// Persona-visual e2e: Marie opens a church from the list and reads its full
// printed-ordo schedule; a friend opens her shared /kostel/<id>/ link directly.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test('detail from the list: weekly ordo, extras, parish, freshness', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/')

  await page.getByText('kostel Panny Marie Sněžné').click()
  await expect(page).toHaveURL('/kostel/4/')

  // weekly schedule grouped by day, Sunday first
  const ordo = page.getByLabel('Pořad bohoslužeb')
  await expect(ordo.getByRole('heading', { level: 4 }).first()).toHaveText('neděle')
  await expect(ordo).toContainText('09:00')
  await expect(ordo).toContainText('11:30')
  await expect(ordo).toContainText('18:00')

  // one-off section + parish + freshness line
  await expect(page.getByLabel('Mimořádné bohoslužby')).toContainText('pobožnost')
  await expect(page.getByLabel('Mimořádné bohoslužby')).toContainText('6. 7. 2026')
  await expect(page.getByLabel('Farnost')).toContainText('farnost Panny Marie Sněžné')
  await expect(page.getByText(/údaje z rejstříku ČBK, naposledy ověřeno 1\. 6\. 2026/)).toBeVisible()

  // maps links
  await expect(page.getByRole('link', { name: 'mapa' })).toHaveAttribute('href', /mapy\.cz/)
  await expect(page.getByRole('link', { name: 'navigace' })).toHaveAttribute('href', /^geo:/)

  await shot(page, 'detail', true)

  // back to the list
  await page.getByRole('button', { name: '‹ zpět na seznam' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
})

test('detail at 375px (mobile)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/kostel/1/')
  await expect(page.getByRole('heading', { name: 'kostel Nejsvětějšího Salvátora' })).toBeVisible()
  await expect(page.getByLabel('Farnost')).toContainText('Akademická farnost Praha')
  await shot(page, 'detail-mobile-375', true)
})

test.describe('ICS + share', () => {
  test.use({ permissions: ['geolocation', 'clipboard-write', 'clipboard-read'] })
  test('"do kalendáře" downloads a weekly VEVENT; "sdílet" copies the URL', async ({ page }) => {
    // force the clipboard fallback even where headless Chromium has navigator.share
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    })
    await page.clock.install({ time: FIXED_NOW })
    await mockData(page)
    await page.goto('/kostel/4/')
    await expect(page.getByLabel('Pořad bohoslužeb')).toBeVisible()

    const downloadP = page.waitForEvent('download')
    await page.getByRole('button', { name: 'do kalendáře' }).first().click()
    const download = await downloadP
    expect(download.suggestedFilename()).toMatch(/^bohosluzby-4-.*\.ics$/)

    await page.getByRole('button', { name: 'sdílet' }).click()
    await expect(page.getByText('odkaz zkopírován')).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toBe('http://localhost:4173/kostel/4/')
    await shot(page, 'detail-share-copied')
  })
})

test('unknown id from a stale share link', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/kostel/999/')
  await expect(page.getByText('Kostel nenalezen')).toBeVisible()
  await shot(page, 'detail-not-found')
})

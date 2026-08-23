// Church photo (Wikimedia Commons): a church with a photos.json entry shows the
// image + attribution; one without shows no image. The url is remote and lazy —
// a tiny data-URI stands in so the test needs no network.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

// 1x1 transparent GIF — a real image the lazy <img> can decode offline.
const PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

test('a church with a photo shows the image + credit; one without shows none', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.route('**/data/photos.json', async (route) => {
    await route.fulfill({
      json: { '1': { url: PIXEL, credit: 'Jan Novák', license: 'CC BY-SA 4.0' } },
    })
  })

  await page.goto('/kostel/1/')
  const img = page.getByRole('img', { name: 'kostel Nejsvětějšího Salvátora' })
  await expect(img).toBeVisible()
  await expect(
    page.getByText('foto: Jan Novák · CC BY-SA 4.0 · Wikimedia Commons'),
  ).toBeVisible()

  // full-bleed hero: the app masthead is gone and the back + help chrome overlays
  // the photo (both live inside the <figure>, over the image)
  await expect(page.getByRole('banner')).toHaveCount(0)
  const figure = page.locator('figure')
  await expect(figure.getByRole('button', { name: '‹ zpět na seznam' })).toBeVisible()
  await expect(figure.getByRole('button', { name: 'nápověda' })).toBeVisible()
  // help re-opens the intro guide
  await figure.getByRole('button', { name: 'nápověda' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Přeskočit' }).click()
  await shot(page, 'detail-photo-hero', true)
  // back returns to the list
  await figure.getByRole('button', { name: '‹ zpět na seznam' }).click()
  await expect(page.getByRole('img', { name: 'kostel Nejsvětějšího Salvátora' })).toHaveCount(0)

  // church 3 has no photos.json entry → no image, and the normal masthead is back
  await page.goto('/kostel/3/')
  await expect(page.getByRole('heading', { name: 'kostel sv. Havla' })).toBeVisible()
  await expect(page.getByRole('img')).toHaveCount(0)
  await expect(page.getByRole('banner')).toBeVisible()
})

// Church photo (Wikimedia Commons): a church with a photos.json entry shows the
// image + attribution; one without shows no image. The url is remote and lazy —
// a tiny data-URI stands in so the test needs no network.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData } from './fixtures'

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
  await expect(page.getByRole('img', { name: 'kostel Nejsvětějšího Salvátora' })).toBeVisible()
  await expect(
    page.getByText('foto: Jan Novák · CC BY-SA 4.0 · Wikimedia Commons'),
  ).toBeVisible()

  // church 3 has no photos.json entry → no image renders
  await page.goto('/kostel/3/')
  await expect(page.getByRole('heading', { name: 'kostel sv. Havla' })).toBeVisible()
  await expect(page.getByRole('img')).toHaveCount(0)
})

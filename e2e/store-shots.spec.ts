// App Store screenshot generator (not a CI gate — skipped under CI). Renders the
// finder at Apple's exact pixel sizes using the deterministic Prague fixture:
//   iPhone 6.9"  440×956  @3  → 1320×2868
//   iPad 13"    1032×1376 @2  → 2064×2752
// Run locally: npx playwright test e2e/store-shots.spec.ts
// Output: store-assets/ios/<device>/*.png (committed as submission assets) AND
// synced into ios/App/fastlane/screenshots/cs/ (deliver's locale dir, the
// upload source). Both MUST stay in lockstep — a v1.1 upload once shipped stale
// shots because only store-assets was regenerated (verify_listing caught it).
import { test } from '@playwright/test'
import { cpSync, mkdirSync, readdirSync } from 'node:fs'
import { FIXED_NOW, PRAGUE, mockData } from './fixtures'

const FASTLANE_CS = 'ios/App/fastlane/screenshots/cs'

const DEVICES = [
  { name: 'iphone-6.9', viewport: { width: 440, height: 956 }, dsf: 3 },
  { name: 'ipad-13', viewport: { width: 1032, height: 1376 }, dsf: 2 },
]

for (const d of DEVICES) {
  test.describe(d.name, () => {
    test.use({
      viewport: d.viewport,
      deviceScaleFactor: d.dsf,
      geolocation: PRAGUE,
      permissions: ['geolocation'],
      locale: 'cs-CZ',
    })

    test('store screens', async ({ page }) => {
      test.skip(!!process.env.CI, 'store screenshots are generated locally, not in CI')
      const dir = `store-assets/ios/${d.name}`
      await page.clock.install({ time: FIXED_NOW })
      await mockData(page)

      // 1 — MAP with next-mass time chips (the centerpiece — leads the listing)
      await page.goto('/')
      await page.getByRole('button', { name: 'mapa' }).click()
      await page.getByTestId('mapa').waitFor()
      await page.waitForTimeout(1200) // let tiles/chips settle before the hero shot
      await page.screenshot({ path: `${dir}/1-map.png` })

      // 2 — nearest masses list (the core value)
      await page.goto('/')
      await page.getByText('kostel Panny Marie Sněžné').first().waitFor()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await page.screenshot({ path: `${dir}/2-home.png` })

      // 3 — a church's full ordo + add-to-calendar
      await page.getByText('kostel Panny Marie Sněžné').click()
      await page.getByLabel('Pořad bohoslužeb').waitFor()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await page.screenshot({ path: `${dir}/3-detail.png` })

      // Sync into deliver's upload dir (fastlane/screenshots/cs/) with the
      // device-prefixed names deliver expects — so store-assets and the upload
      // source never diverge again.
      mkdirSync(FASTLANE_CS, { recursive: true })
      for (const f of readdirSync(dir)) {
        cpSync(`${dir}/${f}`, `${FASTLANE_CS}/${d.name}-${f}`)
      }
    })
  })
}

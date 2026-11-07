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
import { cpSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { FIXED_NOW, PRAGUE, mockData } from './fixtures'

const FASTLANE_CS = 'ios/App/fastlane/screenshots/cs'


// Google Play accepts phone screenshots only between 16:9 and 9:16, so the
// iPhone 6.9" shots (2.17:1) can't be reused — the Android entry renders the
// classic 1080×1920 (360×640 @3) into fastlane supply's layout,
// store-assets/android/metadata/cs-CZ/images/phoneScreenshots/ (scripts/play-listing.mjs).
const DEVICES = [
  { name: 'iphone-6.9', store: 'ios', viewport: { width: 440, height: 956 }, dsf: 3 },
  { name: 'ipad-13', store: 'ios', viewport: { width: 1032, height: 1376 }, dsf: 2 },
  { name: 'phone', store: 'android', viewport: { width: 360, height: 640 }, dsf: 3 },
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
      test.setTimeout(120_000) // real map tiles + a Wikimedia photo
      // the first-run intro guide must not overlay the store shots (step 1 uses
      // real bundled data, so mockData's seed hasn't run yet)
      await page.addInitScript(() => {
        localStorage.setItem('bohosluzby:introSeen', '1')
        localStorage.setItem('fw:whats-new', '9999') // no what's-new sheet over the store shots
      })
      // Sandboxes whose browser can't reach tile.openstreetmap.org (but curl can):
      // PW_TILES_VIA_CURL=1 serves the map tiles through curl. Local-only escape hatch.
      if (process.env.PW_TILES_VIA_CURL)
        await page.route('https://tile.openstreetmap.org/**', async (route) => {
          const body = execFileSync('curl', ['-sf', '-A', 'bohosluzby.dravec.org store screenshots', route.request().url()])
          await route.fulfill({ status: 200, contentType: 'image/png', body })
        })
      const dir = d.store === 'android' ? 'store-assets/android/metadata/cs-CZ/images/phoneScreenshots' : `store-assets/${d.store}/${d.name}`
      // 1 — MAP hero (the centerpiece — leads the listing). REAL bundled data
      // (no mock) at a plain-green Sunday 07:00 local (05:00 UTC): the whole
      // day's masses are still ahead, so nearly every church shows a vibrant
      // green "HH:MM" chip — the dense look of the real product, exactly what a
      // Sunday-morning user sees. 2026-07-12 has no feast → --season stays green.
      await page.clock.install({ time: new Date('2026-07-12T05:00:00Z') })
      await page.goto('/')
      await page.getByRole('button', { name: 'mapa' }).click()
      await page.getByTestId('mapa').waitFor()
      await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 4, { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(600)
      await page.locator('.leaflet-control-zoom-in').click()
      await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 4, { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(1200) // let chips settle before the hero shot
      await page.screenshot({ path: `${dir}/1-map.png` })

      // 2 — nearest masses list (the core value) — the shared deterministic
      // fixture at FIXED_NOW (map already captured, so tile-fade timing moot)
      await page.clock.setFixedTime(FIXED_NOW)
      await mockData(page)
      // the detail shot shows a church photo (Pavol, 7 Nov): fixture church 2 is St Vitus,
      // so it gets St Vitus's own entry from the real photos.json (registry id 10001)
      const photos = JSON.parse(readFileSync('public/data/photos.json', 'utf8'))
      await page.route('**/data/photos.json', (route) => route.fulfill({ json: { '2': photos['10001'] } }))
      await page.goto('/?zobrazeni=seznam')
      await page.getByText('kostel Panny Marie Sněžné').first().waitFor()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await page.screenshot({ path: `${dir}/2-home.png` })

      // 3 — a church with its photo, full ordo + the time's actions
      await page.getByText('katedrála sv. Víta, Václava a Vojtěcha').first().click()
      await page.getByLabel('Pořad bohoslužeb').waitFor()
      await page.waitForFunction(() => [...document.images].some((i) => i.src.includes('wikimedia') && i.complete && i.naturalWidth > 0), { timeout: 15000 })
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await page.screenshot({ path: `${dir}/3-detail.png` })

      // Sync into deliver's upload dir (fastlane/screenshots/cs/) with the
      // device-prefixed names deliver expects — so store-assets and the upload
      // source never diverge again. (Android's upload source IS store-assets —
      // the release workflow reads it directly.)
      if (d.store === 'ios') {
        mkdirSync(FASTLANE_CS, { recursive: true })
        for (const f of readdirSync(dir)) {
          cpSync(`${dir}/${f}`, `${FASTLANE_CS}/${d.name}-${f}`)
        }
      }
    })
  })
}

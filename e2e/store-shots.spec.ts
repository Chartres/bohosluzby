// App Store screenshot generator (not a CI gate — skipped under CI). Renders the
// finder at Apple's exact pixel sizes using the deterministic Prague fixture:
//   iPhone 6.9"  440×956  @3  → 1320×2868
//   iPad 13"    1032×1376 @2  → 2064×2752
// Run locally: npx playwright test e2e/store-shots.spec.ts
// Output: store-assets/ios/<device>/*.png (committed as submission assets) AND
// synced into ios/App/fastlane/screenshots/cs/ (deliver's locale dir, the
// upload source). Both MUST stay in lockstep — a v1.1 upload once shipped stale
// shots because only store-assets was regenerated (verify_listing caught it).
import type { Page } from '@playwright/test'
import { test } from '@playwright/test'
import { cpSync, mkdirSync, readdirSync } from 'node:fs'
import { FIXED_NOW, PRAGUE, mockData } from './fixtures'

const FASTLANE_CS = 'ios/App/fastlane/screenshots/cs'

// A denser central-Prague dataset used ONLY for the map hero screenshot, so it
// looks like the real product (many next-mass chips) instead of the sparse
// shared test fixture. FIXED_NOW is Sunday 09:00 CEST, so every church carries
// a Sunday ('7') mass later the same day → all render as green time chips.
// Real church coords, spread across Staré Město + Malá Strana so they decluster.
const HERO: Array<[string, string, number, number, string]> = [
  ['h1', 'Matky Boží před Týnem', 50.0876, 14.4224, '09:30'],
  ['h2', 'Nejsvětějšího Salvátora', 50.0863, 14.4165, '14:00'],
  ['h3', 'sv. Havla', 50.0855, 14.4229, '10:00'],
  ['h4', 'Panny Marie Sněžné', 50.0827, 14.4227, '10:15'],
  ['h5', 'sv. Jiljí', 50.0854, 14.4185, '10:30'],
  ['h6', 'sv. Martina ve zdi', 50.0836, 14.4186, '11:00'],
  ['h7', 'sv. Mikuláše (Malá Strana)', 50.0879, 14.4036, '10:00'],
  ['h8', 'sv. Tomáše', 50.0902, 14.4039, '11:30'],
  ['h9', 'Panny Marie Vítězné (Jezulátko)', 50.0872, 14.4038, '19:00'],
  ['h10', 'sv. Josefa', 50.0886, 14.4058, '17:00'],
  ['h11', 'katedrála sv. Víta', 50.0902, 14.4003, '10:00'],
  ['h12', 'sv. Jindřicha', 50.0837, 14.4276, '18:00'],
  ['h13', 'Nanebevzetí P. Marie (Strahov)', 50.0855, 14.3893, '09:00'],
  ['h14', 'sv. Ignáce', 50.0782, 14.4213, '11:00'],
]

async function mockHeroMap(page: Page) {
  const index = HERO.map(([id, name, lat, lng]) => [id, name, 'Praha 1', lat, lng, 0, '50-14'])
  const shard = Object.fromEntries(
    HERO.map(([id, , , , time]) => [id, { u: '2026-06-14', p: '', pa: '', c: [], s: [['7', time, 'česky', 0, 'mše sv.', '']] }]),
  )
  await page.route('**/data/churches.json', (r) => r.fulfill({ json: index }))
  await page.route('**/data/services/**', (r) => r.fulfill({ json: shard }))
}

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
      // A plain-green ordinary Sunday 09:00 CEST: the dense hero's '7' masses
      // are TODAY → vibrant green "HH:MM" chips, and the shared fixture (shots
      // 2-3) shows its Sunday masses too. (Install once — juggling the clock
      // mid-test starved Leaflet's tile fade and blanked the map.) 2026-07-12
      // has no feast, so --season stays green, not a gold solemnity.
      await page.clock.install({ time: new Date('2026-07-12T07:00:00Z') })

      // 1 — MAP with next-mass time chips (the centerpiece — leads the listing).
      // Dense hero mock + one zoom-in step: the central-Prague churches spread
      // into a field of individual green time chips (the real product's look),
      // not the sparse shared fixture's two-or-three.
      await mockHeroMap(page)
      await page.goto('/')
      await page.getByRole('button', { name: 'mapa' }).click()
      await page.getByTestId('mapa').waitFor()
      await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 4, { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(500)
      await page.locator('.leaflet-control-zoom-in').click()
      await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 4, { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(900) // let chips settle before the hero shot
      await page.screenshot({ path: `${dir}/1-map.png` })

      // 2 — nearest masses list (the core value) — the shared fixture
      await mockData(page)
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

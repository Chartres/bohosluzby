// What's new sheet (flywheel docs/standards/whats-new.md, src/whatsNew.ts): once per version,
// for returning readers only, one tap closes it. Shot of the open sheet at 390 px.
import { test, expect, type Page } from '@playwright/test'
import { FIXED_NOW, INDEX, PRAGUE, SHARD_50_14 } from './fixtures'
import { readFileSync } from 'node:fs'

const release = JSON.parse(readFileSync('whats-new.json', 'utf8')) as { version: string; items: { text: string; media: string }[] }

test.use({ geolocation: PRAGUE, permissions: ['geolocation'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

/** data mocks without mockData's storage seeding: these tests set the storage themselves */
async function setup(page: Page, seed: Record<string, string>) {
  await page.clock.install({ time: FIXED_NOW })
  await page.route('**/data/churches.json', (route) => route.fulfill({ json: INDEX }))
  await page.route('**/data/services/*.json', (route) =>
    /50-14\.json/.test(route.request().url()) ? route.fulfill({ json: SHARD_50_14 }) : route.fulfill({ status: 404, body: 'not found' }),
  )
  // seed once per tab, so a reload sees what the app itself stored
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v)
  }, seed)
}

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Co je nového' })

test('an older version seen: the sheet shows once, one tap closes it, a reload shows nothing', async ({ page }) => {
  await setup(page, { 'bohosluzby:introSeen': '1', 'fw:whats-new': '1.4.0' })
  await page.goto('/?zobrazeni=seznam')
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()

  await expect(sheet(page)).toBeVisible()
  for (const item of release.items) await expect(sheet(page).getByText(item.text)).toBeVisible()
  await expect(sheet(page).locator('iframe')).toHaveCount(release.items.length)
  await expect(sheet(page).locator('iframe').first()).toHaveAttribute('src', release.items[0].media)
  // the animation loads inside its sandboxed frame
  await expect(page.frameLocator('.fw-wn iframe').first().getByText('připomenout')).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.screenshot({ path: 'e2e/shots/whats-new-390.png' })

  await sheet(page).getByRole('button', { name: 'Rozumím' }).click()
  await expect(sheet(page)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('fw:whats-new'))).toBe(release.version)

  await page.reload()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).toBeVisible()
  await page.waitForTimeout(500)
  await expect(sheet(page)).toHaveCount(0)
})

test('a fresh visitor sees no sheet (the intro guide is theirs)', async ({ page }) => {
  await setup(page, {})
  await page.goto('/?zobrazeni=seznam')
  await expect(page.getByRole('dialog').first()).toBeVisible() // the first-run intro
  await page.waitForTimeout(500)
  await expect(sheet(page)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('fw:whats-new'))).toBe(release.version)
})

test('a returning visitor from before the sheet existed sees it', async ({ page }) => {
  await setup(page, { 'bohosluzby:introSeen': '1' })
  await page.goto('/?zobrazeni=seznam')
  await expect(sheet(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0)
})

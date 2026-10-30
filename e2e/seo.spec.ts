import { test, expect } from '@playwright/test'

// Discoverability kit (Flywheel Standard §5c, docs/standards/discoverability.md):
// what search crawlers, link unfurlers and AI agents read. Every file is asserted
// by content-type too — an SPA fallback answers 200 text/html for anything missing.

test('landing page has honest title, description and canonical', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Kam na mši/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://bohosluzby.dravec.org/',
  )
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /bohoslužby/)
})

test('sitemap.xml and robots.txt are served', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBe(true)
  expect(sitemap.headers()['content-type']).toMatch(/xml/)
  const xml = await sitemap.text()
  expect(xml).toContain('<loc>https://bohosluzby.dravec.org/</loc>')
  expect(xml).toContain('https://bohosluzby.dravec.org/mesto/')

  const robots = await request.get('/robots.txt')
  expect(robots.ok()).toBe(true)
  expect(robots.headers()['content-type']).toMatch(/^text\/plain/)
  const txt = await robots.text()
  expect(txt).toMatch(/^User-agent: \*\nAllow: \/$/m) // everyone welcome
  expect(txt).toContain('User-agent: ClaudeBot') // AI agents named, not left to silence
  expect(txt).not.toMatch(/^Disallow: \/\s*$/m)
  expect(txt).toContain('Sitemap: https://bohosluzby.dravec.org/sitemap.xml')
})

test('llms.txt, security.txt and the 1200×630 share card are served', async ({ request }) => {
  const llms = await request.get('/llms.txt')
  expect(llms.ok()).toBe(true)
  expect(llms.headers()['content-type']).toMatch(/^text\/plain/)
  const body = await llms.text()
  expect(body.startsWith('# Kam na mši')).toBe(true)
  expect(body).toContain('https://bohosluzby.dravec.org/sitemap.xml')

  const sec = await request.get('/.well-known/security.txt')
  expect(sec.ok()).toBe(true)
  expect(await sec.text()).toMatch(/^Contact: https:\/\//m)

  const og = await request.get('/og.png')
  expect(og.ok()).toBe(true)
  expect(og.headers()['content-type']).toBe('image/png')
  const png = await og.body()
  // IHDR width/height live at bytes 16..24 of a PNG
  expect(png.readUInt32BE(16)).toBe(1200)
  expect(png.readUInt32BE(20)).toBe(630)
})

test('head carries the share-card block and WebApplication JSON-LD', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://bohosluzby.dravec.org/og.png',
  )
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200')
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    'content',
    'https://bohosluzby.dravec.org/og.png',
  )
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}')
  expect(ld['@type']).toBe('WebApplication')
  expect(ld.url).toBe('https://bohosluzby.dravec.org/')
  expect(ld.isAccessibleForFree).toBe(true)
})

test('a church link is a real page: its own title, canonical, ordo and Church JSON-LD', async ({ request }) => {
  // GitHub Pages answered /kostel/<id>/ with 404.html + status 404 before the
  // church pages were prerendered — every shared and .ics link was a 404 to
  // crawlers and link unfurlers. (vite preview's SPA fallback would answer 200
  // for anything, so assert the CONTENT is the church's, not just the status.)
  const res = await request.get('/kostel/10001/')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toMatch(/<title>katedrála sv\. Víta[^<]*— pořad bohoslužeb \| Kam na mši<\/title>/)
  expect(html).toContain('<link rel="canonical" href="https://bohosluzby.dravec.org/kostel/10001/" />')
  expect(html).toContain('<h2>Pořad bohoslužeb</h2>')
  expect(html).toContain('"@type":"Church"')

  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('<loc>https://bohosluzby.dravec.org/kostel/10001/</loc>')
})

test('the app boots on a prerendered church page and shows that church', async ({ page }) => {
  await page.goto('/kostel/10001/')
  await expect(page.getByRole('heading', { name: /katedrála sv\. Víta/ }).first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Pořad bohoslužeb' })).toBeVisible()
})

// P8 Hana (docs/PERSONAS.md): searches "dušičková mše Brno" on her phone, lands on
// the static feast list, reads a time, opens that church — no JavaScript needed
// to read it (crawlers and AI agents read the same HTML).
test('P8: the Dušičky city page is a readable list that leads to the church', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/dusicky/brno/')
  await expect(page).toHaveTitle(/Dušičky a Všech svatých \d{4} — mše svatá Brno/)
  await expect(page.locator('h2#den-1')).toContainText('1. listopadu')
  await expect(page.locator('h2#den-2')).toContainText('2. listopadu')
  const first = page.locator('ul.ordo li').first()
  await expect(first.locator('.t')).toHaveText(/^\d{1,2}:\d{2}/)
  await page.screenshot({ path: 'e2e/shots/p8-dusicky-brno.png', fullPage: false })
  const href = await first.locator('a').getAttribute('href')
  expect(href).toMatch(/^https:\/\/bohosluzby\.dravec\.org\/kostel\/\d+\/$/)
  await page.goto(href!.replace('https://bohosluzby.dravec.org', ''))
  await expect(page.locator('h1').first()).toBeVisible()
  await ctx.close()

  const hubCtx = await browser.newContext()
  const hub = await hubCtx.newPage()
  await hub.goto('/dusicky/')
  await expect(hub.locator('#dieceze a[href$="/dusicky/praha/"]')).toBeVisible()
  await hubCtx.close()
})

// P8 step 0 (docs/PERSONAS.md): Hana lands on the hub, not on her town. She finds
// Kroměříž on the map, by typing it, or by her position, on a phone.
test('P8 Hana: /dusicky/ hub — map, Najdi obec, Podle mé polohy at 390 px', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ['geolocation'],
    geolocation: { latitude: 49.2977, longitude: 17.3931 }, // Kroměříž
  })
  const page = await ctx.newPage()
  await page.goto('/dusicky/')
  const map = page.locator('.map svg')
  await expect(map).toBeVisible()
  // the map fits the phone: no sideways scroll, every town a dot
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const towns = await page.locator('#dieceze li').count()
  expect(towns).toBeGreaterThan(100)
  await expect(page.locator('.map a[data-s]')).toHaveCount(towns)
  await page.screenshot({ path: 'e2e/shots/p8-dusicky-hub-390.png' })
  await page.screenshot({ path: 'e2e/shots/p8-dusicky-hub-390-full.png', fullPage: true })

  // a dot is a link to that town's page
  const dot = page.locator('.map a[data-s="kromeriz"]')
  await expect(dot).toHaveAttribute('href', 'https://bohosluzby.dravec.org/dusicky/kromeriz/')

  // grouped by diocese; typing filters as she goes, without diacritics
  await expect(page.locator('#dieceze h3').first()).toHaveText('Arcidiecéze pražská')
  const input = page.getByLabel('Najdi obec')
  await input.fill('kromer')
  await expect(page.locator('#dieceze li:visible')).toHaveCount(1)
  await expect(page.locator('#dieceze li:visible a')).toHaveText('Kroměříž')
  await expect(page.locator('#dieceze section:visible h3')).toHaveText('Arcidiecéze olomoucká')
  await page.screenshot({ path: 'e2e/shots/p8-dusicky-hub-390-search.png' })
  await input.fill('')

  // by position: asked only on the tap, nearest first, with the distance
  await page.getByRole('button', { name: 'Podle mé polohy' }).click()
  await expect(page.locator('#blizko li').first().locator('a')).toHaveText('Kroměříž')
  await expect(page.locator('#blizko li').first().locator('.km')).toHaveText(/^\d+(,\d)?\u00a0km$/)
  await expect(page.locator('#dieceze')).toBeHidden()
  await page.screenshot({ path: 'e2e/shots/p8-dusicky-hub-390-near.png' })
  await page.getByRole('button', { name: 'Podle diecézí' }).click()
  await expect(page.locator('#dieceze')).toBeVisible()
  await ctx.close()

  // desktop: the same page, the map at the column width
  const wide = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const desk = await wide.newPage()
  await desk.goto('/dusicky/')
  await expect(desk.locator('.map svg')).toBeVisible()
  await desk.screenshot({ path: 'e2e/shots/p8-dusicky-hub-1280.png' })
  await wide.close()

  // without JavaScript the grouped list stands alone; the finder stays hidden
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  const plain = await nojs.newPage()
  await plain.goto('/dusicky/')
  await expect(plain.locator('#finder')).toBeHidden()
  await expect(plain.locator('#dieceze a[href$="/dusicky/kromeriz/"]')).toBeVisible()
  await nojs.close()
})

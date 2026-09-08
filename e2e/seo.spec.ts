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

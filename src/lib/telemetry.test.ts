// Telemetry hygiene: what page_view says about where a visit came from, and
// which clients must not count as visitors at all. Both gaps blocked the first
// /flywheel:evolve run (docs/EVOLVE.md): no referrer/route on page_view, and a
// 30-visitor 1–3 AM burst that looked like a crawler.
import { isLikelyBot, pageViewContext } from './telemetry'

describe('isLikelyBot', () => {
  const chrome =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

  it('lets real browsers through', () => {
    expect(isLikelyBot({ userAgent: chrome })).toBe(false)
    expect(
      isLikelyBot({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      }),
    ).toBe(false)
  })

  it('does not mistake a CUBOT phone for a bot', () => {
    expect(
      isLikelyBot({
        userAgent: 'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      }),
    ).toBe(false)
  })

  it('flags crawlers, headless browsers and automation', () => {
    for (const ua of [
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/129.0 Safari/537.36',
      'Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 Chrome-Lighthouse',
      'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    ]) {
      expect(isLikelyBot({ userAgent: ua }), ua).toBe(true)
    }
    expect(isLikelyBot({ userAgent: chrome, webdriver: true })).toBe(true)
  })
})

describe('pageViewContext', () => {
  const base = {
    pathname: '/',
    search: '',
    referrer: '',
    host: 'bohosluzby.dravec.org',
    lang: 'cs',
    platform: 'web',
    standalone: false,
  }

  it('names the landing route kind (and the city slug for city pages)', () => {
    expect(pageViewContext(base)).toMatchObject({ route: 'home' })
    expect(pageViewContext({ ...base, pathname: '/mesto/brno/' })).toMatchObject({ route: 'city', city: 'brno' })
    expect(pageViewContext({ ...base, pathname: '/kostel/10001/' })).toMatchObject({ route: 'church' })
    expect(pageViewContext({ ...base, pathname: '/nesmysl' })).toMatchObject({ route: 'other' })
  })

  it('keeps only the referrer host, and drops self-referrals', () => {
    expect(pageViewContext({ ...base, referrer: 'https://www.google.com/search?q=mse+praha' })).toMatchObject({
      ref: 'google.com',
    })
    expect(pageViewContext({ ...base, referrer: 'https://bohosluzby.dravec.org/mesto/praha/' }).ref).toBeNull()
    expect(pageViewContext({ ...base, referrer: '' }).ref).toBeNull()
    expect(pageViewContext({ ...base, referrer: 'not a url' }).ref).toBeNull()
  })

  it('carries utm tags (truncated) and leaves other query params out', () => {
    const ctx = pageViewContext({
      ...base,
      search: `?utm_source=farnost-web&utm_medium=embed&utm_campaign=${'x'.repeat(100)}&den=7`,
    })
    expect(ctx).toMatchObject({ utm_source: 'farnost-web', utm_medium: 'embed' })
    expect(String(ctx.utm_campaign)).toHaveLength(64)
    expect(ctx).not.toHaveProperty('den')
  })

  it('records UI language, platform and installed-PWA mode', () => {
    expect(pageViewContext({ ...base, lang: 'en', platform: 'ios', standalone: true })).toMatchObject({
      lang: 'en',
      platform: 'ios',
      standalone: true,
    })
  })
})

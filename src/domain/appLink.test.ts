// The poster's one QR (store-assets/poster/): https://bohosluzby.dravec.org/app/ sends each phone
// to the right place. Pavol, 24 Nov 2026: one code for the website and the iPhone app.
import VITE_CONFIG from '../../vite.config.ts?raw'
import { APP_LINK_URL, APP_STORE_URL, appLinkPage, appLinkTarget, PLAY_STORE_URL, WEB_URL } from './appLink'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

describe('appLinkTarget', () => {
  it('iPhone and iPad go to the App Store, with the poster as the campaign', () => {
    expect(appLinkTarget(IPHONE)).toBe(APP_STORE_URL)
    expect(APP_STORE_URL).toBe('https://apps.apple.com/cz/app/id6792305024?ct=plakat')
    // iPadOS asks for the desktop site and says "Macintosh"; touch gives it away
    expect(appLinkTarget(IPAD_DESKTOP_UA, 5)).toBe(APP_STORE_URL)
    expect(appLinkTarget(IPAD_DESKTOP_UA, 0)).toBe(WEB_URL)
  })
  it('Android goes to the web app until the Play listing exists', () => {
    expect(PLAY_STORE_URL).toBe('')
    expect(appLinkTarget(ANDROID)).toBe(WEB_URL)
    expect(appLinkTarget(ANDROID, 5, 'https://play.google.com/store/apps/details?id=org.dravec.bohosluzby')).toBe(
      'https://play.google.com/store/apps/details?id=org.dravec.bohosluzby',
    )
  })
  it('everything else opens the web app, marked as from the poster (utm_source, read by telemetry)', () => {
    expect(appLinkTarget(DESKTOP)).toBe(WEB_URL)
    expect(appLinkTarget('')).toBe(WEB_URL)
    expect(WEB_URL).toBe('https://bohosluzby.dravec.org/?utm_source=plakat')
  })
})

describe('appLinkPage', () => {
  const page = appLinkPage()
  it('lives at /app/ and links both places without script', () => {
    expect(page.url).toBe(APP_LINK_URL)
    expect(APP_LINK_URL).toBe('https://bohosluzby.dravec.org/app/')
    expect(page.body).toContain(`href="${APP_STORE_URL}"`)
    expect(page.body).toContain(`href="${WEB_URL.replaceAll('&', '&amp;')}"`)
  })
  it('the inline redirect makes the same choice as appLinkTarget', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(page.body)![1]
    const run = (ua: string, touch = 0) => {
      let to = ''
      new Function('navigator', 'location', script)({ userAgent: ua, maxTouchPoints: touch }, { replace: (u: string) => (to = u) })
      return to
    }
    for (const [ua, touch] of [[IPHONE, 5], [IPAD_DESKTOP_UA, 5], [IPAD_DESKTOP_UA, 0], [ANDROID, 5], [DESKTOP, 0]] as const) {
      expect(run(ua, touch)).toBe(appLinkTarget(ua, touch))
    }
  })
  it('is kept out of search results: a doorway, not a page', () => {
    expect(page.noindex).toBe(true)
  })
})

describe('the service worker leaves /app/ to the network', () => {
  it('a returning web visitor scanning the poster on an iPhone still reaches the App Store, not the cached app shell', () => {
    expect(VITE_CONFIG).toMatch(/navigateFallbackDenylist:\s*\[[^\]]*\/\^\\\/app\\\//)
  })
})

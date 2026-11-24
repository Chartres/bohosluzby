// The poster's one QR code (store-assets/poster/, scripts/poster.mjs): /app/ sends each phone to
// the right place. Pavol, 24 Nov 2026: one code for the website and the iPhone app, on church
// notice boards. iPhone and iPad → the App Store; Android → Google Play once the listing exists,
// the web app until then; everything else → the web app. Onward links say they came from the
// poster: utm_source=plakat for the web (src/lib/telemetry.ts reads it), ct=plakat for the App
// Store (App Store Connect campaign). Node imports this via type stripping: import-free.

export const APP_LINK_URL = 'https://bohosluzby.dravec.org/app/'
export const APP_STORE_URL = 'https://apps.apple.com/cz/app/id6792305024?ct=plakat'
/** Set when the Play listing is live (docs/ANDROID-RELEASE.md); empty sends Android to the web. */
export const PLAY_STORE_URL = ''
export const WEB_URL = 'https://bohosluzby.dravec.org/?utm_source=plakat'

const IOS = /iPhone|iPad|iPod/
const MAC = /Macintosh/
const ANDROID = /Android/

/** Where a phone with this user agent goes. `touch` is navigator.maxTouchPoints (iPadOS says "Macintosh"). */
export function appLinkTarget(ua: string, touch = 0, play = PLAY_STORE_URL): string {
  if (IOS.test(ua) || (MAC.test(ua) && touch > 1)) return APP_STORE_URL
  if (ANDROID.test(ua) && play) return play
  return WEB_URL
}

const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

/** The static /app/ page: two plain links, and a tiny inline redirect that makes appLinkTarget's choice. */
export function appLinkPage() {
  const script =
    `var u=navigator.userAgent||'',t=navigator.maxTouchPoints||0,p=${JSON.stringify(PLAY_STORE_URL)};` +
    `location.replace(${IOS}.test(u)||(${MAC}.test(u)&&t>1)?${JSON.stringify(APP_STORE_URL)}:${ANDROID}.test(u)&&p?p:${JSON.stringify(WEB_URL)})`
  const body =
    `<main class="ordo-page"><h1>Kam na mši</h1>` +
    `<p>Mše svatá poblíž, právě teď.</p>` +
    `<ul><li><a href="${esc(APP_STORE_URL)}">Aplikace pro iPhone a iPad (App Store)</a></li>` +
    `<li><a href="${esc(WEB_URL)}">Otevřít v prohlížeči: bohosluzby.dravec.org</a></li></ul>` +
    `</main><script>${script}</script>`
  return {
    url: APP_LINK_URL,
    title: 'Kam na mši: aplikace a web',
    description: 'Nejbližší katolické bohoslužby podle polohy. Aplikace pro iPhone a web.',
    body,
    jsonLd: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Kam na mši', url: APP_LINK_URL }),
    noindex: true,
  }
}

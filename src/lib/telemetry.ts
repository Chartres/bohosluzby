// Telemetry hygiene (pure — wired in analytics.ts and App's page_view).

// "bot" as a word ending, but not the CUBOT phone brand; plus the crawler,
// headless and audit agents that execute JS and would otherwise count as visitors.
// No lookbehind: it is a parse error on iOS Safari < 16.4 and would take the
// whole bundle down there.
const BOT_UA =
  /(?:^|[^u])bot\b|crawl|spider|slurp|headless|lighthouse|pagespeed|inspectiontool|bingpreview|facebookexternalhit/i

export function isLikelyBot(nav: { userAgent?: string; webdriver?: boolean }): boolean {
  return nav.webdriver === true || BOT_UA.test(nav.userAgent ?? '')
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const

/** Where a visit came from and what it landed on — the questions the first
 * /flywheel:evolve run could not answer. Referrer is reduced to its host; only
 * utm tags are kept from the query. No identifiers. */
export function pageViewContext(i: {
  pathname: string
  search: string
  referrer: string
  host: string
  lang: string
  platform: string
  standalone: boolean
}): Record<string, string | boolean | null> {
  const city = /^\/mesto\/([^/]+)/.exec(i.pathname)?.[1]
  const route = city
    ? 'city'
    : i.pathname.startsWith('/kostel/')
      ? 'church'
      : i.pathname === '/'
        ? 'home'
        : 'other'
  const bare = (h: string) => h.replace(/^www\./, '')
  let ref: string | null = null
  try {
    const h = bare(new URL(i.referrer).hostname)
    if (h && h !== bare(i.host)) ref = h
  } catch {
    // empty or malformed referrer → direct
  }
  const q = new URLSearchParams(i.search)
  const utm: Record<string, string> = {}
  for (const k of UTM_KEYS) {
    const v = q.get(k)
    if (v) utm[k] = v.slice(0, 64)
  }
  return {
    route,
    ...(city ? { city } : {}),
    ref,
    ...utm,
    lang: i.lang,
    platform: i.platform,
    standalone: i.standalone,
  }
}

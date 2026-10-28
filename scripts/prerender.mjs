// Post-build prerender (autoskola pattern): one static, crawlable HTML page per
// large city (/mesto/<slug>/) + sitemap.xml + the GH Pages 404.html fallback.
// With PRERENDER_CHURCHES=1 (the web deploy in ci.yml — never the native
// builds, which bundle dist/) also one page per church (/kostel/<id>/): GitHub
// Pages answers a missing path with 404.html AND status 404, so every shared,
// .ics and city-page church link was a 404 to crawlers and link unfurlers.
// No SSR framework — pages are copies of the built index.html with city-specific
// <title>/meta/#root content; the app boots on top and shows that city's list.
// Usage: node scripts/prerender.mjs   (after `vite build`; node ≥22.6 runs the
// imported .ts domain module via type stripping)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { aggregateCities, cityLabel } from '../src/domain/cities.ts'
import { churchPage, cityItemList } from '../src/domain/churchPage.ts'
import { embedData } from '../src/domain/embedData.ts'
import { churchFeastSection, feastBeacon, feastCityPage, feastHubPage } from '../src/domain/feast.ts'
import { SITE_ORIGIN as ORIGIN } from '../src/domain/site.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const CITY_PAGES = 30
const MAX_CHURCH_LINKS = 60

const CHURCH_PAGES = process.env.PRERENDER_CHURCHES === '1'

const index = JSON.parse(readFileSync(`${root}public/data/churches.json`, 'utf8')).map(
  ([id, name, city, lat, lng, , cell, www]) => ({ id, name, city, lat, lng, cell, www: www || undefined }),
)
const allCities = aggregateCities(index)
const cities = allCities.slice(0, CITY_PAGES)
// Dušičky pages: every municipality with 3+ churches — people go back to the
// district town they grew up in, which the top 30 by church count misses
// (Jihlava, Karlovy Vary, Kolín…). Namesakes carry their nearest town.
const FEAST_MIN_CHURCHES = 3
const feastCities = allCities
  .filter((c) => c.count >= FEAST_MIN_CHURCHES)
  .map((c, i) => ({ ...c, name: cityLabel(c), cityPage: i < CITY_PAGES }))
  .sort((a, b) => a.name.localeCompare(b.name, 'cs'))

const esc = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const template = readFileSync(`${root}dist/index.html`, 'utf8')
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' }) // YYYY-MM-DD

const shards = new Map()
const shard = (cell) => {
  if (!shards.has(cell)) {
    let data = {}
    try {
      data = JSON.parse(readFileSync(`${root}public/data/services/${cell}.json`, 'utf8'))
    } catch {
      // no shard → the page still names the church and its source
    }
    shards.set(cell, data)
  }
  return shards.get(cell)
}
const entryOf = (church) => shard(church.cell)[church.id]

const cityLinks = (skipSlug) =>
  cities
    .filter((c) => c.slug !== skipSlug)
    .map((c) => `<li><a href="${ORIGIN}/mesto/${c.slug}/">Bohoslužby ${esc(c.name)}</a></li>`)
    .join('\n          ')

function withMeta(html, { title, description, url }) {
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`)
}

// city pages — titles match the real queries ("mše praha dnes", "bohoslužby brno")
for (const city of cities) {
  const url = `${ORIGIN}/mesto/${city.slug}/`
  const title = `Bohoslužby ${city.name} — mše svatá dnes`
  const description = `Mše svatá ${city.name} dnes, zítra i v neděli: aktuální pořad bohoslužeb pro ${city.count} ${city.count >= 5 ? 'kostelů' : 'kostely'}. Údaje z rejstříku ČBK, zdarma a bez reklam.`
  const body = `
      <div>
        <h1>Bohoslužby ${esc(city.name)} — mše svatá dnes</h1>
        <p>Kdy je dnes mše svatá? ${esc(city.name)} má v rejstříku ČBK ${city.count} ${city.count >= 5 ? 'kostelů' : 'kostely'} s pořadem bohoslužeb. Aplikace ukáže, kterou bohoslužbu ještě stihnete — dnes, zítra i v neděli. Zdarma, bez reklam a bez registrace.</p>
        <h2>Kostely (${esc(city.name)})</h2>
        <ul>
          ${city.churches
            .slice(0, MAX_CHURCH_LINKS)
            .map((c) => `<li><a href="${ORIGIN}/kostel/${c.id}/">${esc(c.name)}</a></li>`)
            .join('\n          ')}
        </ul>
        <h2>Bohoslužby v dalších městech</h2>
        <ul>
          ${cityLinks(city.slug)}
        </ul>
        <p><a href="${ORIGIN}/dusicky/${city.slug}/">Všech svatých a Dušičky — mše svatá ${esc(city.name)}</a></p>
        <p><a href="${ORIGIN}/">Bohoslužby podle vaší polohy</a></p>
      </div>
`
  const html = withMeta(template, { title, description, url })
    .replace(/<!--seo-->[\s\S]*<!--\/seo-->/, () => `<!--seo-->${body}<!--/seo-->`)
    .replace('</head>', () => `  <script type="application/ld+json">${cityItemList(city)}</script>\n  </head>`)
  mkdirSync(`${root}dist/mesto/${city.slug}`, { recursive: true })
  writeFileSync(`${root}dist/mesto/${city.slug}/index.html`, html)
}

// Dušičky pages (/dusicky/ + /dusicky/<city>/) — the list IS the page: no app
// boots on top (the app has no such route and would show "near me" instead of
// the city someone searched for). Same paper, ink and type as the app.
const STATIC_CSS = `
      :root { --season: #7a5a1e; }
      body { background: #f6f1e5; color: #1a1712; }
      .ordo-page { max-width: 40rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; line-height: 1.5; font-size: 1rem; }
      .ordo-page h1 { font-family: 'Fraunces Variable', Fraunces, Georgia, serif; font-size: 1.75rem; line-height: 1.2; margin: 0.75rem 0 1rem; }
      .ordo-page h2 { font-family: 'Fraunces Variable', Fraunces, Georgia, serif; font-size: 1.3rem; margin: 2rem 0 0.25rem; padding-bottom: 0.35rem; border-bottom: 1px solid #d8d0bd; }
      .ordo-page h3 { font-family: 'Fraunces Variable', Fraunces, Georgia, serif; font-size: 1.05rem; margin: 1.25rem 0 0.25rem; }
      .ordo-page p { margin: 0.6rem 0; }
      .ordo-page a { color: #1a1712; text-decoration: underline; text-decoration-color: var(--season); text-underline-offset: 3px; }
      .ordo-page .rubric, .ordo-page .crumbs { color: #9a2b1e; font-variant-caps: all-small-caps; letter-spacing: 0.04em; font-family: 'Source Sans 3', system-ui, sans-serif; }
      .ordo-page h2 .rubric { display: block; font-size: 0.95rem; }
      .ordo-page .crumbs a { color: #9a2b1e; }
      .ordo { list-style: none; padding: 0; margin: 0; }
      .ordo li { display: grid; grid-template-columns: 3.75rem 1fr; column-gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid #d8d0bd; min-height: 44px; }
      .ordo .t { grid-row: span 2; font-family: 'Fraunces Variable', Fraunces, Georgia, serif; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
      .ordo .d { grid-column: 2; font-size: 0.875rem; color: #655c4d; }
      .cities { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 1.5rem; }
      .cities li { padding: 0.5rem 0; }
      .ordo-page .small { font-size: 0.875rem; color: #655c4d; }
`
const BEACON = feastBeacon(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
)
function staticPage(page) {
  return withMeta(template, page)
    .replace(/<script type="module"[^>]*><\/script>\s*/g, '')
    .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
    .replace(/<!--seo-->[\s\S]*<!--\/seo-->/, () => `<!--seo-->${page.body}<!--/seo-->`)
    .replace(
      '</head>',
      () => `  <style>${STATIC_CSS}    </style>\n    <script type="application/ld+json">${page.jsonLd}</script>\n    ${BEACON}\n  </head>`,
    )
}
const feastUrls = ['/dusicky/']
const feastListed = []
for (const city of feastCities) {
  const entries = Object.fromEntries(city.churches.map((c) => [c.id, entryOf(c)]))
  const page = feastCityPage({ city, entries, today })
  if (page.services === 0) continue // nothing in the registry for either day — no thin page
  mkdirSync(`${root}dist/dusicky/${city.slug}`, { recursive: true })
  writeFileSync(`${root}dist/dusicky/${city.slug}/index.html`, staticPage(page))
  feastUrls.push(`/dusicky/${city.slug}/`)
  feastListed.push(city)
}
mkdirSync(`${root}dist/dusicky`, { recursive: true })
writeFileSync(`${root}dist/dusicky/index.html`, staticPage(feastHubPage({ cities: feastListed, today })))

// home page: inject the city index into its static seo block, then mirror it
// to 404.html (GH Pages deep-link fallback for /kostel/<id>/)
const home = template.replace(
  /<!--\/seo-->/,
  `  <p><a href="${ORIGIN}/dusicky/">Všech svatých a Dušičky — mše svatá podle měst</a></p>
        <h2>Bohoslužby ve městech</h2>
        <ul>
          ${cityLinks(null)}
        </ul>
      <!--/seo-->`,
)
writeFileSync(`${root}dist/index.html`, home)
copyFileSync(`${root}dist/index.html`, `${root}dist/404.html`)

// church pages — the static ordo for crawlers/unfurlers; the app boots on top
const churchUrls = []
if (CHURCH_PAGES) {
  const cityOf = new Map()
  for (const c of cities) for (const ch of c.churches) cityOf.set(ch.id, { slug: c.slug, name: c.name })
  mkdirSync(`${root}dist/embed`, { recursive: true })
  for (const church of index) {
    const page = churchPage({ church, entry: shard(church.cell)[church.id], today, city: cityOf.get(church.id) })
    // replacer functions: registry text may contain "$&"-style patterns
    const html = withMeta(template, page)
      .replace(/<!--seo-->[\s\S]*<!--\/seo-->/, () => `<!--seo-->${page.body}<!--/seo-->`)
      .replace('</head>', () => `  <script type="application/ld+json">${page.jsonLd}</script>\n  </head>`)
    mkdirSync(`${root}dist/kostel/${church.id}`, { recursive: true })
    writeFileSync(`${root}dist/kostel/${church.id}/index.html`, html)
    // lastmod = when the parish last touched the entry — except while the page
    // carries the feast section, whose content moves with the build date
    const u = /^\d{4}-\d{2}-\d{2}/.exec(shard(church.cell)[church.id]?.u ?? '')?.[0]
    const feast = churchFeastSection(shard(church.cell)[church.id], today) !== ''
    churchUrls.push([`/kostel/${church.id}/`, !feast && u ? u : today])
    // the parish-website widget's data (public/embed.js)
    writeFileSync(
      `${root}dist/embed/${church.id}.json`,
      JSON.stringify(embedData({ church, entry: shard(church.cell)[church.id], today })),
    )
  }
}

const urls = [
  ...['/', ...cities.map((c) => `/mesto/${c.slug}/`), ...feastUrls].map((u) => [u, today]),
  ...churchUrls,
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, mod]) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${mod}</lastmod></url>`).join('\n')}
</urlset>
`
writeFileSync(`${root}dist/sitemap.xml`, sitemap)
console.log(
  `prerendered ${cities.length} city pages + ${feastUrls.length} Dušičky pages` +
    (CHURCH_PAGES ? ` + ${churchUrls.length} church pages` : ' (church pages off — PRERENDER_CHURCHES=1 for the web deploy)') +
    ' + sitemap.xml + 404.html',
)

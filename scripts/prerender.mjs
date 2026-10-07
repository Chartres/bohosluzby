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
import { aggregateCities } from '../src/domain/cities.ts'
import { churchPage } from '../src/domain/churchPage.ts'
import { embedData } from '../src/domain/embedData.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const ORIGIN = 'https://bohosluzby.dravec.org'
const CITY_PAGES = 30
const MAX_CHURCH_LINKS = 60

const CHURCH_PAGES = process.env.PRERENDER_CHURCHES === '1'

const index = JSON.parse(readFileSync(`${root}public/data/churches.json`, 'utf8')).map(
  ([id, name, city, lat, lng, , cell, www]) => ({ id, name, city, lat, lng, cell, www: www || undefined }),
)
const cities = aggregateCities(index).slice(0, CITY_PAGES)

const esc = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const template = readFileSync(`${root}dist/index.html`, 'utf8')

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
        <p><a href="${ORIGIN}/">Bohoslužby podle vaší polohy</a></p>
      </div>
`
  const html = withMeta(template, { title, description, url }).replace(
    /<!--seo-->[\s\S]*<!--\/seo-->/,
    `<!--seo-->${body}<!--/seo-->`,
  )
  mkdirSync(`${root}dist/mesto/${city.slug}`, { recursive: true })
  writeFileSync(`${root}dist/mesto/${city.slug}/index.html`, html)
}

// home page: inject the city index into its static seo block, then mirror it
// to 404.html (GH Pages deep-link fallback for /kostel/<id>/)
const home = template.replace(
  /<!--\/seo-->/,
  `  <h2>Bohoslužby ve městech</h2>
        <ul>
          ${cityLinks(null)}
        </ul>
      <!--/seo-->`,
)
writeFileSync(`${root}dist/index.html`, home)
copyFileSync(`${root}dist/index.html`, `${root}dist/404.html`)

// church pages — the static ordo for crawlers/unfurlers; the app boots on top
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' }) // YYYY-MM-DD
const churchUrls = []
if (CHURCH_PAGES) {
  const cityOf = new Map()
  for (const c of cities) for (const ch of c.churches) cityOf.set(ch.id, { slug: c.slug, name: c.name })
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
  for (const church of index) {
    const page = churchPage({ church, entry: shard(church.cell)[church.id], today, city: cityOf.get(church.id) })
    // replacer functions: registry text may contain "$&"-style patterns
    const html = withMeta(template, page)
      .replace(/<!--seo-->[\s\S]*<!--\/seo-->/, () => `<!--seo-->${page.body}<!--/seo-->`)
      .replace('</head>', () => `  <script type="application/ld+json">${page.jsonLd}</script>\n  </head>`)
    mkdirSync(`${root}dist/kostel/${church.id}`, { recursive: true })
    writeFileSync(`${root}dist/kostel/${church.id}/index.html`, html)
    churchUrls.push(`/kostel/${church.id}/`)
    // the parish-website widget's data (public/embed.js)
    mkdirSync(`${root}dist/embed`, { recursive: true })
    writeFileSync(
      `${root}dist/embed/${church.id}.json`,
      JSON.stringify(embedData({ church, entry: shard(church.cell)[church.id], today })),
    )
  }
}

const urls = ['/', ...cities.map((c) => `/mesto/${c.slug}/`), ...churchUrls]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`
writeFileSync(`${root}dist/sitemap.xml`, sitemap)
console.log(
  `prerendered ${cities.length} city pages` +
    (CHURCH_PAGES ? ` + ${churchUrls.length} church pages` : ' (church pages off — PRERENDER_CHURCHES=1 for the web deploy)') +
    ' + sitemap.xml + 404.html',
)

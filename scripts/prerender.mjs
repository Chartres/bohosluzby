// Post-build prerender (autoskola pattern): one static, crawlable HTML page per
// large city (/mesto/<slug>/) + sitemap.xml + the GH Pages 404.html fallback.
// No SSR framework — pages are copies of the built index.html with city-specific
// <title>/meta/#root content; the app boots on top and shows that city's list.
// Usage: node scripts/prerender.mjs   (after `vite build`; node ≥22.6 runs the
// imported .ts domain module via type stripping)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { aggregateCities } from '../src/domain/cities.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const ORIGIN = 'https://bohosluzby.dravec.org'
const CITY_PAGES = 30
const MAX_CHURCH_LINKS = 60

const index = JSON.parse(readFileSync(`${root}public/data/churches.json`, 'utf8')).map(
  ([id, name, city, lat, lng]) => ({ id, name, city, lat, lng }),
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

const today = new Date().toISOString().slice(0, 10)
const urls = ['/', ...cities.map((c) => `/mesto/${c.slug}/`)]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`
writeFileSync(`${root}dist/sitemap.xml`, sitemap)
console.log(`prerendered ${cities.length} city pages + sitemap.xml + 404.html`)

// Read back what the web deploy publishes (Flywheel Standard rule 15): every
// church in the index has a real /kostel/<id>/ page with its own title and
// Church JSON-LD, and the sitemap lists it. Run after
// `PRERENDER_CHURCHES=1 npm run build` (ci.yml does).
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const index = JSON.parse(readFileSync(`${root}public/data/churches.json`, 'utf8'))
const sitemap = readFileSync(`${root}dist/sitemap.xml`, 'utf8')
const esc = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const problems = []
for (const [id, name] of index) {
  const file = `${root}dist/kostel/${id}/index.html`
  if (!existsSync(file)) {
    problems.push(`${id}: no page`)
    continue
  }
  const html = readFileSync(file, 'utf8')
  if (!html.includes(`<title>${esc(name)}`)) problems.push(`${id}: title is not the church's`)
  if (!html.includes('"@type":"Church"')) problems.push(`${id}: no Church JSON-LD`)
  if (!html.includes(`<link rel="canonical" href="https://bohosluzby.dravec.org/kostel/${id}/" />`))
    problems.push(`${id}: canonical is not the church page`)
  if (!sitemap.includes(`/kostel/${id}/</loc>`)) problems.push(`${id}: missing from sitemap.xml`)
  const embed = `${root}dist/embed/${id}.json`
  if (!existsSync(embed) || JSON.parse(readFileSync(embed, 'utf8')).id !== id) problems.push(`${id}: no embed json`)
}
// Dušičky pages: a static list per city page, readable without JavaScript, no
// app bundle booting over it (the app has no /dusicky/ route)
const cityDirs = [...sitemap.matchAll(/\/mesto\/([^/]+)\/<\/loc>/g)].map((m) => m[1])
const feastDirs = [...sitemap.matchAll(/\/dusicky\/([^/]+)\/<\/loc>/g)].map((m) => m[1])
for (const slug of cityDirs) {
  // a city page may only link a feast page that exists
  const html = readFileSync(`${root}dist/mesto/${slug}/index.html`, 'utf8')
  for (const m of html.matchAll(/\/dusicky\/([^/"]+)\//g)) if (!feastDirs.includes(m[1])) problems.push(`mesto/${slug}/ links a missing /dusicky/${m[1]}/`)
}
for (const slug of ['', ...feastDirs]) {
  const path = slug ? `dusicky/${slug}/` : 'dusicky/'
  const file = `${root}dist/${path}index.html`
  if (!existsSync(file)) {
    problems.push(`${path}: no page`)
    continue
  }
  const html = readFileSync(file, 'utf8')
  if (!html.includes('<title>Dušičky')) problems.push(`${path}: title is not the feast's`)
  if (!html.includes(`<link rel="canonical" href="https://bohosluzby.dravec.org/${path}" />`))
    problems.push(`${path}: canonical is not the page`)
  if (html.includes('type="module"')) problems.push(`${path}: boots the app over the list`)
  if (slug && !html.includes('class="ordo"')) problems.push(`${path}: no service list`)
  // the hub: a build-time SVG map and the towns grouped by diocese, no tiles
  if (!slug && !(html.includes('<figure class="map"><svg') && html.includes('id="dieceze"'))) problems.push(`${path}: no map or diocese list`)
  if (!sitemap.includes(`/${path}</loc>`)) problems.push(`${path}: missing from sitemap.xml`)
}
// Christmas and roráty pages (option A, 12 Nov 2026): every town in the sitemap has a
// static page and a Markdown twin; the twin is in the sitemap, linked from the page,
// dated and sourced; the page carries Events only for services it lists
for (const kind of ['vanoce', 'advent']) {
  const dirs = [...sitemap.matchAll(new RegExp(`/${kind}/([^/]+)/</loc>`, 'g'))].map((m) => m[1])
  if (dirs.length < feastDirs.length) problems.push(`${kind}: ${dirs.length} town pages, Dušičky has ${feastDirs.length}`)
  for (const slug of ['', ...dirs]) {
    const path = slug ? `${kind}/${slug}/` : `${kind}/`
    if (!existsSync(`${root}dist/${path}index.html`) || !existsSync(`${root}dist/${path}index.md`)) {
      problems.push(`${path}: page or twin missing`)
      continue
    }
    const html = readFileSync(`${root}dist/${path}index.html`, 'utf8')
    const md = readFileSync(`${root}dist/${path}index.md`, 'utf8')
    if (html.includes('type="module"')) problems.push(`${path}: boots the app over the list`)
    if (!html.includes(`<link rel="canonical" href="https://bohosluzby.dravec.org/${path}" />`)) problems.push(`${path}: canonical is not the page`)
    if (!html.includes(`<link rel="alternate" type="text/markdown" href="https://bohosluzby.dravec.org/${path}index.md" />`)) problems.push(`${path}: no twin link`)
    if (!html.includes('Aktualizováno') || !html.includes('bohosluzby.cirkev.cz')) problems.push(`${path}: no date or source`)
    if (!md.startsWith('# ') || !md.includes('Aktualizováno:') || !md.includes('bohosluzby.cirkev.cz')) problems.push(`${path}index.md: no title, date or source`)
    if (!sitemap.includes(`/${path}index.md</loc>`)) problems.push(`${path}index.md: missing from sitemap.xml`)
    if (slug) {
      const listed = (html.match(/<span class="t">/g) ?? []).length
      const events = (html.match(/"@type":"Event"/g) ?? []).length
      if (events < listed) problems.push(`${path}: ${listed} services but ${events} Events`)
    }
  }
}
if (problems.length) {
  console.error(`church pages: ${problems.length} problem(s)\n${problems.slice(0, 20).join('\n')}`)
  process.exit(1)
}
console.log(`church pages: all ${index.length} present, titled, canonical, in the sitemap, with embed json`)

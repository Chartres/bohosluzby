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
for (const slug of cityDirs) if (!feastDirs.includes(slug)) problems.push(`mesto/${slug}/ has no Dušičky page`)
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
  if (!sitemap.includes(`/${path}</loc>`)) problems.push(`${path}: missing from sitemap.xml`)
}
if (problems.length) {
  console.error(`church pages: ${problems.length} problem(s)\n${problems.slice(0, 20).join('\n')}`)
  process.exit(1)
}
console.log(`church pages: all ${index.length} present, titled, canonical, in the sitemap, with embed json`)

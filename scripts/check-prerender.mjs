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
}
if (problems.length) {
  console.error(`church pages: ${problems.length} problem(s)\n${problems.slice(0, 20).join('\n')}`)
  process.exit(1)
}
console.log(`church pages: all ${index.length} present, titled, canonical, in the sitemap`)

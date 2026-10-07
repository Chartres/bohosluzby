// Static content for a prerendered /kostel/<id>/ page (scripts/prerender.mjs,
// web deploy only — PRERENDER_CHURCHES=1). What crawlers, link unfurlers and AI
// agents read; the app boots on top and replaces it. States only what the
// registry says: the weekly ordo, upcoming one-offs, confession windows, the
// source and its date — and the stale warning the app shows.
// Node imports this via type stripping: explicit .ts specifiers, types only
// from elsewhere.
import { isConfession, isStale, normalizeLang } from './registry.ts'
import { churchUrl, SITE_ORIGIN } from './site.ts'

type Row = [days: string, time: string, lang: string, greek: 0 | 1, type: string, note: string]

/** services/<cell>.json value (compact keys, data/extract.mjs). */
export interface RawEntry {
  u: string
  p: string
  pa: string
  c: [string, string][]
  s: Row[]
  x?: Row[]
}

export interface PageChurch {
  id: string
  name: string
  city: string
  lat: number
  lng: number
  www?: string
}

export interface ChurchPage {
  url: string
  /** Plain text — escaped where it's written into the template. */
  title: string
  description: string
  /** Safe HTML for the #root seo block. */
  body: string
  /** JSON for a <script type="application/ld+json">, safe to inline. */
  jsonLd: string
}

// Liturgical week: Sunday first, like a printed ordo (and ChurchDetail).
const DAY_ORDER = ['7', '1', '2', '3', '4', '5', '6']
const DAY_NAME: Record<string, string> = {
  '1': 'pondělí',
  '2': 'úterý',
  '3': 'středa',
  '4': 'čtvrtek',
  '5': 'pátek',
  '6': 'sobota',
  '7': 'neděle',
}
const EXTRAS_MAX = 10

const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

/** "2026-06-01" → "1. 6. 2026" */
function dateCz(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : ''
}

function rowText(time: string, lang: string, greek: 0 | 1, type: string, note: string): string {
  const l = normalizeLang(lang)
  return (
    `${time} ${type.trim() || 'bohoslužba'}` +
    (l !== 'česky' ? ` (${l})` : '') +
    (greek === 1 ? ' (řeckokatolický ritus)' : '') +
    (note.trim() ? ` — ${note.trim()}` : '')
  )
}

function byDay(rows: Row[], text: (r: Row) => string): string {
  return DAY_ORDER.map((day) => {
    const items = rows.filter((r) => r[0].includes(day)).sort((a, b) => a[1].localeCompare(b[1]))
    if (items.length === 0) return ''
    return `<h3>${DAY_NAME[day]}</h3>\n<ul>${items.map((r) => `<li>${esc(text(r))}</li>`).join('')}</ul>`
  }).join('\n')
}

export function churchPage(input: {
  church: PageChurch
  entry: RawEntry | undefined
  /** Build date, "YYYY-MM-DD" (Prague) — one-offs before it are dropped. */
  today: string
  /** The prerendered city page this church belongs to, when there is one. */
  city?: { slug: string; name: string }
}): ChurchPage {
  const { church, entry, today, city } = input
  const url = churchUrl(church.id)
  const regular = (entry?.s ?? []).filter((r) => !isConfession(r[4]))
  const confession = (entry?.s ?? []).filter((r) => isConfession(r[4]))
  const extras = (entry?.x ?? [])
    .filter((r) => r[0] >= today)
    .sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]))
    .slice(0, EXTRAS_MAX)
  const updated = dateCz(entry?.u ?? '')

  const placeInName = church.name.toLowerCase().includes(church.city.toLowerCase())
  const title = `${church.name}${placeInName || !church.city ? '' : ` (${church.city})`} — pořad bohoslužeb | Kam na mši`

  const sunday = [...new Set(regular.filter((r) => r[0].includes('7')).map((r) => r[1]))].sort()
  const description = (
    `${church.name}${church.city && !placeInName ? `, ${church.city}` : ''}: pořad bohoslužeb` +
    (sunday.length ? ` — neděle ${sunday.join(', ')}` : '') +
    `. Z rejstříku ČBK${updated ? `, aktualizace ${updated}` : ''}.`
  ).slice(0, 200)

  const where = [church.city, entry?.p, entry?.pa].filter((s): s is string => Boolean(s?.trim()))
  const parts: string[] = [`<h1>${esc(church.name)}</h1>`]
  if (where.length) parts.push(`<p>${where.map(esc).join(' · ')}</p>`)
  if (regular.length) {
    parts.push('<h2>Pořad bohoslužeb</h2>', byDay(regular, (r) => rowText(r[1], r[2], r[3], r[4], r[5])))
  }
  if (extras.length) {
    parts.push(
      '<h2>Mimořádné bohoslužby</h2>',
      `<ul>${extras.map((r) => `<li>${esc(`${dateCz(r[0])} ${rowText(r[1], r[2], r[3], r[4], r[5])}`)}</li>`).join('')}</ul>`,
    )
  }
  if (confession.length) {
    parts.push('<h2>Svátost smíření</h2>', byDay(confession, (r) => r[1] + (r[5].trim() ? ` — ${r[5].trim()}` : '')))
  }
  if (entry && isStale(entry.u, new Date(`${today}T12:00:00Z`))) {
    parts.push(`<p><strong>Rozpis byl naposledy ověřen ${esc(updated)} — před cestou si ho ověřte u farnosti.</strong></p>`)
  }
  parts.push(
    `<p>Údaje z rejstříku bohosluzby.cirkev.cz${updated ? `, aktualizace ${esc(updated)}` : ''}.` +
      (church.www ? ` <a href="${esc(church.www)}">Web farnosti</a>.` : '') +
      '</p>',
    `<p>${city ? `<a href="${SITE_ORIGIN}/mesto/${esc(city.slug)}/">Bohoslužby ${esc(city.name)}</a> · ` : ''}` +
      `<a href="${SITE_ORIGIN}/">Bohoslužby podle vaší polohy</a></p>`,
  )
  const body = `
      <div class="mx-auto w-full max-w-2xl px-5 py-8">
        ${parts.join('\n        ')}
      </div>
`

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: church.name,
    url: church.www || url,
    mainEntityOfPage: url,
    address: { '@type': 'PostalAddress', addressLocality: church.city, addressCountry: 'CZ' },
    geo: { '@type': 'GeoCoordinates', latitude: church.lat, longitude: church.lng },
  }).replaceAll('<', '\\u003c') // never let registry text close the <script>

  return { url, title, description, body, jsonLd }
}

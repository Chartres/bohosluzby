// Match Czech churches to a licensed exterior photo on Wikimedia Commons.
// Pure Node (stdlib + global fetch), no deps — same shape as data/extract.mjs.
//
// Why precision-first: a live sample showed Commons has good coverage, but a
// plain geosearch-by-coords grabs a NEIGHBOURING church's photo in a dense old
// town. So a candidate FILE is accepted only when its filename carries BOTH a
// church keyword AND one of THIS church's dedication tokens (the patron saint /
// feast, accent-insensitive). No dedication match → no photo (a blank is the
// correct answer, never a wrong church).
//
// Output: public/data/photos.json = { [churchId]: { url, credit, license } },
// only matched churches. url is a ≤480px remote thumbnail — never bundled, so
// $0 app-size cost. Attribution (credit + license) is REQUIRED and stored.
//
// Usage (bounded — do NOT run the full 3988 here):
//   node data/match-photos.mjs --sample            # first ~200 churches
//   node data/match-photos.mjs --cell 50-14        # one grid cell (Prague)
//   node data/match-photos.mjs --limit 50          # first N churches
// TODO(nightly): wire the full run into .github/workflows/refresh-data.yml after
// data/extract.mjs (it regenerates churches.json first). Not edited here.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// ---- pure matching logic (unit-tested in match-photos.test.mjs) -------------

/** Accent-fold to ASCII-ish lowercase: "Víta" → "vita", "Tomáše" → "tomase". */
export const fold = (s) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Words that describe the BUILDING or are grammatical glue, never the dedication.
// Folded to match `fold()` output. Capitalised ones (Panny, Nejsvětějšího…) are
// here too so only the true patron token survives.
const GENERIC = new Set([
  'kostel', 'kostelik', 'kaple', 'kaplicka', 'kaplecka', 'katedrala', 'konkatedrala',
  'bazilika', 'basilica', 'minor', 'chram', 'chramek', 'rotunda', 'sbor', 'modlitebna',
  'farni', 'filialni', 'klasterni', 'kapitulni', 'vojensky', 'probostsky', 'dekansky',
  'poutni', 'hrbitovni', 'spitalni', 'zamecky', 'mestsky',
  'sv', 'svaty', 'svata', 'svate', 'svateho', 'svatych', 'svatem', 'svatou', 'sve',
  'panny', 'panna', 'nejsvetejsi', 'nejsvetejsiho', 'nejsvetejssi', 'nejsvetejssiho',
  'boziho', 'bozi', 'blahoslavene', 'blahoslaveneho', 'ct', 'blah', 'krista',
])
const CONNECT = new Set([
  'a', 'i', 'u', 'o', 'v', 've', 'na', 'nad', 'pod', 'se', 'si', 'ku', 'k',
  'the', 'of', 'and', 'church', 'kirche',
])

/** Genitive/possessive tail trim so "Tomáše" and a filename's "Tomáš" meet. */
const stem = (t) => (t.length > 4 ? t.replace(/[aeiouy]$/, '') : t)

/**
 * Dedication tokens for a church: the folded patron/feast words, with building
 * nouns, glue words, and the church's own place name stripped. Comma segments
 * that name the location ("…, Praha-Hradčany") are dropped whole so a district
 * never leaks in as a token.
 */
export function dedicationTokens(name, city = '') {
  const place = new Set(fold(city).split(/[^a-z0-9]+/).filter(Boolean))
  const segments = String(name)
    .split(',')
    .filter((seg) => !fold(seg).split(/[^a-z0-9]+/).some((w) => w && place.has(w)))
  const words = fold(segments.join(' ')).split(/[^a-z0-9]+/)
  const out = []
  for (const w of words) {
    if (w.length < 3 || /^\d+$/.test(w)) continue
    if (GENERIC.has(w) || CONNECT.has(w)) continue
    if (!out.includes(w)) out.push(w)
  }
  return out
}

const KEYWORD =
  /(kostel|church|katedr|kaple|bazilik|basilic|chram|kirche|cerkev|klaster|cathedral|chapel|rotunda)/
const INTERIOR =
  /(interier|interior|oltar|altar|varhany|organ|okno|detail|dvere|door|socha|statue|zvon|hrob|kriz|krypta|vitraz|freska|nave|plan|mapa|erb)/

// Whole-word (not substring) match: a token meets a filename word when they
// share a stem. Substring matching let "josef" (sv. Josefa) hit the STREET
// "Josefská" on a neighbouring sv. Tomáše file — the exact bleed to block.
const wordMatch = (w, t) => w === t || w === stem(t) || stem(w) === t || stem(w) === stem(t)

/** A Commons File: title qualifies iff it names a church AND one of this
 * church's dedication tokens appears as a WORD — the gate that blocks neighbour
 * bleed (wrong dedication) and street-name coincidences. */
export function fileQualifies(title, tokens) {
  const f = fold(title)
  if (!KEYWORD.test(f)) return false
  const words = f.split(/[^a-z0-9]+/).filter(Boolean)
  return tokens.some((t) => words.some((w) => wordMatch(w, t)))
}

/** Qualifying File: titles, exterior shots first (interiors/details demoted). */
export function rankFiles(titles, tokens) {
  const ok = titles.filter((t) => fileQualifies(t, tokens))
  return ok.sort((a, b) => Number(INTERIOR.test(fold(a))) - Number(INTERIOR.test(fold(b))))
}

/** Reusable = a CC/PD/GFDL license we can show with attribution. Empty or
 * "All rights reserved" is skipped — we never store a non-free image URL. */
export function isReusableLicense(license) {
  const l = String(license ?? '').trim()
  if (!l || /all rights reserved/i.test(l)) return false
  return /\b(cc|cc0|cc-|public domain|pd|pd-|gfdl)\b/i.test(l) || /^cc/i.test(l)
}

/** Commons extmetadata Artist is an HTML blob — reduce to plain text. */
export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- network + IO (only runs when executed directly) ------------------------

const UA = 'bohosluzby/1.0 (pavol@dravecky.sk)'
const API = 'https://commons.wikimedia.org/w/api.php'
const GAP_MS = 250

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function apiGet(params) {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json' })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** File: titles within `radius` m of a coord (namespace 6 = File). */
async function geosearch(lat, lng, radius = 150) {
  const j = await apiGet({
    action: 'query', list: 'geosearch',
    gscoord: `${lat}|${lng}`, gsradius: String(radius),
    gsnamespace: '6', gslimit: '15',
  })
  return (j?.query?.geosearch ?? []).map((g) => g.title).filter(Boolean)
}

/** thumburl (≤480px) + license + plain-text artist for one File: title. */
async function imageinfo(title) {
  const j = await apiGet({
    action: 'query', titles: title,
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '480',
  })
  const pages = j?.query?.pages ?? {}
  const info = Object.values(pages)[0]?.imageinfo?.[0]
  if (!info) return null
  const meta = info.extmetadata ?? {}
  return {
    url: info.thumburl || info.url,
    license: meta.LicenseShortName?.value ?? '',
    credit: stripHtml(meta.Artist?.value ?? ''),
  }
}

function parseArgs(argv) {
  const a = { limit: Infinity, cell: null, sample: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') a.limit = Number(argv[++i])
    else if (argv[i] === '--cell') a.cell = argv[++i]
    else if (argv[i] === '--sample') a.sample = true
  }
  if (a.sample && a.limit === Infinity) a.limit = 200
  return a
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const args = parseArgs(process.argv.slice(2))
  const rows = JSON.parse(readFileSync(`${root}public/data/churches.json`, 'utf8'))

  let churches = rows.map((r) => ({ id: r[0], name: r[1], city: r[2], lat: r[3], lng: r[4], cell: r[6] }))
  if (args.cell) churches = churches.filter((c) => c.cell.startsWith(args.cell))
  churches = churches.slice(0, args.limit)

  const photos = {}
  const licenses = {}
  let processed = 0, matched = 0, hadCandidate = 0
  for (const c of churches) {
    processed++
    const tokens = dedicationTokens(c.name, c.city)
    if (tokens.length === 0) continue
    let titles = []
    try {
      titles = await geosearch(c.lat, c.lng)
    } catch (err) {
      process.stderr.write(`  geosearch ${c.id} failed: ${err}\n`)
      await sleep(GAP_MS)
      continue
    }
    const ranked = rankFiles(titles, tokens)
    if (ranked.length) hadCandidate++
    // try qualifying files in exterior-first order until one is reusable (cap 3)
    for (const title of ranked.slice(0, 3)) {
      await sleep(GAP_MS)
      let info = null
      try {
        info = await imageinfo(title)
      } catch (err) {
        process.stderr.write(`  imageinfo ${title} failed: ${err}\n`)
        continue
      }
      if (!info?.url || !isReusableLicense(info.license)) continue
      photos[c.id] = { url: info.url, credit: info.credit, license: info.license }
      licenses[info.license] = (licenses[info.license] ?? 0) + 1
      matched++
      break
    }
    await sleep(GAP_MS)
    if (processed % 25 === 0) process.stderr.write(`  ${processed}/${churches.length} (${matched} matched)\n`)
  }

  writeFileSync(`${root}public/data/photos.json`, JSON.stringify(photos))
  const pct = processed ? ((matched / processed) * 100).toFixed(1) : '0.0'
  console.log(
    `photos: ${matched} matched of ${processed} churches (${pct}% coverage), ` +
      `${hadCandidate} had a qualifying candidate; licenses: ${JSON.stringify(licenses)}`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()

// Confession times from the diocesan "Stálá zpovědní služba / chci ke zpovědi"
// pages. Pure Node (stdlib + global fetch), no deps — same shape as
// data/extract.mjs and data/match-photos.mjs.
//
// Why this source: research found NO confession database to reuse; the ČBK
// registry we already ship types "svátost smíření" for only ~24 churches. The
// one rich, real source is each diocese's permanent-confession-service table.
// Prague's (apha.cz) is confirmed and detailed — one <table> of
// DEN | ČAS | KOSTEL | MÍSTO | Poznámka. We scrape it, match each row's church
// to a registry id, and ship the windows verbatim (a confession window has
// nuance — "30 min přede mší", multiple ranges — that must NOT be parsed into a
// single clock time).
//
// Schedules (facts) are not copyrightable; we store only day/time/note text and
// credit the diocese via the `source` field. Precision over coverage: a row is
// matched only when BOTH a dedication token AND a place token agree, else it is
// skipped and logged.
//
// Output: public/data/confession.json =
//   { [churchId]: { source: 'apha'|'diocese-<x>', rows: [{ den, cas, note }] } }
//
// Usage:  node data/scrape-confession-diocese.mjs
// TODO(nightly): wire this into .github/workflows/refresh-data.yml after
// data/extract.mjs regenerates churches.json. Not edited here.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fold, dedicationTokens } from './match-photos.mjs'

// ---- pure parse + match logic (unit-tested in the .test.mjs) ----------------

/** Decode the handful of HTML entities the diocesan tables use, strip tags, and
 * collapse whitespace — <br> becomes a space so a two-line cell stays one line. */
export function cellText(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Every <table> on a page, each as an array of rows, each row an array of cell
 * texts (th or td). Header detection is left to the caller. */
export function parseTables(html) {
  const tables = []
  for (const tm of String(html ?? '').matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = []
    for (const rm of tm[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rm[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => cellText(c[1]))
      if (cells.length) rows.push(cells)
    }
    if (rows.length) tables.push(rows)
  }
  return tables
}

/** True when a row is the DEN|ČAS|KOSTEL|MÍSTO header, not data. */
const isHeaderRow = (cells) => {
  const f = cells.map(fold)
  return f.includes('den') && (f.includes('kostel') || f.some((c) => c.includes('kostel')))
}

/**
 * Map a Prague-style table (columns DEN, ČAS, KOSTEL, MÍSTO, Poznámka) to
 * confession rows carrying the verbatim day, time-window, church name, place,
 * and note. Header and blank rows are dropped. Rows with neither a time nor a
 * note are dropped (nothing to show).
 */
export function rowsFromTable(table) {
  const out = []
  for (const cells of table) {
    if (cells.length < 4 || isHeaderRow(cells)) continue
    const [den, cas, kostel, misto = '', note = ''] = cells
    if (!kostel) continue
    if (!cas && !note) continue
    out.push({ den, cas, kostel, misto, note })
  }
  return out
}

// Place-name glue that never discriminates a district.
const PLACE_GLUE = new Set(['a', 'i', 'u', 'o', 'v', 've', 'na', 'nad', 'pod', 'nam', 'sv'])

/** Folded place tokens from the MÍSTO cell (+ any parenthetical in the KOSTEL
 * name, which often carries the district/street): "Praha – Nové Město" →
 * ['praha','nove','mesto']. */
export function placeTokens(text) {
  const out = []
  for (const w of fold(text).split(/[^a-z0-9]+/)) {
    if (w.length < 2 || PLACE_GLUE.has(w)) continue
    if (!out.includes(w)) out.push(w)
  }
  return out
}

/** Count of `tokens` that appear exactly among `have` (both already folded). */
const overlap = (tokens, have) => tokens.filter((t) => have.includes(t)).length

/**
 * Resolve a scraped KOSTEL + MÍSTO to a registry church id, or null.
 *
 * Precision over coverage (Prague old town is dense):
 *  - the church's dedication token(s) must overlap the KOSTEL's, AND
 *  - at least one place token (from MÍSTO + the KOSTEL parenthetical) must appear
 *    in the church's name/city — this is what separates the two sv. Josefa
 *    churches (Nové Město vs Malá Strana) and pins Svatá Hora to Příbram.
 * The best candidate wins by dedication overlap first, place overlap as the
 * tie-break. A genuine tie at the top (no discriminator) returns null and is
 * logged for review, rather than guessing a wrong church.
 *
 * `churches` rows: { id, name, city }.
 */
export function matchChurch(kostel, misto, churches) {
  const paren = kostel.match(/\(([^)]*)\)/)?.[1] ?? ''
  const bare = kostel.replace(/\([^)]*\)/g, ' ')
  const dtok = dedicationTokens(bare)
  if (dtok.length === 0) return null
  const ptok = placeTokens(`${misto} ${paren}`)

  let best = null
  let bestScore = -1
  let tie = false
  for (const c of churches) {
    const dScore = overlap(dtok, dedicationTokens(c.name, c.city))
    if (dScore === 0) continue
    const hay = fold(`${c.name} ${c.city}`).split(/[^a-z0-9]+/).filter(Boolean)
    const pScore = overlap(ptok, hay)
    if (pScore === 0) continue // require a place agreement — never match on dedication alone
    const score = dScore * 100 + pScore
    if (score > bestScore) {
      best = c
      bestScore = score
      tie = false
    } else if (score === bestScore) {
      tie = true
    }
  }
  if (!best || tie) return null
  return best.id
}

// ---- network + IO (only runs when executed directly) ------------------------

const UA = 'bohosluzby/1.0 (pavol@dravecky.sk)'
const GAP_MS = 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// The 8 (arch)dioceses. Prague is the confirmed, rich source; the rest are
// best-effort — we look for a confession page and try to parse a table the same
// way. A diocese that yields nothing parseable is skipped silently (logged).
const DIOCESES = [
  { key: 'apha', page: 'https://apha.cz/duchovni-sluzby/chci-ke-zpovedi/' },
  { key: 'brno', home: 'https://www.biskupstvi.cz/' },
  { key: 'olomouc', home: 'https://www.ado.cz/' },
  { key: 'plzen', home: 'https://www.bip.cz/' },
  { key: 'hradec', home: 'https://www.bihk.cz/' },
  { key: 'budejovice', home: 'https://www.bcb.cz/' },
  { key: 'litomerice', home: 'https://www.dltm.cz/' },
  { key: 'ostrava', home: 'https://www.doo.cz/' },
]

const CONF_LINK = /zpov[eě]|sm[ií][rř]|sv[aá]tost/i

/** Find a confession page URL on a diocesan homepage, or null. */
function findConfessionLink(homeHtml, baseUrl) {
  for (const m of homeHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]
    const label = cellText(m[2])
    if (CONF_LINK.test(label) || CONF_LINK.test(href)) {
      try {
        return new URL(href, baseUrl).href
      } catch {
        /* malformed href — skip */
      }
    }
  }
  return null
}

/** All confession rows a page yields across its tables (best-effort). */
function rowsFromPage(html) {
  return parseTables(html).flatMap(rowsFromTable)
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const index = JSON.parse(readFileSync(`${root}public/data/churches.json`, 'utf8'))
  const churches = index.map((r) => ({ id: r[0], name: r[1], city: r[2] }))

  /** @type {Record<string, {source: string, rows: {den:string,cas:string,note:string}[]}>} */
  const out = {}
  let totalRows = 0
  const unmatched = []

  for (const d of DIOCESES) {
    let rows = []
    try {
      if (d.page) {
        rows = rowsFromPage(await fetchText(d.page))
      } else {
        const home = await fetchText(d.home)
        const link = findConfessionLink(home, d.home)
        if (link) {
          await sleep(GAP_MS)
          rows = rowsFromPage(await fetchText(link))
        }
      }
    } catch (err) {
      process.stderr.write(`  ${d.key}: fetch failed (${err.message ?? err})\n`)
    }

    if (rows.length === 0) {
      console.log(`diocese ${d.key}: none`)
      await sleep(GAP_MS)
      continue
    }

    const source = d.key === 'apha' ? 'apha' : `diocese-${d.key}`
    let matched = 0
    for (const r of rows) {
      const id = matchChurch(r.kostel, r.misto, churches)
      if (!id) {
        unmatched.push(`${d.key}: ${r.kostel} — ${r.misto}`)
        continue
      }
      const entry = (out[id] ??= { source, rows: [] })
      const key = `${r.den}|${r.cas}|${r.note}`
      if (entry.rows.some((x) => `${x.den}|${x.cas}|${x.note}` === key)) continue // de-dup
      entry.rows.push({ den: r.den, cas: r.cas, note: r.note })
      matched++
    }
    totalRows += rows.length
    console.log(`diocese ${d.key}: ${rows.length} rows scraped, ${matched} matched`)
    await sleep(GAP_MS)
  }

  writeFileSync(`${root}public/data/confession.json`, JSON.stringify(out))
  const churchIds = Object.keys(out)
  console.log(
    `\nconfession: ${totalRows} rows scraped, ${churchIds.length} churches covered, ` +
      `${unmatched.length} unmatched rows`,
  )
  console.log(`  churches: ${churchIds.join(', ')}`)
  if (unmatched.length) console.log(`  unmatched:\n    ${unmatched.join('\n    ')}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()

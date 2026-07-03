// Data sync from bohosluzby.cirkev.cz (the official Czech Catholic service registry).
// Node stdlib only. Three phases, all resumable via data/cache/ (gitignored):
//
//   1. discover — POST apiWeb/allData (institutionTypes[]=1, zoom=15) over a lat/lng
//      grid covering CZ. zoom>=15 returns individual churches (real coordinates)
//      within a fixed ~10 km radius of the given center; the grid steps ~8 km so
//      circles overlap. Dedupe by id.
//   2. details — GET apiWeb/detail?id=<id> per church. This endpoint carries
//      everything we publish: institution (name, city, lat/lng, barrier_free,
//      updated_at), regular[] + extra[] services, parish name/address, contacts.
//      ponytail: apiWeb/detailById proved a superset-free duplicate of detail
//      (same institution fields + a rendered html blob), so it is not fetched —
//      halves the request count.
//   3. transform — cache → public/data/churches.json (compact index) +
//      public/data/services/<cell>.json shards (1°x1° grid cells, key "49-14").
//
// Usage:
//   node data/extract.mjs              # all three phases (resumes where it left off)
//   node data/extract.mjs transform    # rebuild JSON from cache only (offline)
//
// Politeness: <=3 req/s, retry with backoff, honest User-Agent.

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const CACHE = `${root}data/cache`
const OUT = `${root}public/data`
const BASE = 'https://bohosluzby.cirkev.cz/index.php/apiWeb/'
const UA = 'bohosluzby.dravec.org data sync (pavol+claude@dravecky.sk)'

// CZ bounding box; ~8 km grid step against the ~10 km response radius.
const LAT_MIN = 48.5, LAT_MAX = 51.1, LAT_STEP = 0.072 // ~8.0 km
const LNG_MIN = 12.0, LNG_MAX = 18.9, LNG_STEP = 0.111 // ~8.0 km at 50°N

mkdirSync(`${CACHE}/grid`, { recursive: true })
mkdirSync(`${CACHE}/detail`, { recursive: true })
mkdirSync(`${OUT}/services`, { recursive: true })

// --- rate limit + retry -----------------------------------------------------
let lastRequest = 0
const MIN_GAP_MS = 350 // <3 req/s

async function fetchPolite(url, options = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = lastRequest + MIN_GAP_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastRequest = Date.now()
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'User-Agent': UA, ...(options.headers ?? {}) },
        signal: AbortSignal.timeout(30_000),
      })
      if (res.ok) return await res.text()
      if (res.status >= 400 && res.status < 500) throw new Error(`HTTP ${res.status} (permanent) for ${url}`)
      throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      if (String(err).includes('permanent') || attempt === 4) throw err
      const backoff = 1000 * 2 ** attempt
      process.stderr.write(`  retry ${attempt + 1} in ${backoff}ms: ${err}\n`)
      await new Promise((r) => setTimeout(r, backoff))
    }
  }
}

// --- phase 1: discover church ids over the grid ------------------------------
async function discover() {
  const points = []
  for (let lat = LAT_MIN; lat <= LAT_MAX + 1e-9; lat += LAT_STEP)
    for (let lng = LNG_MIN; lng <= LNG_MAX + 1e-9; lng += LNG_STEP)
      points.push([+lat.toFixed(4), +lng.toFixed(4)])
  let done = 0
  for (const [lat, lng] of points) {
    const file = `${CACHE}/grid/${lat}_${lng}.json`
    done++
    if (existsSync(file)) continue
    const body = new URLSearchParams({ 'institutionTypes[]': '1', latitude: String(lat), longitude: String(lng), zoom: '15' })
    const text = await fetchPolite(`${BASE}allData`, { method: 'POST', body })
    JSON.parse(text) // validate before caching
    writeFileSync(file, text)
    if (done % 50 === 0) process.stderr.write(`  grid ${done}/${points.length}\n`)
  }
  process.stderr.write(`discover: ${points.length} grid points cached\n`)
}

function collectIds() {
  const ids = new Set()
  for (const f of readdirSync(`${CACHE}/grid`)) {
    const j = JSON.parse(readFileSync(`${CACHE}/grid/${f}`, 'utf8'))
    for (const key of Object.keys(j)) {
      if (!Array.isArray(j[key])) continue
      for (const item of j[key]) if (item.id) ids.add(String(item.id))
    }
  }
  return [...ids].sort((a, b) => Number(a) - Number(b))
}

// --- phase 2: per-church detail ----------------------------------------------
async function details(ids) {
  let done = 0
  for (const id of ids) {
    const file = `${CACHE}/detail/${id}.json`
    done++
    if (existsSync(file)) continue
    const text = await fetchPolite(`${BASE}detail?id=${id}`)
    JSON.parse(text)
    writeFileSync(file, text)
    if (done % 200 === 0) process.stderr.write(`  detail ${done}/${ids.length}\n`)
  }
  process.stderr.write(`details: ${ids.length} churches cached\n`)
}

// --- phase 3: transform -------------------------------------------------------
// Index row (churches.json): [id, name, city, lat, lng, barrierFree, cell]
// Shard (services/<cell>.json): { [id]: { u, p, pa, c: [[type,value]...],
//   s: [[days, "HH:MM", lang, greek, type, note]...],
//   x: [["YYYY-MM-DD", "HH:MM", lang, greek, type, note]...] } }
// Compact keys keep the committed dataset small (<30MB budget).
const cellOf = (lat, lng) => `${Math.floor(lat)}-${Math.floor(lng)}`

function svcRow(r) {
  return [
    r.periodic_days ?? '',
    r.cas ?? '',
    r.chsl_name ?? '',
    r.greek === '1' ? 1 : 0,
    r.chst_name ?? '',
    r.note ?? '',
  ]
}

function transform() {
  // coordinates come from the grid responses (zoom 15 → real lat/lng per church)
  const coords = new Map()
  for (const f of readdirSync(`${CACHE}/grid`)) {
    const j = JSON.parse(readFileSync(`${CACHE}/grid/${f}`, 'utf8'))
    for (const key of Object.keys(j)) {
      if (!Array.isArray(j[key])) continue
      for (const it of j[key]) {
        const lat = parseFloat(it.latitude), lng = parseFloat(it.longitude)
        if (it.id && lat && lng) coords.set(String(it.id), [lat, lng])
      }
    }
  }

  const index = []
  const shards = {}
  let withServices = 0
  let serviceCount = 0
  for (const f of readdirSync(`${CACHE}/detail`)) {
    const d = JSON.parse(readFileSync(`${CACHE}/detail/${f}`, 'utf8'))
    const id = String(d.id)
    const inst = d.institution ?? {}
    const fromGrid = coords.get(id)
    const lat = +(fromGrid?.[0] ?? parseFloat(inst.latitude) ?? 0).toFixed(5)
    const lng = +(fromGrid?.[1] ?? parseFloat(inst.longitude) ?? 0).toFixed(5)
    if (!lat || !lng) continue // unplaceable → useless for "near me"
    const regular = (d.regular ?? []).filter((r) => r.cas)
    const extra = (d.extra ?? []).filter((r) => r.cas && r.datum)
    if (regular.length + extra.length === 0) continue // no services → not shown
    withServices++
    serviceCount += regular.length + extra.length
    const name = inst.institution_name ?? inst.name ?? ''
    const city = inst.city ?? ''
    const cell = cellOf(lat, lng)
    index.push([id, name, city, lat, lng, inst.barrier_free === '1' ? 1 : 0, cell])
    const entry = {
      u: (inst.updated_at ?? '').slice(0, 10), // source "aktualizace" date
      p: inst.institution_parish_name ?? '',
      pa: inst.institution_parish_address ?? '',
      // parish-level contacts only; named persons are deliberately not published
      c: (d.contacts ?? []).filter((c) => c.type && c.contact).map((c) => [c.type, c.contact]),
      s: regular.map(svcRow),
    }
    if (extra.length) entry.x = extra.map((r) => [r.datum.slice(0, 10), ...svcRow(r).slice(1)])
    ;(shards[cell] ??= {})[id] = entry
  }

  index.sort((a, b) => Number(a[0]) - Number(b[0]))
  writeFileSync(`${OUT}/churches.json`, JSON.stringify(index))
  let total = statSync(`${OUT}/churches.json`).size
  for (const [cell, data] of Object.entries(shards)) {
    const p = `${OUT}/services/${cell}.json`
    writeFileSync(p, JSON.stringify(data))
    total += statSync(p).size
  }
  console.log(
    `transform: ${index.length} churches with services (${withServices} of ${readdirSync(`${CACHE}/detail`).length} fetched), ` +
      `${serviceCount} services, ${Object.keys(shards).length} shards, ${(total / 1024 / 1024).toFixed(1)} MB total`,
  )
}

// --- main ----------------------------------------------------------------------
const mode = process.argv[2] ?? 'all'
if (mode === 'all') {
  await discover()
  const ids = collectIds()
  process.stderr.write(`discovered ${ids.length} unique church ids\n`)
  await details(ids)
  transform()
} else if (mode === 'transform') {
  transform()
} else {
  console.error('usage: node data/extract.mjs [transform]')
  process.exit(1)
}

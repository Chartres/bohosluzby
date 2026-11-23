// The site list for a data pass (docs/VANOCE-PASS.md): the largest towns by church count,
// one entry per parish website with the churches it covers. Sites that block automated reads
// (data/pass-blocked.json, from the passes) are listed apart and never queued: no workarounds.
//   node --experimental-strip-types data/pass-sites.mjs [--towns 30] [--mark rorát|půlnoční] > sites.json
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aggregateCities } from '../src/domain/cities.ts'

const HERE = `${dirname(fileURLToPath(import.meta.url))}/`
const norm = (u) => (u ?? '').trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase()

/** index: churches.json rows as objects; shards: {cell: {id: entry}}; blocked: [{site, reason}]. */
export function passSites({ index, shards, towns = 30, blocked = [], mark = /rorát/i }) {
  const walls = new Map(blocked.map((b) => [norm(b.site), b]))
  return aggregateCities(index)
    .slice(0, towns)
    .map((city, i) => {
      const sites = new Map()
      const blockedHere = new Map()
      for (const c of city.churches) {
        const full = index.find((r) => r.id === c.id)
        const e = shards[full.cell]?.[c.id]
        const site = full.www || `(no web) ${e?.p ?? c.id}`
        const wall = full.www && walls.get(norm(full.www))
        if (wall) {
          const b = blockedHere.get(site) ?? { site, reason: wall.reason, churches: [] }
          b.churches.push(c.id)
          blockedHere.set(site, b)
          continue
        }
        const s = sites.get(site) ?? { site, parish: e?.p ?? '', marked: false, churches: [] }
        s.churches.push({ id: c.id, name: full.name })
        if (e?.s?.some((r) => mark.test(`${r[4]} ${r[5]}`))) s.marked = true
        sites.set(site, s)
      }
      // registry-marked first, then those with a website, then the rest
      const list = [...sites.values()].sort((a, b) => b.marked - a.marked || a.site.startsWith('(no web)') - b.site.startsWith('(no web)'))
      return { rank: i + 1, town: city.name, slug: city.slug, sites: list, blocked: [...blockedHere.values()] }
    })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
  const index = JSON.parse(readFileSync(`${HERE}../public/data/churches.json`, 'utf8')).map(([id, name, city, lat, lng, , cell, www]) => ({ id, name, city, lat, lng, cell, www: www || undefined }))
  const shards = {}
  for (const cell of new Set(index.map((c) => c.cell))) shards[cell] = JSON.parse(readFileSync(`${HERE}../public/data/services/${cell}.json`, 'utf8'))
  const blocked = JSON.parse(readFileSync(`${HERE}pass-blocked.json`, 'utf8')).sites
  const out = passSites({ index, shards, towns: Number(arg('--towns', 30)), blocked, mark: new RegExp(arg('--mark', 'rorát'), 'i') })
  console.log(JSON.stringify(out, null, 1))
  const n = out.reduce((a, t) => a + t.sites.length, 0)
  const b = out.reduce((a, t) => a + t.blocked.length, 0)
  console.error(`${out.length} towns, ${n} sites to read, ${b} known bot walls left out`)
}

// Hand corrections on top of the registry, each with its source (data/corrections.json).
// The registry is the parishes' own word but often years old; for a feast weekend
// a parish's current announcement (ohlášky, bulletin, diocese listing) beats it.
// A correction only ever ADDS dated one-offs (shard `x` rows) — a Mass the
// parish announces that the registry lacks. It never deletes a registry row.
// Applied by data/extract.mjs at transform (so a refresh keeps them) and
// runnable alone on the committed shards: node data/corrections.mjs
// Corrections for dates that have passed are dropped from the output by themselves.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// not new URL('.', import.meta.url): Vite (vitest) rewrites that pattern as an asset URL
const HERE = `${dirname(fileURLToPath(import.meta.url))}/`

export function loadCorrections(file = `${HERE}corrections.json`) {
  return JSON.parse(readFileSync(file, 'utf8')).corrections
}

const sameRow = (a, b) => a[0] === b[0] && a[1] === b[1] && a[4] === b[4]

/** Apply `corrections` to `shards` ({cell: {id: entry}}) in place; returns what changed. */
export function applyCorrections(shards, corrections, today = new Date().toISOString().slice(0, 10)) {
  const where = new Map()
  for (const [cell, data] of Object.entries(shards)) for (const id of Object.keys(data)) where.set(id, cell)
  const applied = []
  const missing = []
  for (const c of corrections) {
    if (c.date < today) continue
    const cell = where.get(c.id)
    if (!cell) {
      missing.push(c.id)
      continue
    }
    const entry = shards[cell][c.id]
    for (const [time, type, note = ''] of c.add ?? []) {
      const row = [c.date, time, 'česky', 0, type, note]
      entry.x ??= []
      if (entry.x.some((r) => sameRow(r, row))) continue
      entry.x.push(row)
      entry.x.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]))
      applied.push(`${c.id} ${c.date} +${time}`)
    }
  }
  return { applied, missing }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = `${HERE}../public/data/services`
  const shards = {}
  for (const f of readdirSync(dir)) if (f.endsWith('.json')) shards[f.slice(0, -5)] = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
  const before = Object.fromEntries(Object.entries(shards).map(([cell, data]) => [cell, JSON.stringify(data)]))
  const { applied, missing } = applyCorrections(shards, loadCorrections())
  if (missing.length) console.error(`corrections: ${missing.length} church id(s) not in the dataset: ${missing.join(', ')}`)
  for (const [cell, data] of Object.entries(shards)) {
    const text = JSON.stringify(data)
    if (text !== before[cell]) writeFileSync(`${dir}/${cell}.json`, text)
  }
  console.log(`corrections: ${applied.length} row(s) added${applied.length ? ': ' + applied.join('; ') : ''}`)
}

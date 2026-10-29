// Hand corrections on top of the registry, each with its source (data/corrections.json).
// The registry is the parishes' own word but often years old; for a feast weekend
// a parish's current announcement (ohlášky, bulletin, diocese listing) beats it.
// Per church and date a correction can
//   add:  ["HH:MM", type, note?, lang?] — a Mass the parish announces that the registry
//         lacks, written as a dated one-off (shard `x` row, shown as "mimořádná");
//   drop: ["HH:MM"] — a registry Mass the parish says doesn't take place that day.
//         The weekly row stays; its note gains "kromě D. M. YYYY", which
//         parseNote (src/domain/notes.ts) reads as that one date excluded, so the
//         list, detail, feast pages and .ics all skip it. A one-off dated that
//         day is removed instead.
// Applied by data/extract.mjs at transform (so a registry refresh keeps them)
// and runnable alone on the committed shards: node data/corrections.mjs
// Corrections for past dates are skipped; their source stays in the log.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// not new URL('.', import.meta.url): Vite (vitest) rewrites that pattern as an asset URL
const HERE = `${dirname(fileURLToPath(import.meta.url))}/`

export function loadCorrections(file = `${HERE}corrections.json`) {
  return JSON.parse(readFileSync(file, 'utf8')).corrections
}

const toMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  return m ? +m[1] * 60 + +m[2] : -1
}
const CONFESSION = /zpov/i

/** "2026-11-02" → "kromě 2. 11. 2026" */
export function exceptDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `kromě ${d}. ${m}. ${y}`
}

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
      missing.push(`${c.id} (not in the dataset)`)
      continue
    }
    const entry = shards[cell][c.id]
    const [y, m, d] = c.date.split('-').map(Number)
    const dow = String(new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7)
    for (const time of c.drop ?? []) {
      const at = toMin(time)
      const before = entry.x?.length ?? 0
      if (entry.x) entry.x = entry.x.filter((r) => !(r[0] === c.date && toMin(r[1]) === at && !CONFESSION.test(r[4])))
      let hit = (entry.x?.length ?? 0) < before
      if (entry.x && !entry.x.length) delete entry.x
      const ex = exceptDate(c.date)
      for (const r of entry.s) {
        if (!r[0].includes(dow) || toMin(r[1]) !== at || CONFESSION.test(r[4])) continue
        hit = true
        if (r[5].includes(ex)) continue
        const note = r[5].trim().replace(/\.$/, '')
        r[5] = note ? `${note}, ${ex}` : ex
      }
      if (hit) applied.push(`${c.id} ${c.date} -${time}`)
      else missing.push(`${c.id} ${c.date} -${time} (no such row)`)
    }
    for (const [time, type, note = '', lang = 'česky'] of c.add ?? []) {
      const row = [c.date, time, lang, 0, type, note]
      entry.x ??= []
      if (entry.x.some((r) => r[0] === c.date && toMin(r[1]) === toMin(time) && r[4] === type)) continue
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
  if (missing.length) console.error(`corrections: not applied: ${missing.join('; ')}`)
  for (const [cell, data] of Object.entries(shards)) {
    const text = JSON.stringify(data)
    if (text !== before[cell]) writeFileSync(`${dir}/${cell}.json`, text)
  }
  console.log(`corrections: ${applied.length} change(s)${applied.length ? ': ' + applied.join('; ') : ''}`)
}

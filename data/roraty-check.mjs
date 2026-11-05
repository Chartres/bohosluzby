// Roráty pass (docs/RORATY-PASS.md): check a batch of records before it joins
// data/corrections.json, and print the rows the town pages will show for it.
//   node --experimental-strip-types data/roraty-check.mjs batch.json [--today YYYY-MM-DD]
// A batch is a JSON array of correction records (range form: from/to/days/except,
// see data/corrections.mjs). Exit 1 with the reasons when anything is off.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCorrections, expandCorrections } from './corrections.mjs'
import { adventOf, seasonCityPage } from '../src/domain/season.ts'

const HERE = `${dirname(fileURLToPath(import.meta.url))}/`
const strip = (s) => s.replace(/<[^>]+>/g, '').replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>')

/**
 * records: the batch; shards: {cell: {id: entry}} (copied, not changed);
 * names: {id: {name, town}}; today: "YYYY-MM-DD" (Prague).
 */
export function checkRoraty({ records, shards, names, today }) {
  const errors = []
  const rows = []
  const advent = adventOf(today)
  const work = structuredClone(shards)
  const where = new Map()
  for (const [cell, data] of Object.entries(work)) for (const id of Object.keys(data)) where.set(id, cell)

  for (const r of records) {
    const who = `${r.id} ${r.church ?? ''}`.trim()
    if (!/^https?:\/\//.test(r.source ?? '')) errors.push(`${who}: needs a source (http(s) link to the notice)`)
    if (!r.source_date?.trim()) errors.push(`${who}: needs source_date (the notice's own date)`)
    if (!r.quote?.trim()) errors.push(`${who}: needs a quote from the notice`)
    if (!where.has(r.id)) {
      errors.push(`${who}: ${r.id} is not in the dataset`)
      continue
    }
    let dated
    try {
      dated = expandCorrections([r])
    } catch (e) {
      errors.push(e.message)
      continue
    }
    const out = dated.filter((c) => c.date < advent.start || c.date > advent.end)
    if (out.length) errors.push(`${who}: ${out.length} date(s) outside Advent ${advent.start} – ${advent.end} (${out[0].date}…)`)
    applyCorrections(work, dated, today)

    // the real page for this one church: does the record show, and how?
    const n = names[r.id] ?? { name: r.church ?? r.id, town: r.town ?? '' }
    const city = { name: n.town, slug: 'check', churches: [{ id: r.id, name: n.name, city: n.town }] }
    const page = seasonCityPage({ kind: 'advent', city, entries: { [r.id]: work[where.get(r.id)][r.id] }, corrections: dated, today })
    for (const [time] of r.add ?? []) {
      const t = time.padStart(5, '0')
      const li = [...page.body.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]).find((h) => h.includes(`<span class="t">${t}</span>`) && h.includes(`href="${r.source}"`))
      if (!li) {
        errors.push(`${who}: ${t} is not on the roráty page (does the type or note say "roráty"?)`)
        continue
      }
      const when = strip(/<span class="d">(.*?)<\/span>/.exec(li)?.[1] ?? '').split(' · ')[0]
      rows.push(`${n.town} · ${t} ${n.name} — ${when} — ${r.source_date} <${r.source}>`)
    }
  }
  return { errors, rows }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const file = args.find((a) => !a.startsWith('--') && !/^\d{4}-/.test(a))
  const ti = args.indexOf('--today')
  const today = ti >= 0 ? args[ti + 1] : new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' })
  if (!file) {
    console.error('usage: node --experimental-strip-types data/roraty-check.mjs batch.json [--today YYYY-MM-DD]')
    process.exit(2)
  }
  const dir = `${HERE}../public/data/services`
  const shards = {}
  for (const f of readdirSync(dir)) if (f.endsWith('.json')) shards[f.slice(0, -5)] = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
  const names = {}
  for (const [id, name, town] of JSON.parse(readFileSync(`${HERE}../public/data/churches.json`, 'utf8'))) names[id] = { name, town }
  const { errors, rows } = checkRoraty({ records: JSON.parse(readFileSync(file, 'utf8')), shards, names, today })
  for (const r of rows) console.log(r)
  if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join('\n'))
    process.exit(1)
  }
  console.log(`✓ ${rows.length} row(s), no errors`)
}

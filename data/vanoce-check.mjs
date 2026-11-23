// Christmas pass (docs/VANOCE-PASS.md): check a batch of records before it joins
// data/corrections.json, and print the rows the /vanoce/ town pages will show for it.
//   node --experimental-strip-types data/vanoce-check.mjs batch.json [--today YYYY-MM-DD]
// A record is one church on one day: {id, church, town, date, add: [[HH:MM, type, note]],
// source, source_date, quote, checked}. Exit 1 with the reasons when anything is off.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCorrections } from './corrections.mjs'
import { christmasOf, seasonSections } from '../src/domain/season.ts'

const HERE = `${dirname(fileURLToPath(import.meta.url))}/`
/** Words that name a Christmas Mass. The note of every add carries one, so the /vanoce/ page,
 * its calendar events and the Vánoce pill (data/views-drafts/vanoce.json) pick the row up. */
export const VANOCE_WORDS = ['půlnoční', 'štědrovečer', 'vigili', 'narození páně', 'štěpán', 'jitřní', 'pastýřsk']
const namesMass = (note) => VANOCE_WORDS.some((w) => (note ?? '').toLowerCase().includes(w))
const toMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  return m ? +m[1] * 60 + +m[2] : -1
}

/** records: the batch; shards: {cell: {id: entry}} (copied, not changed); names: {id: {name, town}}. */
export function checkVanoce({ records, shards, names, today }) {
  const errors = []
  const rows = []
  const year = christmasOf(today)
  const days = [`${year}-12-24`, `${year}-12-25`, `${year}-12-26`]
  const work = structuredClone(shards)
  const where = new Map()
  for (const [cell, data] of Object.entries(work)) for (const id of Object.keys(data)) where.set(id, cell)

  for (const r of records) {
    const who = `${r.id} ${r.church ?? ''}`.trim()
    if (!/^https?:\/\//.test(r.source ?? '')) errors.push(`${who}: needs a source (http(s) link to the notice)`)
    if (!r.source_date?.trim()) errors.push(`${who}: needs source_date (the notice's own date)`)
    if (!r.quote?.trim()) errors.push(`${who}: needs a quote from the notice`)
    if (!r.date || r.from || r.to || r.days || r.dates) {
      errors.push(`${who}: one date per record (ranges are for roráty)`)
      continue
    }
    if (!days.includes(r.date)) {
      errors.push(`${who}: ${r.date} is not 24. – 26. 12. ${year}`)
      continue
    }
    if (!where.has(r.id)) {
      errors.push(`${who}: ${r.id} is not in the dataset`)
      continue
    }
    let ok = true
    for (const [time] of r.add ?? []) {
      const min = toMin(time ?? '')
      if (min < 0 || min > 24 * 60) {
        errors.push(`${who}: time "${time}" must be HH:MM`)
        ok = false
      } else if (min === 0) {
        errors.push(`${who}: midnight is written 24:00 on 24 Dec, never 00:00`)
        ok = false
      } else if (!namesMass(r.add.find((a) => a[0] === time)?.[2])) {
        errors.push(`${who}: the note (third field of add) names the Mass: ${VANOCE_WORDS.join(', ')}`)
        ok = false
      } else if (r.date === days[0] && min < 15 * 60) {
        errors.push(`${who}: ${time} on 24 Dec is before 15:00 (still Advent; the page starts at 15:00)`)
        ok = false
      }
    }
    if (!ok || !(r.add ?? []).length) {
      if (!(r.add ?? []).length) errors.push(`${who}: add is empty`)
      continue
    }
    applyCorrections(work, [r], today)

    // the real page sections for this one church: does the record show, and how?
    const n = names[r.id] ?? { name: r.church ?? r.id, town: r.town ?? '' }
    const city = { name: n.town, slug: 'check', churches: [{ id: r.id, name: n.name, city: n.town }] }
    const sections = seasonSections({ kind: 'vanoce', city, entries: { [r.id]: work[where.get(r.id)][r.id] }, corrections: [r], today })
    const sec = sections.find((s) => s.date === r.date)
    for (const [time] of r.add) {
      const t = time.padStart(5, '0')
      const row = sec?.rows.find((x) => x.time === t && x.source.from === 'farnost' && x.source.url === r.source)
      if (!row) {
        errors.push(`${who}: ${t} on ${r.date} is not on the /vanoce/ page`)
        continue
      }
      const [, m, d] = r.date.split('-').map(Number)
      rows.push(`${n.town} · ${d}. ${m}. ${t} ${n.name} — ${[row.type !== 'mše sv.' ? row.type : '', row.note].filter(Boolean).join(', ') || 'mše sv.'} — ${r.source_date} <${r.source}>`)
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
    console.error('usage: node --experimental-strip-types data/vanoce-check.mjs batch.json [--today YYYY-MM-DD]')
    process.exit(2)
  }
  const dir = `${HERE}../public/data/services`
  const shards = {}
  for (const f of readdirSync(dir)) if (f.endsWith('.json')) shards[f.slice(0, -5)] = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
  const names = {}
  for (const [id, name, town] of JSON.parse(readFileSync(`${HERE}../public/data/churches.json`, 'utf8'))) names[id] = { name, town }
  const { errors, rows } = checkVanoce({ records: JSON.parse(readFileSync(file, 'utf8')), shards, names, today })
  for (const r of rows) console.log(r)
  if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join('\n'))
    process.exit(1)
  }
  console.log(`✓ ${rows.length} row(s), no errors`)
}

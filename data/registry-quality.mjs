// Registry data-quality report for ČBK (evolve pick #6, "data-quality partner").
// Reads only what the app already publishes (public/data) plus the dead-link
// report, and writes:
//   docs/registry-quality.md         — the summary a diocese/ČBK person reads
//   docs/registry-quality-stale.csv  — one row per stale church, to act on
// Usage: node data/registry-quality.mjs [--now YYYY-MM-DD]
// Pure core (`qualityReport`) is tested in registry-quality.test.mjs.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const STALE_MONTHS = 18 // the app's own verify-before-you-go threshold (src/domain/registry.ts)
const VAGUE = /nepravideln|dle ohl|podle ohl|viz web/i

export function qualityReport(index, shards, now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - STALE_MONTHS)
  const stale = []
  const duplicates = []
  const vague = []
  const byYear = {}
  for (const [id, name, city] of index) {
    const e = shards[id]
    if (!e) continue
    const year = (e.u || '????').slice(0, 4)
    byYear[year] = (byYear[year] ?? 0) + 1
    if (e.u && new Date(e.u) < cutoff) stale.push({ id, name, city, parish: e.p || '', updated: e.u })
    const seen = new Set()
    for (const [days, time, , , type, note] of e.s) {
      const k = `${days}|${time}|${type}`
      if (seen.has(k)) duplicates.push({ id, name, city, slot: `${days} ${time} ${type}`.trim() })
      seen.add(k)
      if (VAGUE.test(note)) vague.push({ id, name, city, note })
    }
  }
  stale.sort((a, b) => a.updated.localeCompare(b.updated))
  const byParish = {}
  for (const s of stale) if (s.parish) byParish[s.parish] = (byParish[s.parish] ?? 0) + 1
  const parishes = Object.entries(byParish)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'cs'))
    .map(([parish, churches]) => ({ parish, churches }))
  return { total: index.length, stale, duplicates, vague, byYear, parishes, cutoff: cutoff.toISOString().slice(0, 10) }
}

const pct = (n, d) => `${Math.round((100 * n) / d)} %`
const csvCell = (s) => `"${String(s).replaceAll('"', '""')}"`

export function toMarkdown(r, deadLinks, asOf) {
  const old = Object.entries(r.byYear).filter(([y]) => y < '2020').reduce((s, [, n]) => s + n, 0)
  return `# Kvalita dat v rejstříku bohoslužeb — přehled pro ČBK

Stav k ${asOf}. Zdroj: veřejný rejstřík bohosluzby.cirkev.cz, jak jej zobrazuje
[Kam na mši](https://bohosluzby.dravec.org). Počítáno skriptem \`data/registry-quality.mjs\`.

Datum aktualizace říká, kdy farnost záznam naposledy změnila — ne že jsou časy chybné.
Starý záznam může být správný; jen ho nikdo dlouho nepotvrdil, a aplikace proto
u něj zobrazuje výzvu „ověřte si u farnosti“.

| Ukazatel | Počet | Podíl |
| --- | --- | --- |
| Kostely s pořadem bohoslužeb | ${r.total} | 100 % |
| Pořad neaktualizovaný déle než ${STALE_MONTHS} měsíců (před ${r.cutoff}) | ${r.stale.length} | ${pct(r.stale.length, r.total)} |
| — z toho naposledy před rokem 2020 | ${old} | ${pct(old, r.total)} |
| Dvakrát zapsaný stejný termín (kostel · den · čas · typ) | ${r.duplicates.length} | — |
| Poznámka „nepravidelně / dle ohlášek / viz web“ | ${r.vague.length} | — |
| Nefunkční web farnosti (3 pokusy, DNS nebo 404) | ${deadLinks} | — |

## Rok poslední aktualizace

${Object.entries(r.byYear).sort().map(([y, n]) => `${y}: ${n}`).join(' · ')}

## Farnosti s nejvíce neaktuálními kostely

| Farnost | Kostelů s pořadem starším ${STALE_MONTHS} měsíců |
| --- | --- |
${r.parishes.slice(0, 30).map((p) => `| ${p.parish} | ${p.churches} |`).join('\n')}

Úplný seznam (kostel, obec, farnost, datum poslední aktualizace, odkaz) je v
\`docs/registry-quality-stale.csv\`.

## Duplicitní termíny (prvních 30)

${r.duplicates.slice(0, 30).map((d) => `- ${d.name} (${d.city}): ${d.slot}`).join('\n')}
`
}

export function toCsv(r) {
  const rows = r.stale.map((s) =>
    [s.id, s.name, s.city, s.parish, s.updated, `https://bohosluzby.dravec.org/kostel/${s.id}/`].map(csvCell).join(','),
  )
  return ['id,kostel,obec,farnost,posledni_aktualizace,odkaz', ...rows].join('\n') + '\n'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const i = process.argv.indexOf('--now')
  const now = i === -1 ? new Date() : new Date(process.argv[i + 1])
  const index = JSON.parse(readFileSync(`${root}public/data/churches.json`, 'utf8'))
  const shards = {}
  for (const f of readdirSync(`${root}public/data/services`))
    Object.assign(shards, JSON.parse(readFileSync(`${root}public/data/services/${f}`, 'utf8')))
  let dead = 0
  try {
    dead = Number(/Dropped[^:]*: (\d+)/.exec(readFileSync(`${root}docs/linkcheck-report.md`, 'utf8'))?.[1] ?? 0)
  } catch {
    // no link report yet
  }
  const r = qualityReport(index, shards, now)
  writeFileSync(`${root}docs/registry-quality.md`, toMarkdown(r, dead, now.toISOString().slice(0, 10)))
  writeFileSync(`${root}docs/registry-quality-stale.csv`, toCsv(r))
  console.log(`registry quality: ${r.stale.length}/${r.total} stale, ${r.duplicates.length} duplicate slots, ${dead} dead links`)
}

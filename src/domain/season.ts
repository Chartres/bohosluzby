// Advent (roráty) and Christmas (půlnoční) — static town pages in the shape of
// the Dušičky ones (feast.ts): /advent/<town>/ and /vanoce/<town>/, the list IS
// the page, no script. DRAFT: the plan and the data passes are docs/SEASON-PAGES.md.
//
// Unlike Dušičky, the registry can't fill these by itself: only ~30 rows name
// roráty, and nobody enters 24 Dec one-offs ahead. A weekly Thursday row says
// nothing about Christmas Eve, so it isn't listed. Listed is what is seasonal:
//   advent — roráty rows (type or note says "rorát") that run in Advent, and
//            roráty one-offs dated in Advent;
//   vanoce — rows dated 24 Dec (from the afternoon), 25 and 26 Dec.
// One-offs come from the parishes' entries or from data/corrections.json, which
// the data passes fill from the parishes' own notices. Every row says which.
// Node imports this via type stripping: explicit .ts specifiers.
import type { RawEntry } from './churchPage.ts'
import { parseNote } from './notes.ts'
import { isConfession, normalizeLang } from './registry.ts'
import { churchUrl, SITE_ORIGIN } from './site.ts'

export type SeasonKind = 'advent' | 'vanoce'

/** The parts of a data/corrections.json entry the pages read. */
export interface SeasonCorrection {
  id: string
  date: string
  add?: (string | undefined)[][]
  source: string
  source_date: string
}

export interface SeasonPage {
  url: string
  title: string
  description: string
  /** Safe HTML. */
  body: string
  /** JSON for a <script type="application/ld+json">, safe to inline. */
  jsonLd: string
}

const DAY_MS = 86_400_000
const WEEKDAY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'] // getUTCDay order
const WD_SHORT = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so']
const REG_SHORT: Record<string, string> = { '1': 'po', '2': 'út', '3': 'st', '4': 'čt', '5': 'pá', '6': 'so', '7': 'ne' }

const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const ldSafe = (o: unknown) => JSON.stringify(o).replaceAll('<', '\\u003c')
const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)
const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  return m ? +m[1] * 60 + +m[2] : 0
}
const hhmm = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t.trim()
}
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const utc = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
/** "2016-09-06" → "6. 9. 2016" */
const dateCz = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : ''
}
/** "2026-12-05" → "so 5. 12." */
const dayShort = (s: string) => {
  const t = utc(s)
  const d = new Date(t)
  return `${WD_SHORT[d.getUTCDay()]} ${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`
}
const typeLabel = (type: string) => (!type || /^mše sv\.?$/i.test(type) ? 'mše svatá' : type.trim())
const RORATE = /rorát/i

/** The Advent that `today` ("YYYY-MM-DD", Prague) is in or before: its 1st Sunday to 24 Dec. */
export function adventOf(today: string): { year: number; start: string; end: string } {
  const ty = Number(today.slice(0, 4))
  const year = today > `${ty}-12-24` ? ty + 1 : ty
  const xmas = Date.UTC(year, 11, 25)
  const dow = new Date(xmas).getUTCDay() || 7
  return { year, start: iso(xmas - (dow + 21) * DAY_MS), end: `${year}-12-24` }
}

/** The Christmas that `today` is in or before (pages stay up through 26 Dec). */
function christmasOf(today: string): number {
  const ty = Number(today.slice(0, 4))
  return today > `${ty}-12-26` ? ty + 1 : ty
}

/** "12345" → "po–pá", "123456" → "po–so", else "st, pá". */
function regDays(days: string): string {
  if (days === '12345') return 'po–pá'
  if (days === '123456') return 'po–so'
  return [...days].map((d) => REG_SHORT[d] ?? d).join(', ')
}

interface Row {
  churchId: string
  time: string
  /** "po–pá" / "so 5. 12." / "" */
  when: string
  type: string
  lang: string
  greek: boolean
  note: string
  source: string // safe HTML
}

function sourceHtml(c: SeasonCorrection | undefined, entry: RawEntry): string {
  if (c && /^https?:\/\//i.test(c.source)) return `<a href="${esc(c.source)}">ohlášky farnosti</a> (${esc(c.source_date)})`
  if (c) return `ohlášky farnosti (${esc(c.source_date)})`
  return entry.u ? `rejstřík ČBK, ověřen ${esc(dateCz(entry.u))}` : 'rejstřík ČBK'
}

function correctionFor(corrections: SeasonCorrection[], id: string, date: string, time: string): SeasonCorrection | undefined {
  return corrections.find((c) => c.id === id && c.date === date && (c.add ?? []).some((a) => hhmm(a[0] ?? '') === hhmm(time)))
}

/** Roráty for one church in one Advent: weekly rows that run in it, plus dated ones. */
function rorateRows(id: string, entry: RawEntry, advent: { start: string; end: string }, corrections: SeasonCorrection[]): Row[] {
  const days: string[] = []
  for (let t = utc(advent.start); t <= utc(advent.end); t += DAY_MS) days.push(iso(t))
  const out: Row[] = []
  for (const r of entry.s) {
    if (!RORATE.test(`${r[4]} ${r[5]}`) || isConfession(r[4])) continue
    // "v adventu 2019": the parish wrote it for a past Advent
    if ([...r[5].matchAll(/\b(20\d\d)\b/g)].some((m) => Number(m[1]) < Number(advent.end.slice(0, 4)))) continue
    // a year-round "rorátní" row that never says Advent is a registry label, not roráty
    if (!/advent/i.test(`${r[4]} ${r[5]}`)) continue
    const rule = parseNote(r[5])
    // no roráty on an Advent Sunday: a Sunday row is the ordinary Sunday Mass
    const on = [...r[0]].filter((wd) => wd !== '7').filter((wd) =>
      days.some((d) => {
        const [y, m, dd] = d.split('-').map(Number)
        return String(new Date(utc(d)).getUTCDay() || 7) === wd && rule.runsOn(y, m, dd)
      }),
    )
    if (!on.length) continue
    // "v adventu od 7:00 hodin roráty": the note gives the roráty time, the row the weekly one
    const own = /(?:od|v)\s+(\d{1,2})[:.](\d{2})\s*(?:hod\S*\s+)?roráty/i.exec(r[5])
    out.push({ churchId: id, time: own ? `${own[1].padStart(2, '0')}:${own[2]}` : hhmm(r[1]), when: regDays(on.join('')), type: r[4], lang: normalizeLang(r[2]), greek: r[3] === 1, note: r[5].trim(), source: sourceHtml(undefined, entry) })
  }
  // dated roráty: one notice gives ~20 dates for a church; the same time, kind and
  // source make one row ("po–pá 30. 11. – 23. 12., kromě 8. 12."), not twenty
  const groups = new Map<string, { row: Row; dates: string[] }>()
  for (const r of entry.x ?? []) {
    if (r[0] < advent.start || r[0] > advent.end || !RORATE.test(`${r[4]} ${r[5]}`)) continue
    const row: Row = { churchId: id, time: hhmm(r[1]), when: '', type: r[4], lang: normalizeLang(r[2]), greek: r[3] === 1, note: r[5].trim(), source: sourceHtml(correctionFor(corrections, id, r[0], r[1]), entry) }
    const key = JSON.stringify([row.time, row.type, row.lang, row.greek, row.note, row.source])
    const g = groups.get(key) ?? { row, dates: [] }
    g.dates.push(r[0])
    groups.set(key, g)
  }
  for (const { row, dates } of groups.values()) out.push({ ...row, when: datesSpan(dates) })
  return out
}

/** "so 5. 12." for one date; "po–pá 30. 11. – 23. 12., kromě 8. 12." for a run. */
function datesSpan(dates: string[]): string {
  const ds = [...new Set(dates)].sort()
  if (ds.length === 1) return dayShort(ds[0])
  const wd = (d: string) => String(new Date(utc(d)).getUTCDay() || 7)
  const days = [...new Set(ds.map(wd))].sort().join('')
  const dm = (d: string) => `${Number(d.slice(8, 10))}. ${Number(d.slice(5, 7))}.`
  const missing: string[] = []
  for (let t = utc(ds[0]); t <= utc(ds[ds.length - 1]); t += DAY_MS) {
    const d = iso(t)
    if (days.includes(wd(d)) && !ds.includes(d)) missing.push(dm(d))
  }
  return `${regDays(days)} ${dm(ds[0])} – ${dm(ds[ds.length - 1])}` + (missing.length ? `, kromě ${missing.join(', ')}` : '')
}

/** One church's rows dated `date` (Christmas), from `fromMin` on. */
function datedRows(id: string, entry: RawEntry, date: string, fromMin: number, corrections: SeasonCorrection[]): Row[] {
  return (entry.x ?? [])
    .filter((r) => r[0] === date && !isConfession(r[4]) && toMin(r[1]) >= fromMin)
    .map((r) => ({
      churchId: id,
      time: hhmm(r[1]),
      when: '',
      type: r[4],
      lang: normalizeLang(r[2]),
      greek: r[3] === 1,
      note: r[5].trim(),
      source: sourceHtml(correctionFor(corrections, id, date, r[1]), entry),
    }))
}

interface City {
  name: string
  slug: string
  churches: { id: string; name: string; city: string }[]
  label?: string
}

function rowsHtml(rows: Row[], city: City, names: Map<string, { name: string; city: string }>): string {
  const quarter = (c: { name: string; city: string }) => {
    const q = c.city.includes(',') ? c.city.slice(0, c.city.lastIndexOf(',')).trim() : c.city.trim()
    return q && q !== city.name && !c.name.includes(q) ? q : ''
  }
  const sorted = [...rows].sort(
    (a, b) => toMin(a.time) - toMin(b.time) || names.get(a.churchId)!.name.localeCompare(names.get(b.churchId)!.name, 'cs'),
  )
  return `<ul class="ordo">${sorted
    .map((r) => {
      const c = names.get(r.churchId)!
      const detail = [r.when, typeLabel(r.type), r.lang !== 'česky' ? r.lang : '', r.greek ? 'řeckokatolický ritus' : '', r.note]
        .filter(Boolean)
        .map(esc)
      return (
        `<li><span class="t">${esc(r.time)}</span> <span class="n"><a href="${churchUrl(r.churchId)}">${esc(c.name)}</a>` +
        (quarter(c) ? `, ${esc(quarter(c))}` : '') +
        `</span><span class="d">${[...detail, r.source].join(' · ')}</span></li>`
      )
    })
    .join('')}</ul>`
}

const NOTE_ADVENT =
  'Roráty jsou ranní (někde večerní) mše v adventu, často při svíčkách. Rejstřík ČBK je uvádí jen u menšiny kostelů; ' +
  'doplňujeme je z adventních ohlášek farností a u každého řádku je zdroj. Před cestou si čas ověřte u farnosti.'
const NOTE_VANOCE =
  'Vánoční pořad farnosti zveřejňují v prosinci a do rejstříku ČBK ho většinou nezapisují. ' +
  'Proto tu nejsou běžné týdenní časy: uvádíme jen bohoslužby zapsané přímo na tyto dny, z rejstříku nebo z ohlášek farností (s odkazem). ' +
  'Před cestou si čas ověřte u farnosti.'

export function seasonCityPage(input: {
  kind: SeasonKind
  city: City
  entries: Record<string, RawEntry | undefined>
  corrections: SeasonCorrection[]
  today: string
}): SeasonPage & { services: number } {
  const { kind, city, entries, corrections, today } = input
  const names = new Map(city.churches.map((c) => [c.id, c]))
  const listed = city.churches.filter((c) => entries[c.id])
  const shown = city.label ?? city.name
  const url = `${SITE_ORIGIN}/${kind}/${city.slug}/`
  let total = 0
  let sections: string
  let title: string
  let description: string
  let crumb: string

  if (kind === 'advent') {
    const advent = adventOf(today)
    const rows = listed.flatMap((c) => rorateRows(c.id, entries[c.id]!, advent, corrections))
    total = rows.length
    const churches = new Set(rows.map((r) => r.churchId)).size
    crumb = `Roráty ${advent.year}`
    title = `Roráty ${advent.year} — ${shown}: rorátní mše v adventu | Kam na mši`
    description = `${shown}: roráty v adventu ${advent.year} (${dateCz(advent.start)} – ${dateCz(advent.end)}) — ${total} ${plural(total, 'záznam', 'záznamy', 'záznamů')} v ${churches} ${plural(churches, 'kostele', 'kostelech', 'kostelech')}, se zdrojem u každého.`
    sections = `<h2><span class="rubric">${esc(dateCz(advent.start))} – ${esc(dateCz(advent.end))}</span> Advent ${advent.year}</h2>\n${
      rows.length ? rowsHtml(rows, city, names) : '<p>Zatím tu nic není. Roráty doplníme z adventních ohlášek farností.</p>'
    }`
  } else {
    const year = christmasOf(today)
    const days: [number, string, number][] = [
      [24, 'Štědrý den — večerní a půlnoční mše', 15 * 60],
      [25, 'Slavnost Narození Páně', 0],
      [26, 'Svátek sv. Štěpána', 0],
    ]
    const parts = days.map(([d, name, from], i) => {
      const date = `${year}-12-${d}`
      const label = `${WEEKDAY[new Date(Date.UTC(year, 11, d)).getUTCDay()]} ${d}. prosince`
      const rows = listed.flatMap((c) => datedRows(c.id, entries[c.id]!, date, from, corrections))
      total += rows.length
      return `<h2 id="den-${i + 1}"><span class="rubric">${esc(label)}</span> ${esc(name)}</h2>\n${
        rows.length ? rowsHtml(rows, city, names) : '<p>Zatím tu nic není. Vánoční pořad doplníme z ohlášek farností.</p>'
      }`
    })
    sections = parts.join('\n        ')
    crumb = `Vánoce ${year}`
    title = `Vánoce ${year} — půlnoční a mše svatá ${shown} | Kam na mši`
    description = `${shown}: půlnoční a mše svatá o Vánocích ${year} (24.–26. 12.) — ${total} ${plural(total, 'bohoslužba', 'bohoslužby', 'bohoslužeb')} zapsaných na tyto dny, se zdrojem u každé.`
  }

  const h1 = kind === 'advent' ? `${crumb}: rorátní mše — ${esc(shown)}` : `${crumb}: půlnoční a mše svatá — ${esc(shown)}`
  const body = `
      <main class="ordo-page">
        <p class="crumbs"><a href="${SITE_ORIGIN}/">Kam na mši</a> › <a href="${SITE_ORIGIN}/${kind}/">${esc(crumb)}</a></p>
        <h1>${h1}</h1>
        <p class="small">Seřazeno podle času; u každého řádku je zdroj.</p>
        ${sections}
        <p class="small">${kind === 'advent' ? NOTE_ADVENT : NOTE_VANOCE}</p>
        <p><a href="${SITE_ORIGIN}/">Bohoslužby podle vaší polohy — celý týden v aplikaci</a> · <a href="${SITE_ORIGIN}/${kind}/">${esc(crumb)} v dalších městech</a></p>
      </main>
`
  const jsonLd = ldSafe({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Kam na mši', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: crumb, item: `${SITE_ORIGIN}/${kind}/` },
      { '@type': 'ListItem', position: 3, name: shown, item: url },
    ],
  })
  return { url, title, description: description.slice(0, 200), body, jsonLd, services: total }
}

export function seasonHubPage(input: { kind: SeasonKind; towns: { name: string; slug: string; count: number; label?: string }[]; today: string }): SeasonPage {
  const { kind, towns, today } = input
  const year = kind === 'advent' ? adventOf(today).year : christmasOf(today)
  const url = `${SITE_ORIGIN}/${kind}/`
  const crumb = kind === 'advent' ? `Roráty ${year}` : `Vánoce ${year}`
  const title = kind === 'advent' ? `Roráty ${year} podle měst — rorátní mše v adventu | Kam na mši` : `Vánoce ${year} — půlnoční podle měst | Kam na mši`
  const lead =
    kind === 'advent'
      ? `Advent ${year} začíná ${dateCz(adventOf(today).start)}. Roráty podle měst, se zdrojem u každého řádku.`
      : `Půlnoční a vánoční mše ${year} podle měst, se zdrojem u každého řádku.`
  const list = towns.length
    ? `<ul class="cities">${[...towns]
        .sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name, 'cs'))
        .map((t) => `<li><a href="${SITE_ORIGIN}/${kind}/${esc(t.slug)}/">${esc(t.label ?? t.name)}</a></li>`)
        .join('')}</ul>`
    : '<p>Zatím tu nic není.</p>'
  const body = `
      <main class="ordo-page">
        <p class="crumbs"><a href="${SITE_ORIGIN}/">Kam na mši</a></p>
        <h1>${esc(crumb)}</h1>
        <p>${esc(lead)}</p>
        <h2>Města (${towns.length})</h2>
        ${list}
        <p class="small">${kind === 'advent' ? NOTE_ADVENT : NOTE_VANOCE}</p>
      </main>
`
  const jsonLd = ldSafe({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Kam na mši', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: crumb, item: url },
    ],
  })
  return { url, title, description: lead.slice(0, 200), body, jsonLd }
}

// Advent (roráty) and Christmas (půlnoční) — static town pages in the shape of
// the Dušičky ones (feast.ts): /advent/<town>/ and /vanoce/<town>/, the list IS
// the page, no script. Plan and data passes: docs/SEASON-PAGES.md.
//
// Unlike Dušičky, the registry can't fill these by itself: only ~30 rows name
// roráty, and nobody enters 24 Dec one-offs ahead. A weekly Thursday row says
// nothing about Christmas Eve, so it isn't listed. Listed is what is seasonal:
//   advent — roráty rows (type or note says "rorát") that run in Advent, and
//            roráty one-offs dated in Advent;
//   vanoce — rows dated 24 Dec (from the afternoon), 25 and 26 Dec.
// One-offs come from the parishes' entries or from data/corrections.json, which
// the data passes fill from the parishes' own notices. Every row says which.
// A church with nothing listed is named too, with where to check — never a guess.
// Each page also has a Markdown twin (index.md) for assistants, with more detail.
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
  /** The Markdown twin, served at `${url}index.md`. */
  markdown: string
}

const DAY_MS = 86_400_000
const WEEKDAY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'] // getUTCDay order
const WD_SHORT = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so']
const REG_SHORT: Record<string, string> = { '1': 'po', '2': 'út', '3': 'st', '4': 'čt', '5': 'pá', '6': 'so', '7': 'ne' }
const SOURCE_URL = 'https://bohosluzby.cirkev.cz/'

const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const ldSafe = (o: unknown) => JSON.stringify(o).replaceAll('<', '\\u003c')
/** One Markdown table cell / list item: no pipes, no newlines, no tags. */
const mdCell = (s: string) => s.replace(/[\r\n]+/g, ' ').replaceAll('|', '/').replaceAll('<', '‹').replaceAll('>', '›').trim()
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
const wdOf = (d: string) => String(new Date(utc(d)).getUTCDay() || 7) // registry weekday, 7 = Sunday
/** "2016-09-06" → "6. 9. 2016" */
const dateCz = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : ''
}
const isoDay = (s: string) => /^\d{4}-\d{2}-\d{2}/.exec(s)?.[0] ?? ''
/** "2026-12-05" → "so 5. 12." */
const dayShort = (s: string) => {
  const d = new Date(utc(s))
  return `${WD_SHORT[d.getUTCDay()]} ${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`
}
const typeLabel = (type: string) => (!type || /^mše sv\.?$/i.test(type) ? 'mše svatá' : type.trim())
const RORATE = /rorát/i
const httpUrl = (s: string | undefined) => (s && /^https?:\/\//i.test(s) ? s : '')

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

interface Source {
  /** 'farnost' = a parish notice (data/corrections.json); 'rejstrik' = the registry. */
  from: 'farnost' | 'rejstrik'
  url: string
  /** The notice's date as written, or the registry's last-verified date (YYYY-MM-DD). */
  date: string
}

export interface SeasonRow {
  churchId: string
  /** Every date this service falls on (one for Christmas, ~20 for a weekly roráty row). */
  dates: string[]
  time: string
  /** "po–pá" / "so 5. 12." / "" */
  when: string
  type: string
  lang: string
  greek: boolean
  note: string
  source: Source
}

export interface SeasonSection {
  /** The day (Christmas) or the first day of Advent. */
  date: string
  label: string
  name: string
  /** Christmas Eve lists from 15:00. */
  fromMin: number
  rows: SeasonRow[]
}

function sourceOf(c: SeasonCorrection | undefined, entry: RawEntry): Source {
  if (c) return { from: 'farnost', url: httpUrl(c.source), date: c.source_date }
  return { from: 'rejstrik', url: '', date: isoDay(entry.u) }
}

function sourceHtml(s: Source): string {
  if (s.from === 'farnost') return s.url ? `<a href="${esc(s.url)}">ohlášky farnosti</a> (${esc(s.date)})` : `ohlášky farnosti (${esc(s.date)})`
  return s.date ? `rejstřík ČBK, ověřen ${esc(dateCz(s.date))}` : 'rejstřík ČBK'
}

function sourceMd(s: Source): string {
  if (s.from === 'farnost') return mdCell(`ohlášky farnosti (${s.date})${s.url ? ` ${s.url}` : ''}`)
  return 'rejstřík ČBK'
}

function correctionFor(corrections: SeasonCorrection[], id: string, date: string, time: string): SeasonCorrection | undefined {
  return corrections.find((c) => c.id === id && c.date === date && (c.add ?? []).some((a) => hhmm(a[0] ?? '') === hhmm(time)))
}

/** Roráty for one church in one Advent: weekly rows that run in it, plus dated ones. */
function rorateRows(id: string, entry: RawEntry, advent: { start: string; end: string }, corrections: SeasonCorrection[]): SeasonRow[] {
  const days: string[] = []
  for (let t = utc(advent.start); t <= utc(advent.end); t += DAY_MS) days.push(iso(t))
  const out: SeasonRow[] = []
  for (const r of entry.s) {
    if (!RORATE.test(`${r[4]} ${r[5]}`) || isConfession(r[4])) continue
    // "v adventu 2019": the parish wrote it for a past Advent
    if ([...r[5].matchAll(/\b(20\d\d)\b/g)].some((m) => Number(m[1]) < Number(advent.end.slice(0, 4)))) continue
    // a year-round "rorátní" row that never says Advent is a registry label, not roráty
    if (!/advent/i.test(`${r[4]} ${r[5]}`)) continue
    const rule = parseNote(r[5])
    // no roráty on an Advent Sunday: a Sunday row is the ordinary Sunday Mass
    const dates = days.filter((d) => {
      const [y, m, dd] = d.split('-').map(Number)
      return wdOf(d) !== '7' && r[0].includes(wdOf(d)) && rule.runsOn(y, m, dd)
    })
    const on = [...r[0]].filter((wd) => dates.some((d) => wdOf(d) === wd))
    if (!on.length) continue
    // "v adventu od 7:00 hodin roráty": the note gives the roráty time, the row the weekly one
    const own = /(?:od|v)\s+(\d{1,2})[:.](\d{2})\s*(?:hod\S*\s+)?roráty/i.exec(r[5])
    out.push({
      churchId: id,
      dates,
      time: own ? `${own[1].padStart(2, '0')}:${own[2]}` : hhmm(r[1]),
      when: regDays(on.join('')),
      type: r[4],
      lang: normalizeLang(r[2]),
      greek: r[3] === 1,
      note: r[5].trim(),
      source: sourceOf(undefined, entry),
    })
  }
  // dated roráty: one notice gives ~20 dates for a church; the same time, kind and
  // source make one row ("po–pá 30. 11. – 23. 12., kromě 8. 12."), not twenty
  const groups = new Map<string, SeasonRow>()
  for (const r of entry.x ?? []) {
    if (r[0] < advent.start || r[0] > advent.end || !RORATE.test(`${r[4]} ${r[5]}`)) continue
    const row: SeasonRow = { churchId: id, dates: [], time: hhmm(r[1]), when: '', type: r[4], lang: normalizeLang(r[2]), greek: r[3] === 1, note: r[5].trim(), source: sourceOf(correctionFor(corrections, id, r[0], r[1]), entry) }
    const key = JSON.stringify([row.time, row.type, row.lang, row.greek, row.note, row.source])
    const g = groups.get(key) ?? row
    g.dates.push(r[0])
    groups.set(key, g)
  }
  for (const row of groups.values()) {
    row.dates = [...new Set(row.dates)].sort()
    out.push({ ...row, when: datesSpan(row.dates) })
  }
  return out
}

/** "so 5. 12." for one date; "po–pá 30. 11. – 23. 12., kromě 8. 12." for a run. */
function datesSpan(ds: string[]): string {
  if (ds.length === 1) return dayShort(ds[0])
  const days = [...new Set(ds.map(wdOf))].sort().join('')
  const dm = (d: string) => `${Number(d.slice(8, 10))}. ${Number(d.slice(5, 7))}.`
  const missing: string[] = []
  for (let t = utc(ds[0]); t <= utc(ds[ds.length - 1]); t += DAY_MS) {
    const d = iso(t)
    if (days.includes(wdOf(d)) && !ds.includes(d)) missing.push(dm(d))
  }
  return `${regDays(days)} ${dm(ds[0])} – ${dm(ds[ds.length - 1])}` + (missing.length ? `, kromě ${missing.join(', ')}` : '')
}

/** One church's rows dated `date` (Christmas), from `fromMin` on. */
function datedRows(id: string, entry: RawEntry, date: string, fromMin: number, corrections: SeasonCorrection[]): SeasonRow[] {
  return (entry.x ?? [])
    .filter((r) => r[0] === date && !isConfession(r[4]) && toMin(r[1]) >= fromMin)
    .map((r) => ({
      churchId: id,
      dates: [date],
      time: hhmm(r[1]),
      when: '',
      type: r[4],
      lang: normalizeLang(r[2]),
      greek: r[3] === 1,
      note: r[5].trim(),
      source: sourceOf(correctionFor(corrections, id, date, r[1]), entry),
    }))
}

export interface SeasonChurch {
  id: string
  name: string
  city: string
  lat?: number
  lng?: number
  www?: string
  /** Barrier-free per the registry (churches.json column 5). */
  access?: boolean
}

interface City {
  name: string
  slug: string
  churches: SeasonChurch[]
  label?: string
}

type Input = { kind: SeasonKind; city: City; entries: Record<string, RawEntry | undefined>; corrections: SeasonCorrection[]; today: string }

/** What the page for `kind` lists in `city`: one section per day (Christmas) or one for Advent. */
export function seasonSections({ kind, city, entries, corrections, today }: Input): SeasonSection[] {
  const listed = city.churches.filter((c) => entries[c.id])
  if (kind === 'advent') {
    const advent = adventOf(today)
    return [
      {
        date: advent.start,
        label: `${dateCz(advent.start)} – ${dateCz(advent.end)}`,
        name: `Advent ${advent.year}`,
        fromMin: 0,
        rows: listed.flatMap((c) => rorateRows(c.id, entries[c.id]!, advent, corrections)),
      },
    ]
  }
  const year = christmasOf(today)
  const days: [number, string, number][] = [
    [24, 'Štědrý den — večerní a půlnoční mše', 15 * 60],
    [25, 'Slavnost Narození Páně', 0],
    [26, 'Svátek sv. Štěpána', 0],
  ]
  return days.map(([d, name, fromMin]) => {
    const date = `${year}-12-${d}`
    return {
      date,
      label: `${WEEKDAY[new Date(Date.UTC(year, 11, d)).getUTCDay()]} ${d}. prosince`,
      name,
      fromMin,
      rows: listed.flatMap((c) => datedRows(c.id, entries[c.id]!, date, fromMin, corrections)),
    }
  })
}

const quarterOf = (c: { name: string; city: string }, town: string) => {
  const q = c.city.includes(',') ? c.city.slice(0, c.city.lastIndexOf(',')).trim() : c.city.trim()
  return q && q !== town && !c.name.includes(q) ? q : ''
}
const sortRows = (rows: SeasonRow[], names: Map<string, SeasonChurch>) =>
  [...rows].sort((a, b) => toMin(a.time) - toMin(b.time) || names.get(a.churchId)!.name.localeCompare(names.get(b.churchId)!.name, 'cs'))

function rowsHtml(rows: SeasonRow[], city: City, names: Map<string, SeasonChurch>): string {
  return `<ul class="ordo">${sortRows(rows, names)
    .map((r) => {
      const c = names.get(r.churchId)!
      const detail = [r.when, typeLabel(r.type), r.lang !== 'česky' ? r.lang : '', r.greek ? 'řeckokatolický ritus' : '', r.note]
        .filter(Boolean)
        .map(esc)
      return (
        `<li><span class="t">${esc(r.time)}</span> <span class="n"><a href="${churchUrl(r.churchId)}">${esc(c.name)}</a>` +
        (quarterOf(c, city.name) ? `, ${esc(quarterOf(c, city.name))}` : '') +
        `</span><span class="d">${[...detail, sourceHtml(r.source)].join(' · ')}</span></li>`
      )
    })
    .join('')}</ul>`
}

/** "24:00" on the 24th is midnight, i.e. 00:00 on the 25th. Prague is UTC+1 in Advent and at Christmas. */
function startDate(date: string, time: string): string {
  const min = toMin(time)
  const day = min >= 24 * 60 ? iso(utc(date) + DAY_MS) : date
  const m = min % (24 * 60)
  return `${day}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}+01:00`
}

function events(sections: SeasonSection[], names: Map<string, SeasonChurch>, kind: SeasonKind) {
  return sections.flatMap((sec) =>
    sec.rows.flatMap((r) => {
      const c = names.get(r.churchId)!
      const name = `${kind === 'advent' ? 'Roráty' : r.note && /půlnoční/i.test(r.note) ? 'Půlnoční' : typeLabel(r.type)} — ${c.name}`
      return r.dates.map((d) => ({
        '@type': 'Event',
        name: name.slice(0, 1).toUpperCase() + name.slice(1),
        startDate: startDate(d, r.time),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        isAccessibleForFree: true,
        ...(r.note ? { description: r.note } : {}),
        location: {
          '@type': 'Church',
          name: c.name,
          url: churchUrl(c.id),
          address: { '@type': 'PostalAddress', addressLocality: c.city, addressCountry: 'CZ' },
          ...(c.lat != null && c.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng } } : {}),
        },
      }))
    }),
  )
}

const NOTE_ADVENT =
  'Roráty jsou ranní (někde večerní) mše v adventu, často při svíčkách. Rejstřík ČBK je uvádí jen u menšiny kostelů; ' +
  'doplňujeme je z adventních ohlášek farností a u každého řádku je zdroj. Před cestou si čas ověřte u farnosti.'
const NOTE_VANOCE =
  'Vánoční pořad farnosti zveřejňují v prosinci a do rejstříku ČBK ho většinou nezapisují. ' +
  'Proto tu nejsou běžné týdenní časy: uvádíme jen bohoslužby zapsané přímo na tyto dny, z rejstříku nebo z ohlášek farností (s odkazem). ' +
  'Před cestou si čas ověřte u farnosti.'
const NOT_YET = 'rozpis zatím farnost nezveřejnila'

function header(kind: SeasonKind, today: string) {
  const year = kind === 'advent' ? adventOf(today).year : christmasOf(today)
  return { year, crumb: kind === 'advent' ? `Roráty ${year}` : `Vánoce ${year}` }
}

const updatedHtml = (today: string, checked: string) =>
  `<p class="small">Aktualizováno ${esc(dateCz(today))}${checked ? ` · stav rejstříku k ${esc(dateCz(checked))}` : ''} · zdroj: <a href="${SOURCE_URL}">bohosluzby.cirkev.cz</a> (rejstřík bohoslužeb ČBK) a ohlášky farností · <a href="index.md">verze pro asistenty (Markdown)</a></p>`

export function seasonCityPage(input: Input & { checked?: string }): SeasonPage & { services: number; missing: number } {
  const { kind, city, entries, today, checked = '' } = input
  const names = new Map(city.churches.map((c) => [c.id, c]))
  const shown = city.label ?? city.name
  const url = `${SITE_ORIGIN}/${kind}/${city.slug}/`
  const { crumb } = header(kind, today)
  const sections = seasonSections(input)
  const total = sections.reduce((n, s) => n + s.rows.length, 0)
  const withRows = new Set(sections.flatMap((s) => s.rows.map((r) => r.churchId)))
  const missing = city.churches.filter((c) => !withRows.has(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const stav = checked ? ` (stav rejstříku k ${dateCz(checked)})` : ''
  const what = kind === 'advent' ? 'Roráty' : 'Na tento den rozpis'
  const emptyDay = `<p>${what} zatím žádná farnost nezveřejnila${esc(stav)}. Ověřte u farnosti — kostely jsou níže.</p>`

  const sectionsHtml = sections
    .map(
      (s, i) =>
        `<h2 id="den-${i + 1}"><span class="rubric">${esc(s.label)}</span> ${esc(s.name)}</h2>\n${s.rows.length ? rowsHtml(s.rows, city, names) : emptyDay}`,
    )
    .join('\n        ')
  const checkAt = (c: SeasonChurch) =>
    httpUrl(c.www) ? `ověřte na <a href="${esc(c.www!)}">webu farnosti</a>` : `ověřte u farnosti (kontakty na <a href="${churchUrl(c.id)}">stránce kostela</a>)`
  const missingHtml = missing.length
    ? `<details class="missing"><summary>${esc(kind === 'advent' ? 'Kostely bez rorátů v rejstříku' : 'Kostely bez vánočního rozpisu')} (${missing.length})</summary><ul>${missing
        .map(
          (c) =>
            `<li><a href="${churchUrl(c.id)}">${esc(c.name)}</a>${quarterOf(c, city.name) ? `, ${esc(quarterOf(c, city.name))}` : ''} — ${NOT_YET}${esc(stav)}, ${checkAt(c)}</li>`,
        )
        .join('')}</ul></details>`
    : ''

  let title: string
  let description: string
  if (kind === 'advent') {
    const advent = adventOf(today)
    title = `Roráty ${advent.year} — ${shown}: rorátní mše v adventu | Kam na mši`
    description = `${shown}: roráty v adventu ${advent.year} (${dateCz(advent.start)} – ${dateCz(advent.end)}) — ${total} ${plural(total, 'záznam', 'záznamy', 'záznamů')} v ${withRows.size} ${plural(withRows.size, 'kostele', 'kostelech', 'kostelech')}, se zdrojem u každého.`
  } else {
    const year = christmasOf(today)
    title = `Vánoce ${year} — půlnoční a mše svatá ${shown} | Kam na mši`
    description = total
      ? `${shown}: půlnoční a mše svatá o Vánocích ${year} (24.–26. 12.) — ${total} ${plural(total, 'bohoslužba', 'bohoslužby', 'bohoslužeb')} zapsaných na tyto dny, se zdrojem u každé.`
      : `${shown}: půlnoční a mše svatá o Vánocích ${year} (24.–26. 12.) — farnosti rozpis zatím nezveřejnily; doplňujeme z rejstříku ČBK a ohlášek.`
  }

  const h1 = kind === 'advent' ? `${crumb}: rorátní mše — ${esc(shown)}` : `${crumb}: půlnoční a mše svatá — ${esc(shown)}`
  const body = `
      <main class="ordo-page ${kind}">
        <p class="crumbs"><a href="${SITE_ORIGIN}/">Kam na mši</a> › <a href="${SITE_ORIGIN}/${kind}/">${esc(crumb)}</a></p>
        <h1>${h1}</h1>
        ${updatedHtml(today, checked)}
        ${sectionsHtml}
        ${missingHtml}
        <p class="small">${kind === 'advent' ? NOTE_ADVENT : NOTE_VANOCE}</p>
        <p><a href="${SITE_ORIGIN}/">Bohoslužby podle vaší polohy — celý týden v aplikaci</a> · <a href="${SITE_ORIGIN}/${kind}/">${esc(crumb)} v dalších městech</a></p>
      </main>
`
  const jsonLd = ldSafe({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Kam na mši', item: `${SITE_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: crumb, item: `${SITE_ORIGIN}/${kind}/` },
          { '@type': 'ListItem', position: 3, name: shown, item: url },
        ],
      },
      ...events(sections, names, kind),
    ],
  })

  // the twin: everything a person reads, plus address, rite, access and the verified date per row
  const mdRow = (r: SeasonRow) => {
    const c = names.get(r.churchId)!
    const e = entries[r.churchId]
    const addr = [c.city, c.lat != null && c.lng != null ? `GPS ${c.lat}, ${c.lng}` : ''].filter(Boolean).join(', ')
    return `| ${[
      r.time,
      r.when || '',
      c.name,
      addr,
      typeLabel(r.type) + (r.note ? ` (${r.note})` : ''),
      r.greek ? 'řeckokatolický' : 'římskokatolický',
      r.lang,
      c.access ? 'bezbariérový: ano' : 'bezbariérový: neuvedeno',
      e?.u ? isoDay(e.u) : 'neuvedeno',
      sourceMd(r.source),
      churchUrl(c.id),
      httpUrl(c.www) || '—',
    ]
      .map(mdCell)
      .join(' | ')} |`
  }
  const table = (rows: SeasonRow[]) =>
    rows.length
      ? [
          '| čas | dny | kostel | adresa | bohoslužba | ritus | jazyk | přístup | rejstřík ověřen | zdroj | stránka kostela | web farnosti |',
          '|---|---|---|---|---|---|---|---|---|---|---|---|',
          ...sortRows(rows, names).map(mdRow),
        ].join('\n')
      : `${what} zatím žádná farnost nezveřejnila${stav}.`
  const markdown = [
    `# ${crumb}: ${kind === 'advent' ? 'rorátní mše' : 'půlnoční a mše svatá'} — ${mdCell(shown)}`,
    '',
    `- Aktualizováno: ${today} (sestavení stránky)`,
    `- Stav rejstříku: ${checked || 'neuvedeno'}`,
    `- Zdroj: rejstřík bohoslužeb České biskupské konference, ${SOURCE_URL} (zapisují farnosti); řádky z ohlášek farností mají odkaz na ohlášky`,
    `- Stránka pro čtenáře: ${url}`,
    `- Bohoslužeb na stránce: ${total}; kostelů bez rozpisu: ${missing.length} z ${city.churches.length}`,
    '',
    kind === 'advent' ? NOTE_ADVENT : NOTE_VANOCE,
    'Časy nikdy nedoplňujeme odhadem: co farnost nezveřejnila, tu není.',
    '',
    ...sections.flatMap((s) => [`## ${s.label} — ${s.name}`, '', table(s.rows), '']),
    `## Kostely bez rozpisu (${missing.length})`,
    '',
    ...missing.map((c) => {
      const e = entries[c.id]
      const where = httpUrl(c.www) ? `ověřte na webu farnosti ${c.www}` : 'ověřte u farnosti'
      return `- ${mdCell(c.name)} (${mdCell(c.city)}) — ${NOT_YET}${stav}; ${mdCell(where)}; rejstřík ověřen ${e?.u ? isoDay(e.u) : 'neuvedeno'}; ${churchUrl(c.id)}`
    }),
    '',
  ].join('\n')

  return { url, title, description: description.slice(0, 200), body, jsonLd, markdown, services: total, missing: missing.length }
}

export function seasonHubPage(input: { kind: SeasonKind; towns: { name: string; slug: string; count: number; label?: string }[]; today: string; checked?: string }): SeasonPage {
  const { kind, towns, today, checked = '' } = input
  const { year, crumb } = header(kind, today)
  const url = `${SITE_ORIGIN}/${kind}/`
  const title = kind === 'advent' ? `Roráty ${year} podle měst — rorátní mše v adventu | Kam na mši` : `Vánoce ${year} — půlnoční podle měst | Kam na mši`
  const lead =
    kind === 'advent'
      ? `Advent ${year} začíná ${dateCz(adventOf(today).start)}. Roráty podle měst, se zdrojem u každého řádku.`
      : `Půlnoční a vánoční mše ${year} podle měst, se zdrojem u každého řádku.`
  const sorted = [...towns].sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name, 'cs'))
  const filled = towns.filter((t) => t.count > 0).length
  const list = sorted.length
    ? `<ul class="cities">${sorted
        .map((t) => `<li><a href="${SITE_ORIGIN}/${kind}/${esc(t.slug)}/">${esc(t.label ?? t.name)}</a></li>`)
        .join('')}</ul>`
    : '<p>Zatím tu nic není.</p>'
  const body = `
      <main class="ordo-page ${kind}">
        <p class="crumbs"><a href="${SITE_ORIGIN}/">Kam na mši</a></p>
        <h1>${esc(crumb)}</h1>
        <p>${esc(lead)}</p>
        ${updatedHtml(today, checked)}
        <p class="small">Rozpis zatím zveřejnily farnosti v ${filled} ${plural(filled, 'městě', 'městech', 'městech')} z ${towns.length}. Stránky ostatních měst vyjmenují kostely a řeknou, kde čas ověřit.</p>
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
  const markdown = [
    `# ${crumb} — ${kind === 'advent' ? 'roráty' : 'půlnoční a vánoční mše'} podle měst`,
    '',
    `- Aktualizováno: ${today} (sestavení stránky)`,
    `- Stav rejstříku: ${checked || 'neuvedeno'}`,
    `- Zdroj: rejstřík bohoslužeb České biskupské konference, ${SOURCE_URL}, a ohlášky farností`,
    `- Stránka pro čtenáře: ${url}`,
    `- Měst s rozpisem: ${filled} z ${towns.length}`,
    '',
    kind === 'advent' ? NOTE_ADVENT : NOTE_VANOCE,
    '',
    '| město | bohoslužeb | Markdown | stránka |',
    '|---|---|---|---|',
    ...sorted.map((t) => `| ${mdCell(t.label ?? t.name)} | ${t.count} | ${url}${t.slug}/index.md | ${url}${t.slug}/ |`),
    '',
  ].join('\n')
  return { url, title, description: lead.slice(0, 200), body, jsonLd, markdown }
}

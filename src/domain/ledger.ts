// The freshness ledger (/cerstvost/, scripts/prerender.mjs): what Kam na mši
// knows that the ČBK register doesn't say. Per diocese: how old the entries
// are and how many the app flags as stale (the same 18-month rule as the
// "ověřte si u farnosti" warning); the sourced hand corrections
// (data/corrections.json); a few figures computed from the weekly schedules.
// A static page plus a Markdown twin; no bulk dataset download (Pavol deferred
// that, 12 Nov 2026).
// Node imports this via type stripping: explicit .ts specifiers, types only
// from elsewhere.
import type { RawEntry } from './churchPage.ts'
import { DIOCESES, dioceseKey } from './diocese.ts'
import { isStale } from './registry.ts'
import { SITE_ORIGIN, churchUrl } from './site.ts'

export interface LedgerChurch {
  id: string
  name: string
  city: string
}

/** One row of data/corrections.json (format: data/corrections.mjs). */
export interface Correction {
  id: string
  church: string
  town: string
  date: string
  add?: string[][]
  drop?: string[]
  source: string
  source_date: string
  quote: string
  checked: string
}

export const BUCKETS = ['do 6 měsíců', '6–18 měsíců', '18 měsíců – 3 roky', '3–6 let', 'víc než 6 let'] as const
const EVENING_SUNDAY = 17 * 60
const EVENING_SATURDAY = 16 * 60

export interface Tally {
  churches: number
  withSchedule: number
  stale: number
  /** Entries per age bucket (BUCKETS order); the first two are exactly the non-stale ones. */
  buckets: number[]
  medianMonths: number | null
  oldest: string
  sundayMasses: number
  churchesWithSunday: number
  eveningSunday: number
  saturdayEvening: number
}

export interface LedgerStats {
  now: string
  dioceses: (Tally & { key: string; name: string })[]
  total: Tally
  figures: { sundayMasses: number; churchesWithSunday: number; eveningSunday: number; saturdayEvening: number }
  corrections: { id: string; name: string; city: string; date: string; change: string; source: string; sourceHost: string; checked: string }[]
}

// ponytail: same rule as filters.isMass (blank type = a plain Mass); filters.ts
// pulls in app modules the Node prerender can't strip, so it's repeated here.
const isMass = (type: string) => !type.trim() || /mše|liturgi/i.test(type)
const startMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  return m ? +m[1] * 60 + +m[2] : -1
}
const monthsBetween = (iso: string, now: Date) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  let n = (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m)
  if (now.getUTCDate() < d) n -= 1
  return n
}

function tally(list: { e: RawEntry | undefined }[], now: Date): Tally {
  const t: Tally = {
    churches: list.length, withSchedule: 0, stale: 0, buckets: [0, 0, 0, 0, 0], medianMonths: null, oldest: '',
    sundayMasses: 0, churchesWithSunday: 0, eveningSunday: 0, saturdayEvening: 0,
  }
  const ages: number[] = []
  for (const { e } of list) {
    if (!e) continue
    const sunday = e.s.filter((r) => r[0].includes('7') && isMass(r[4]))
    t.sundayMasses += sunday.length
    if (sunday.length) t.churchesWithSunday++
    if (sunday.some((r) => startMin(r[1]) >= EVENING_SUNDAY)) t.eveningSunday++
    if (e.s.some((r) => r[0].includes('6') && isMass(r[4]) && startMin(r[1]) >= EVENING_SATURDAY)) t.saturdayEvening++
    if (!/^\d{4}-\d{2}-\d{2}/.test(e.u ?? '')) continue
    t.withSchedule++
    const months = monthsBetween(e.u, now)
    ages.push(months)
    if (!t.oldest || e.u < t.oldest) t.oldest = e.u.slice(0, 10)
    // the stale flag decides the 18-month boundary, so the buckets and the
    // app's warning never disagree by a few days
    if (isStale(e.u, now)) {
      t.stale++
      t.buckets[months < 36 ? 2 : months < 72 ? 3 : 4]++
    } else t.buckets[months < 6 ? 0 : 1]++
  }
  ages.sort((a, b) => a - b)
  if (ages.length) t.medianMonths = ages[Math.floor((ages.length - 1) / 2)]
  return t
}

export function ledgerStats(input: {
  index: LedgerChurch[]
  entryOf: (id: string) => RawEntry | undefined
  corrections: Correction[]
  now: Date
}): LedgerStats {
  const { index, entryOf, corrections, now } = input
  const all = index.map((c) => ({ c, e: entryOf(c.id) }))
  const dioceses = DIOCESES.map((d) => ({ key: d.key, name: d.name, ...tally(all.filter(({ c }) => dioceseKey(c.id) === d.key), now) }))
    .filter((d) => d.churches > 0)
  const total = tally(all, now)
  const byId = new Map(index.map((c) => [c.id, c]))
  const host = (u: string) => /^https?:\/\/(?:www\.)?([^/]+)/.exec(u)?.[1] ?? u
  const change = (c: Correction) =>
    [
      ...(c.add ?? []).map((a) => `doplněno ${a[0]} ${a[1] ?? ''}`.trim()),
      ...(c.drop ?? []).map((t) => `nekoná se ${t}`),
    ].join('; ')
  return {
    now: now.toISOString().slice(0, 10),
    dioceses,
    total,
    figures: {
      sundayMasses: total.sundayMasses,
      churchesWithSunday: total.churchesWithSunday,
      eveningSunday: total.eveningSunday,
      saturdayEvening: total.saturdayEvening,
    },
    corrections: corrections
      .map((c) => ({
        id: c.id,
        name: byId.get(c.id)?.name ?? c.church,
        city: byId.get(c.id)?.city ?? c.town,
        date: c.date,
        change: change(c),
        // the log's source field sometimes holds two URLs or a note after the
        // first one; the page links the first and names its host
        source: c.source.trim().split(/\s/)[0],
        sourceHost: host(c.source.trim().split(/\s/)[0]),
        checked: c.checked,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'cs')),
  }
}

const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const dateCz = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : ''
}
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : '—')
const num = (n: number) => n.toLocaleString('cs-CZ').replace(/\s/g, ' ')
const months = (n: number | null) => (n === null ? '—' : n < 24 ? `${n} měs.` : `${(n / 12).toFixed(1).replace('.', ',')} r.`)
const md = (s: string) => s.replaceAll('|', '\\|').replaceAll('[', '\\[').replaceAll(']', '\\]')

/** ", Praha 1" — left out when the church's name already names its town. */
const where = (c: { name: string; city: string }) => (!c.city || c.name.includes(c.city) ? '' : `, ${c.city}`)
const correctionDays = (s: LedgerStats) => {
  const days = [...new Set(s.corrections.map((c) => c.date))].sort().map(dateCz)
  return days.length > 1 ? `${days.slice(0, -1).join(', ')} a ${days[days.length - 1]}` : (days[0] ?? '')
}

const URL_PATH = '/cerstvost/'
const REGISTER = 'https://bohosluzby.cirkev.cz'
const TITLE = 'Čerstvost rozpisů bohoslužeb v rejstříku — podle diecézí | Kam na mši'

/** The intro sentences, shared by the page and its Markdown twin. */
function intro(s: LedgerStats, today: string): string[] {
  const t = s.total
  return [
    `Stav k ${dateCz(today)}. Zdroj: veřejný rejstřík bohoslužeb ČBK (${REGISTER}), jak jej zobrazuje Kam na mši, a ručně ověřené opravy z ohlášek farností.`,
    `Rejstřík u každého kostela uvádí, kdy farnost záznam naposledy změnila. Je-li to déle než 18 měsíců, aplikace u rozpisu ukáže „ověřte si u farnosti“. Teď se to týká ${num(t.stale)} z ${num(t.withSchedule)} kostelů s rozpisem (${pct(t.stale, t.withSchedule)}). Starý záznam může být správný; jen ho dlouho nikdo nepotvrdil.`,
  ]
}

// fresh = light, old = dark ink: the eye lands on what has gone longest unconfirmed
const BAR_TONES = ['#e3d9c2', '#c9bc9f', '#9c8f75', '#655c4d', '#1a1712']

function bar(buckets: number[], total: number): string {
  if (!total) return ''
  const segs = buckets
    .map((n, i) => (n ? `<span style="width:${((100 * n) / total).toFixed(2)}%;background:${BAR_TONES[i]}" title="${esc(BUCKETS[i])}: ${n}"></span>` : ''))
    .join('')
  return `<span class="bar" aria-hidden="true">${segs}</span>`
}

export function ledgerPage(s: LedgerStats, today: string): { url: string; title: string; description: string; body: string; jsonLd: string } {
  const url = `${SITE_ORIGIN}${URL_PATH}`
  const t = s.total
  const f = s.figures
  const description = `Kolik rozpisů bohoslužeb v rejstříku je starších 18 měsíců, podle diecézí (${pct(t.stale, t.withSchedule)} celkem), ověřené opravy a nedělní mše v číslech. Stav k ${dateCz(today)}.`
  const legend = BUCKETS.map((b, i) => `<li><span class="sw" style="background:${BAR_TONES[i]}"></span>${esc(b)}</li>`).join('')
  const rows = [...s.dioceses, { key: '', name: 'Celkem', ...t }]
    .map(
      (d) =>
        `<tr${d.key ? '' : ' class="sum"'}><th scope="row">${esc(d.name)}${bar(d.buckets, d.withSchedule)}</th>` +
        `<td>${num(d.withSchedule)}</td><td>${num(d.stale)}</td><td>${pct(d.stale, d.withSchedule)}</td><td>${months(d.medianMonths)}</td></tr>`,
    )
    .join('\n          ')
  const figRows = [...s.dioceses, { key: '', name: 'Celkem', ...t }]
    .map(
      (d) =>
        `<tr${d.key ? '' : ' class="sum"'}><th scope="row">${esc(d.name)}</th><td>${num(d.sundayMasses)}</td>` +
        `<td>${pct(d.eveningSunday, d.churchesWithSunday)}</td><td>${pct(d.saturdayEvening, d.churchesWithSunday)}</td></tr>`,
    )
    .join('\n          ')
  const corr = s.corrections
    .map(
      (c) =>
        `<li><span class="t">${esc(dateCz(c.date).replace(/ \d{4}$/, ''))}</span><span><a href="${churchUrl(c.id)}">${esc(c.name)}</a>${esc(where(c))} — ${esc(c.change)}</span>` +
        `<span class="d">zdroj: <a href="${esc(c.source)}" rel="nofollow">${esc(c.sourceHost)}</a> · ověřeno ${esc(dateCz(c.checked)).replaceAll(' ', '\u00a0')}</span></li>`,
    )
    .join('\n          ')
  const body = `
      <main class="ordo-page ledger">
        <p class="crumbs"><a href="${SITE_ORIGIN}/">Kam na mši</a></p>
        <h1>Jak čerstvé jsou rozpisy bohoslužeb</h1>
        ${intro(s, today).map((p) => `<p>${esc(p).replace(esc(REGISTER), `<a href="${REGISTER}">bohosluzby.cirkev.cz</a>`)}</p>`).join('\n        ')}
        <h2 id="dieceze"><span class="rubric">podle diecézí</span>Stáří záznamů</h2>
        <ul class="legend small">${legend}</ul>
        <div class="scroll"><table>
          <thead><tr><th scope="col">Diecéze</th><th scope="col">kostelů s rozpisem</th><th scope="col">starších 18 měs.</th><th scope="col">podíl</th><th scope="col">medián stáří</th></tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table></div>
        <p class="small">Nejstarší záznam je z ${esc(dateCz(t.oldest))}. ${t.churches - t.withSchedule ? `${num(t.churches - t.withSchedule)} kostelů v rejstříku nemá rozpis ani datum.` : ''} Diecézi určuje číslo kostela v rejstříku.</p>
        <h2 id="cisla"><span class="rubric">z týdenních rozpisů</span>Neděle v číslech</h2>
        <p>Rejstřík uvádí ${num(f.sundayMasses)} pravidelných nedělních mší v ${num(f.churchesWithSunday)} kostelech. Nedělní mši v 17:00 nebo později má ${num(f.eveningSunday)} z nich (${pct(f.eveningSunday, f.churchesWithSunday)}), sobotní mši od 16:00 ${num(f.saturdayEvening)} (${pct(f.saturdayEvening, f.churchesWithSunday)}).</p>
        <div class="scroll"><table>
          <thead><tr><th scope="col">Diecéze</th><th scope="col">nedělních mší</th><th scope="col">kostelů s nedělní mší od 17:00</th><th scope="col">se sobotní mší od 16:00</th></tr></thead>
          <tbody>
          ${figRows}
          </tbody>
        </table></div>
        <p class="small">Podíly jsou z kostelů, které mají v rejstříku aspoň jednu nedělní mši. Počítají se jen týdenní řádky (ne jednorázové), včetně řádků s poznámkou jako „1. neděle v měsíci“.</p>
        <h2 id="opravy"><span class="rubric">ručně ověřené</span>Opravy proti rejstříku</h2>
        <p>${num(s.corrections.length)} oprav pro ${correctionDays(s)}: časy, které farnost ohlásila a rejstřík neuváděl, nebo uváděl a farnost je zrušila. Každá je z ohlášek, zpravodaje nebo webu farnosti z roku 2026; aplikace je ukazuje u kostela k danému dni.</p>
        <ul class="ordo">
          ${corr}
        </ul>
        <p class="small">Tato stránka jako text pro jazykové modely: <a href="${SITE_ORIGIN}${URL_PATH}index.md">index.md</a>. Najdete-li u kostela chybu, napište nám z jeho stránky v aplikaci.</p>
      </main>`
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Čerstvost rozpisů bohoslužeb v rejstříku ČBK',
    description,
    url,
    inLanguage: 'cs',
    dateModified: today,
    isBasedOn: REGISTER,
    spatialCoverage: 'Česká republika',
    creator: { '@type': 'Organization', name: 'Kam na mši', url: SITE_ORIGIN },
  }).replaceAll('<', '\\u003c')
  return { url, title: TITLE, description, body, jsonLd }
}

/** The same page as Markdown (served at /cerstvost/index.md). */
export function ledgerMarkdown(s: LedgerStats, today: string): string {
  const t = s.total
  const f = s.figures
  const all = [...s.dioceses, { key: '', name: 'Celkem', ...t }]
  return `# Jak čerstvé jsou rozpisy bohoslužeb

${intro(s, today).join('\n\n')}

Stránka: ${SITE_ORIGIN}${URL_PATH}

## Stáří záznamů podle diecézí

| Diecéze | kostelů s rozpisem | starších 18 měs. | podíl | medián stáří | ${BUCKETS.join(' | ')} |
| --- | --- | --- | --- | --- |${BUCKETS.map(() => ' --- |').join('')}
${all.map((d) => `| ${d.name} | ${d.withSchedule} | ${d.stale} | ${pct(d.stale, d.withSchedule)} | ${months(d.medianMonths)} | ${d.buckets.join(' | ')} |`).join('\n')}

Nejstarší záznam: ${dateCz(t.oldest)}.${t.churches - t.withSchedule ? ` Kostelů bez rozpisu: ${t.churches - t.withSchedule}.` : ""}

## Neděle v číslech

Rejstřík uvádí ${f.sundayMasses} pravidelných nedělních mší v ${f.churchesWithSunday} kostelech. Nedělní mši v 17:00 nebo později má ${f.eveningSunday} z nich (${pct(f.eveningSunday, f.churchesWithSunday)}), sobotní mši od 16:00 ${f.saturdayEvening} (${pct(f.saturdayEvening, f.churchesWithSunday)}).

| Diecéze | nedělních mší | kostelů s nedělní mší od 17:00 | se sobotní mší od 16:00 |
| --- | --- | --- | --- |
${all.map((d) => `| ${d.name} | ${d.sundayMasses} | ${d.eveningSunday} | ${d.saturdayEvening} |`).join('\n')}

## Opravy proti rejstříku (${s.corrections.length})

Časy, které farnost ohlásila a rejstřík neuváděl, nebo uváděl a farnost je zrušila. Zdroj u každé.

${s.corrections.map((c) => `- ${dateCz(c.date)} · [${md(c.name)}](${churchUrl(c.id)})${md(where(c))}: ${md(c.change.replace(/\.$/, ""))}. Zdroj: [${md(c.sourceHost)}](${c.source}), ověřeno ${dateCz(c.checked)}.`).join('\n')}
`
}

/** The page's own styles, on top of the static pages' paper/ink/ordo CSS. */
export const LEDGER_CSS = `
      .ledger .scroll { overflow-x: auto; }
      .ledger table { width: 100%; border-collapse: collapse; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
      .ledger th, .ledger td { text-align: right; padding: 0.5rem 0.4rem; border-bottom: 1px solid #d8d0bd; vertical-align: top; }
      .ledger thead th { font-family: 'Source Sans 3', system-ui, sans-serif; font-weight: 400; color: #9a2b1e; font-variant-caps: all-small-caps; letter-spacing: 0.04em; vertical-align: bottom; }
      .ledger th[scope="row"], .ledger thead th:first-child { text-align: left; font-weight: 400; }
      .ledger tr.sum th, .ledger tr.sum td { font-weight: 600; border-bottom: 0; }
      .ledger .bar { display: flex; height: 0.6rem; margin-top: 0.35rem; min-width: 6rem; border: 1px solid #b9ae95; border-radius: 1px; }
      .ledger .bar span { display: block; height: 100%; }
      .ledger .legend { list-style: none; padding: 0; margin: 0.5rem 0; display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; }
      .ledger .sw { display: inline-block; width: 0.75rem; height: 0.75rem; margin-right: 0.35rem; vertical-align: -0.05rem; border: 1px solid #b9ae95; }
      .ledger td { white-space: nowrap; }
      .ledger .ordo .t { font-size: 1rem; }
`

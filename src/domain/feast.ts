// All Saints (1 Nov) and All Souls — Dušičky (2 Nov): the two days a year
// people most look up Mass times away from home, at their family's graves.
// Static content for /dusicky/ and /dusicky/<city>/ (scripts/prerender.mjs),
// plus a feast-day section and schema.org Events on each /kostel/<id>/ page.
// States only what the registry says for that date: weekly rows on that
// weekday whose note doesn't provably exclude it, plus one-offs dated that day.
// Node imports this via type stripping: explicit .ts specifiers.
import type { RawEntry } from './churchPage.ts'
import { parseNote } from './notes.ts'
import { isConfession, isStale, normalizeLang } from './registry.ts'
import { churchUrl, SITE_ORIGIN } from './site.ts'

export interface FeastDay {
  iso: string
  /** "neděle 1. listopadu" */
  label: string
  /** "Slavnost Všech svatých" */
  name: string
}

const WEEKDAY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'] // getUTCDay order
const DAY_MS = 86_400_000
/** Church pages carry the feast section from a month before All Saints. */
const WINDOW_DAYS = 30

const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const parseIso = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

/** The next All Saints + All Souls on or after `today` ("YYYY-MM-DD", Prague). */
export function allSaints(today: string): { year: number; days: FeastDay[] } {
  const [ty] = parseIso(today)
  const year = today > `${ty}-11-02` ? ty + 1 : ty
  const day = (d: number, name: string): FeastDay => ({
    iso: `${year}-11-0${d}`,
    label: `${WEEKDAY[new Date(Date.UTC(year, 10, d)).getUTCDay()]} ${d}. listopadu`,
    name,
  })
  return {
    year,
    days: [day(1, 'Slavnost Všech svatých'), day(2, 'Vzpomínka na všechny věrné zemřelé (Dušičky)')],
  }
}

/** Is `today` within the month before All Saints, up to All Souls? */
function inWindow(today: string): boolean {
  const { days } = allSaints(today)
  const [y, m, d] = parseIso(today)
  const [fy, fm, fd] = parseIso(days[0].iso)
  return Date.UTC(fy, fm - 1, fd) - Date.UTC(y, m - 1, d) <= WINDOW_DAYS * DAY_MS
}

export interface FeastService {
  time: string
  type: string
  lang: string
  greek: boolean
  note: string
  /** A one-off the parish entered for this date. */
  extra: boolean
  /** The note is conditional and we couldn't read it — print it, don't hide the row. */
  uncertain: boolean
}

const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  return m ? +m[1] * 60 + +m[2] : 0
}

/** What the registry says for one church on one date, chronological. */
export function servicesOn(entry: RawEntry | undefined, iso: string): FeastService[] {
  if (!entry) return []
  const [y, m, d] = parseIso(iso)
  const dow = String(new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7)
  const row = (r: RawEntry['s'][number], extra: boolean): FeastService => ({
    time: r[1].trim(),
    type: r[4].trim(),
    lang: normalizeLang(r[2]),
    greek: r[3] === 1,
    note: r[5].trim(),
    extra,
    uncertain: !extra && parseNote(r[5]).uncertain,
  })
  const extras = (entry.x ?? []).filter((r) => r[0] === iso && !isConfession(r[4])).map((r) => row(r, true))
  const weekly = entry.s
    .filter((r) => r[0].includes(dow) && !isConfession(r[4]) && parseNote(r[5]).runsOn(y, m, d))
    .map((r) => row(r, false))
    // the same service entered again as a one-off for that day — print it once;
    // a different one-off at that time (a cemetery devotion) never hides the Mass
    .filter((s) => !extras.some((x) => toMin(x.time) === toMin(s.time) && typeLabel(x.type) === typeLabel(s.type) && x.lang === s.lang && x.greek === s.greek))
  return [...weekly, ...extras].sort((a, b) => toMin(a.time) - toMin(b.time))
}

/** "mše svatá" for the registry's blank / abbreviated Mass type. */
const typeLabel = (type: string) => (!type || /^mše sv\.?$/i.test(type) ? 'mše svatá' : type)

function detail(s: FeastService): string {
  return [
    typeLabel(s.type),
    s.lang !== 'česky' ? s.lang : '',
    s.greek ? 'řeckokatolický ritus' : '',
    s.extra ? 'mimořádná, zapsaná na tento den' : '',
    s.note,
  ]
    .filter(Boolean)
    .join(' · ')
}

const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

export interface PageChurchRef {
  id: string
  name: string
  city: string
}

export interface FeastPage {
  url: string
  title: string
  description: string
  /** Safe HTML. */
  body: string
  /** JSON for a <script type="application/ld+json">, safe to inline. */
  jsonLd: string
}

const SOURCE_NOTE =
  'Časy jsou z rejstříku bohoslužeb České biskupské konference (bohosluzby.cirkev.cz), který spravují farnosti. ' +
  'O svátcích farnosti pořad často mění nebo přidávají pobožnosti na hřbitovech — ty, které farnost do rejstříku zapsala, jsou označené „mimořádná“. ' +
  'Před cestou si čas ověřte v ohláškách nebo na webu farnosti.'

/** "2026-06-01…" → "1. 6. 2026" */
function dateCz(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : ''
}

const ldSafe = (o: unknown) => JSON.stringify(o).replaceAll('<', '\\u003c')

export function feastCityPage(input: {
  /** cityPage: a prerendered /mesto/<slug>/ exists to link to (the 30 largest). */
  /** label: the display name ('Hranice (Lipník nad Bečvou)' for a namesake); name stays the municipality. */
  city: { name: string; slug: string; churches: PageChurchRef[]; cityPage?: boolean; label?: string }
  entries: Record<string, RawEntry | undefined>
  today: string
}): FeastPage & { services: number } {
  const { city, entries, today } = input
  const { year, days } = allSaints(today)
  const now = new Date(`${today}T12:00:00Z`)
  const url = `${SITE_ORIGIN}/dusicky/${city.slug}/`
  const listed = city.churches.filter((c) => entries[c.id])
  // An old entry is still the parish's own word — listed, but with its date on the row
  const staleSince = (c: PageChurchRef) =>
    isStale(entries[c.id]!.u, now) ? `rozpis ověřen naposledy ${dateCz(entries[c.id]!.u)}, ověřte u farnosti` : ''
  let churchesWithRows = 0
  // "Hrabová, Ostrava" / "Praha 1": Ostrava has two Nanebevzetí P. Marie — say which
  const quarter = (c: PageChurchRef) => {
    const q = c.city.includes(',') ? c.city.slice(0, c.city.lastIndexOf(',')).trim() : c.city.trim()
    return q && q !== city.name && !c.name.includes(q) ? q : ''
  }

  let total = 0
  const sections = days.map((day, i) => {
    const rows = listed
      .flatMap((c) => servicesOn(entries[c.id], day.iso).map((s) => ({ c, s })))
      .sort((a, b) => toMin(a.s.time) - toMin(b.s.time) || a.c.name.localeCompare(b.c.name, 'cs'))
    total += rows.length
    if (i === 0) churchesWithRows = new Set(rows.map((r) => r.c.id)).size
    const list = rows.length
      ? `<ul class="ordo">${rows
          .map(
            ({ c, s }) =>
              `<li><span class="t">${esc(s.time)}</span> <span class="n"><a href="${churchUrl(c.id)}">${esc(c.name)}</a>` +
              (quarter(c) ? `, ${esc(quarter(c))}` : '') +
              '</span>' +
              `<span class="d">${esc([detail(s), staleSince(c)].filter(Boolean).join(' · '))}</span></li>`,
          )
          .join('')}</ul>`
      : '<p>Rejstřík pro tento den v tomto městě žádnou bohoslužbu neuvádí.</p>'
    return `<h2 id="den-${i + 1}"><span class="rubric">${esc(day.label)}</span> ${esc(day.name)}</h2>\n${list}`
  })

  const shown = city.label ?? city.name
  const title = `Dušičky a Všech svatých ${year} — mše svatá ${shown} | Kam na mši`
  const description = (
    `${shown}: mše svatá na Všech svatých (${days[0].label}) a na Dušičky (${days[1].label} ${year}) — ` +
    `${total} ${plural(total, 'bohoslužba', 'bohoslužby', 'bohoslužeb')} v ${churchesWithRows} ${plural(churchesWithRows, 'kostele', 'kostelech', 'kostelech')}, podle rejstříku ČBK.`
  ).slice(0, 200)

  const body = `
      <main class="ordo-page">
        <p class="crumbs"><a href="${SITE_ORIGIN}/">Kam na mši</a> › <a href="${SITE_ORIGIN}/dusicky/">Dušičky ${year}</a></p>
        <h1>Všech svatých a Dušičky ${year}: mše svatá — ${esc(shown)}</h1>
        <p class="small">Podle rejstříku ČBK, seřazeno podle času. Skok na: <a href="#den-1">${esc(days[0].label)}</a> · <a href="#den-2">${esc(days[1].label)}</a></p>
        ${sections.join('\n        ')}
        <p class="small">${SOURCE_NOTE}</p>
        <p>${
          city.cityPage === false
            ? `<a href="${SITE_ORIGIN}/">Bohoslužby podle vaší polohy — celý týden v aplikaci</a>`
            : `<a href="${SITE_ORIGIN}/mesto/${esc(city.slug)}/">Bohoslužby ${esc(city.name)} — celý týden v aplikaci</a>`
        } · <a href="${SITE_ORIGIN}/dusicky/">Dušičky v dalších městech</a></p>
      </main>
`
  const jsonLd = ldSafe({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Kam na mši', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: `Dušičky ${year}`, item: `${SITE_ORIGIN}/dusicky/` },
      { '@type': 'ListItem', position: 3, name: shown, item: url },
    ],
  })
  return { url, title, description, body, jsonLd, services: total }
}

export function feastHubPage(input: { cities: { name: string; slug: string; count: number; label?: string }[]; today: string }): FeastPage {
  const { cities, today } = input
  const { year, days } = allSaints(today)
  const url = `${SITE_ORIGIN}/dusicky/`
  const faq: [string, string][] = [
    [
      `Kdy jsou Dušičky ${year}?`,
      `Slavnost Všech svatých připadá na ${days[0].label} ${year}, Vzpomínka na všechny věrné zemřelé (Dušičky) na ${days[1].label} ${year}.`,
    ],
    [
      'Kde najdu mši svatou na Dušičky?',
      'Pro města a obce se třemi a více kostely, pro které rejstřík na tyto dny uvádí aspoň jednu bohoslužbu, je seznam výše; každá stránka je seřazená podle času. Pro ostatní obce otevřete aplikaci Kam na mši a zvolte obec nebo povolte polohu; na stránce každého kostela je i jeho pořad na 1. a 2. listopadu.',
    ],
    [
      'Jak získat odpustky za zemřelé?',
      'Od 1. do 8. listopadu lze každý den získat plnomocné odpustky pro duše v očistci zbožnou návštěvou hřbitova spojenou s modlitbou za zemřelé; 2. listopadu také návštěvou kostela nebo kaple s modlitbou Otčenáše a Věřím v Boha. Platí obvyklé podmínky: svatá zpověď, svaté přijímání, modlitba na úmysl Svatého otce a vnitřní odpoutanost od hříchu (Enchiridion indulgentiarum, ustanovení 29).',
    ],
    ['Jsou uvedené časy přesné?', SOURCE_NOTE],
  ]
  const body = `
      <main class="ordo-page">
        <p class="crumbs"><a href="${SITE_ORIGIN}/">Kam na mši</a></p>
        <h1>Všech svatých a Dušičky ${year} — mše svatá podle měst</h1>
        <p><span class="rubric">${esc(days[0].label)}</span> ${esc(days[0].name)}<br /><span class="rubric">${esc(days[1].label)}</span> ${esc(days[1].name)}</p>
        <h2>Města</h2>
        <ul class="cities">${cities
          .map((c) => `<li><a href="${SITE_ORIGIN}/dusicky/${esc(c.slug)}/">${esc(c.label ?? c.name)}</a></li>`)
          .join('')}</ul>
        <p>Jiná obec? <a href="${SITE_ORIGIN}/">Otevřete aplikaci</a> a vyberte ji, nebo povolte polohu.</p>
        <h2>Otázky</h2>
        ${faq.map(([q, a]) => `<h3>${esc(q)}</h3>\n        <p>${esc(a)}</p>`).join('\n        ')}
      </main>
`
  const jsonLd = ldSafe({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  })
  return {
    url,
    title: `Dušičky ${year} a Všech svatých — mše svatá podle měst | Kam na mši`,
    description: `Kdy a kde je mše svatá na Všech svatých (${days[0].label}) a na Dušičky (${days[1].label} ${year}): pořad podle měst z rejstříku ČBK. Zdarma, bez reklam.`,
    body,
    jsonLd,
  }
}

/** The feast days on a /kostel/<id>/ page — only in the month before. */
export function churchFeastSection(entry: RawEntry | undefined, today: string): string {
  if (!inWindow(today)) return ''
  const { year, days } = allSaints(today)
  const parts = days.map((day) => {
    const rows = servicesOn(entry, day.iso)
    return (
      `<h3>${esc(day.label)} — ${esc(day.name)}</h3>\n` +
      (rows.length
        ? `<ul>${rows.map((s) => `<li>${esc(`${s.time} ${detail(s)}`)}</li>`).join('')}</ul>`
        : '<p>Pro tento den rejstřík neuvádí žádnou bohoslužbu.</p>')
    )
  })
  return `<h2>Všech svatých a Dušičky ${year}</h2>\n${parts.join('\n')}`
}

export interface FeastEvent {
  '@type': 'Event'
  name: string
  startDate: string
  eventAttendanceMode: string
  location: { '@type': 'Church'; name: string; url: string }
}

/** schema.org Events for the feast-day services (Prague is UTC+1 in November). */
export function feastEvents(entry: RawEntry | undefined, today: string, place: { name: string; url: string }): FeastEvent[] {
  if (!inWindow(today)) return []
  return allSaints(today).days.flatMap((day) =>
    servicesOn(entry, day.iso)
      .filter((s) => /^\d{1,2}:\d{2}$/.test(s.time))
      .map((s) => ({
        '@type': 'Event' as const,
        name: `${typeLabel(s.type)} — ${day.name}`,
        startDate: `${day.iso}T${s.time.padStart(5, '0')}+01:00`,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Church' as const, name: place.name, url: place.url },
      })),
  )
}

/** The static feast pages boot no app, so they count their own visit: one
 * first-party page_view into the shared events table, the same ids the app
 * uses (fw:vid / fw:sid). Nothing when the build has no Supabase config. */
export function feastBeacon(supabaseUrl: string | undefined, key: string | undefined): string {
  if (!supabaseUrl || !key) return ''
  const cfg = JSON.stringify({ u: `${supabaseUrl.replace(/\/$/, '')}/rest/v1/events`, k: key }).replaceAll('<', '\\u003c')
  return (
    `<script>(()=>{try{const c=${cfg};` +
    `const id=(s,n)=>{try{let v=s.getItem(n);if(!v){v=crypto.randomUUID();s.setItem(n,v)}return v}catch(e){return crypto.randomUUID()}};` +
    `let ref=null;try{const b=h=>h.replace(/^www\\./,'');const h=b(new URL(document.referrer).hostname);if(h&&h!==b(location.host))ref=h}catch(e){}` +
    `fetch(c.u,{method:'POST',keepalive:true,headers:{apikey:c.k,authorization:'Bearer '+c.k,'content-type':'application/json',prefer:'return=minimal'},` +
    `body:JSON.stringify({app:'bohosluzby',event:'page_view',props:{route:'feast',feast:'dusicky',path:location.pathname,ref:ref,platform:'web'},` +
    `visitor_id:id(localStorage,'fw:vid'),session_id:id(sessionStorage,'fw:sid'),flywheel_uid:null,created_at:new Date().toISOString()})}).catch(()=>{})}catch(e){}})()</script>`
  )
}

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
import { DIOCESES } from './diocese.ts'

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

export interface HubTown {
  name: string
  slug: string
  count: number
  /** 'Hranice (Lipník nad Bečvou)' for a namesake. */
  label?: string
  /** Centroid of the town's churches. */
  lat: number
  lng: number
  /** DIOCESES key (diocese.ts); '' when unknown. */
  diocese: string
}

// The hub map: a flat projection of Czechia (longitude shrunk by cos 49.8°,
// close enough at this size), built at build time — no tiles, no script.
const MAP_W = 1000
const LNG0 = 12.03
const LNG1 = 18.92
const LAT0 = 48.5
const LAT1 = 51.11
const KX = Math.cos((49.8 * Math.PI) / 180)
const SCALE = MAP_W / ((LNG1 - LNG0) * KX)
const MAP_H = Math.round((LAT1 - LAT0) * SCALE)
const px = (lng: number) => Math.round((lng - LNG0) * KX * SCALE * 10) / 10
const MAP_NAMES = ['Praha', 'Plzeň', 'České Budějovice', 'Hradec Králové', 'Litoměřice', 'Brno', 'Olomouc', 'Ostrava']
const py = (lat: number) => Math.round((LAT1 - lat) * SCALE * 10) / 10

/** The SVG map: the border, one linked dot per town, the largest few named.
 * aria-hidden: the list below carries every link, the dots only repeat it. */
export function feastHubMap(towns: HubTown[], border: [number, number][]): string {
  const outline = border.length
    ? `<path class="land" d="M${border.map(([lng, lat]) => `${px(lng)} ${py(lat)}`).join('L')}Z"/>`
    : ''
  // small towns drawn last, on top: a big town's dot never swallows its neighbour
  const bySize = [...towns].sort((a, b) => b.count - a.count)
  const dots = bySize
    .map((t) => {
      const r = Math.round((4.5 + Math.min(4, Math.sqrt(t.count) / 2)) * 10) / 10
      return (
        `<a href="${SITE_ORIGIN}/dusicky/${esc(t.slug)}/" data-s="${esc(t.slug)}" tabindex="-1">` +
        `<title>${esc(t.label ?? t.name)}</title>` +
        `<circle class="hit" cx="${px(t.lng)}" cy="${py(t.lat)}" r="16"/>` +
        `<circle class="dot" cx="${px(t.lng)}" cy="${py(t.lat)}" r="${r}"/></a>`
      )
    })
    .reverse()
    .join('')
  // the regional capitals with a see, for orientation; only those that have a page
  const names = MAP_NAMES.map((n) => towns.find((t) => (t.label ?? t.name) === n))
    .filter((t): t is HubTown => !!t)
    .map((t) => `<text x="${px(t.lng)}" y="${py(t.lat) - 16}">${esc(t.name)}</text>`)
    .join('')
  return (
    `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" aria-hidden="true" focusable="false">${outline}` +
    `<g class="towns">${dots}</g><g class="names">${names}</g>` +
    `<circle id="me" r="9" cx="-50" cy="-50"/></svg>`
  )
}

// Search-as-you-type and "Podle mé polohy" on the static hub. Plain ES2015,
// no lookbehind (iOS 15), nothing sent anywhere: the position stays in the page.
const HUB_SCRIPT = `(function(){
var f=document.getElementById('finder');if(!f)return;f.hidden=false;
var q=document.getElementById('najdi'),btn=document.getElementById('poloha'),stav=document.getElementById('stav'),
groups=document.getElementById('dieceze'),near=document.getElementById('blizko'),nic=document.getElementById('nic'),
svg=document.querySelector('.map svg'),me=document.getElementById('me');
var items=[].slice.call(groups.querySelectorAll('li[data-k]')),nearItems=[],dots={},pos=null,last=null,asking=false;
[].forEach.call(svg.querySelectorAll('a[data-s]'),function(a){dots[a.getAttribute('data-s')]=a});
function fold(s){return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim()}
function km(a,b,c,d){var r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2);return 12742*Math.asin(Math.sqrt(x*x+Math.cos(a*r)*Math.cos(c*r)*y*y))}
function render(){
var v=fold(q.value),hits=0,list=pos?nearItems:items;
if(svg.classList)svg.classList.toggle('q',!!v);
list.forEach(function(li){var ok=!v||li.getAttribute('data-k').indexOf(v)>=0;li.hidden=!ok;if(ok)hits++;
var d=dots[li.getAttribute('data-s')];if(d&&d.classList)d.classList.toggle('on',!!v&&ok)});
[].forEach.call(groups.querySelectorAll('section'),function(s){s.hidden=!pos&&!!v&&!s.querySelector('li:not([hidden])')});
groups.hidden=!!pos;near.hidden=!pos;nic.hidden=hits>0}
q.addEventListener('input',render);
function sortBy(p){
pos=p;
if(!nearItems.length||last!==p){last=p;near.textContent='';nearItems=items.map(function(li){
return{li:li,d:km(p.lat,p.lng,+li.getAttribute('data-lat'),+li.getAttribute('data-lng'))}}).sort(function(a,b){return a.d-b.d}).map(function(o){
var li=document.createElement('li');li.setAttribute('data-k',o.li.getAttribute('data-k'));li.setAttribute('data-s',o.li.getAttribute('data-s'));
li.appendChild(o.li.querySelector('a').cloneNode(true));var s=document.createElement('span');s.className='km';
s.textContent=(o.d<9.95?o.d.toFixed(1).replace('.',','):Math.round(o.d))+'\\u00a0km';li.appendChild(s);near.appendChild(li);return li})}
var x=(p.lng-${LNG0})*${KX.toFixed(6)}*${SCALE.toFixed(3)},y=(${LAT1}-p.lat)*${SCALE.toFixed(3)};
if(x>0&&x<${MAP_W}&&y>0&&y<${MAP_H}){me.setAttribute('cx',x.toFixed(1));me.setAttribute('cy',y.toFixed(1))}
btn.textContent='Podle diecézí';stav.textContent='Seřazeno podle vzdálenosti od vás. Poloha zůstává v telefonu, nikam ji neposíláme.';render()}
btn.addEventListener('click',function(){
if(pos){pos=null;btn.textContent='Podle mé polohy';stav.textContent='';me.setAttribute('cx','-50');render();return}
if(last){sortBy(last);return}
if(asking)return;
if(!navigator.geolocation){stav.textContent='Tento prohlížeč polohu neumí. Najděte obec podle názvu.';return}
stav.textContent='Zjišťuji polohu…';asking=true;
navigator.geolocation.getCurrentPosition(function(g){asking=false;sortBy({lat:g.coords.latitude,lng:g.coords.longitude})},
function(e){asking=false;stav.textContent=e&&e.code===1?'Poloha není povolená. Najděte obec podle názvu.':'Polohu se nepodařilo zjistit. Najděte obec podle názvu.'},
{enableHighAccuracy:false,timeout:15000,maximumAge:600000})});
})()`

const foldKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function feastHubPage(input: { cities: HubTown[]; today: string; border?: [number, number][] }): FeastPage {
  const { cities, today, border = [] } = input
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
  const label = (c: HubTown) => c.label ?? c.name
  const item = (c: HubTown) =>
    `<li data-s="${esc(c.slug)}" data-k="${esc(foldKey(label(c)))}" data-lat="${c.lat.toFixed(4)}" data-lng="${c.lng.toFixed(4)}">` +
    `<a href="${SITE_ORIGIN}/dusicky/${esc(c.slug)}/">${esc(label(c))}</a></li>`
  const groups = [...DIOCESES, { key: '', name: 'Ostatní', area: '' }]
    .map((d) => ({ d, towns: cities.filter((c) => (DIOCESES.some((x) => x.key === c.diocese) ? c.diocese : '') === d.key) }))
    .filter((g) => g.towns.length)
    .map(
      ({ d, towns }) =>
        `<section data-d="${esc(d.key)}"><h3>${esc(d.name)}</h3>${d.area ? `<p class="small area">${esc(d.area)}</p>` : ''}` +
        `<ul class="cities">${[...towns].sort((a, b) => label(a).localeCompare(label(b), 'cs')).map(item).join('')}</ul></section>`,
    )
    .join('\n        ')
  const body = `
      <main class="ordo-page">
        <p class="crumbs"><a href="${SITE_ORIGIN}/">Kam na mši</a></p>
        <h1>Všech svatých a Dušičky ${year} — mše svatá podle měst</h1>
        <p><span class="rubric">${esc(days[0].label)}</span> ${esc(days[0].name)}<br /><span class="rubric">${esc(days[1].label)}</span> ${esc(days[1].name)}</p>
        <figure class="map">${feastHubMap(cities, border)}
          <figcaption class="small">${cities.length} ${plural(cities.length, 'obec', 'obce', 'obcí')} se stránkou na Dušičky. Klepněte na tečku, nebo obec najděte níže.</figcaption>
        </figure>
        <h2 id="obce">Obce podle diecézí</h2>
        <div id="finder" class="finder" hidden>
          <label for="najdi">Najdi obec</label>
          <div class="row"><input id="najdi" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="např. Jihlava" /><button type="button" id="poloha">Podle mé polohy</button></div>
          <p id="stav" class="small" aria-live="polite"></p>
        </div>
        <div id="dieceze">
        ${groups}
        </div>
        <ol id="blizko" class="near" hidden></ol>
        <p id="nic" hidden>Tahle obec vlastní stránku na Dušičky nemá. <a href="${SITE_ORIGIN}/">Otevřete aplikaci</a> a vyberte ji, nebo povolte polohu.</p>
        <p>Jiná obec? <a href="${SITE_ORIGIN}/">Otevřete aplikaci</a> a vyberte ji, nebo povolte polohu.</p>
        <h2>Otázky</h2>
        ${faq.map(([q, a]) => `<h3>${esc(q)}</h3>\n        <p>${esc(a)}</p>`).join('\n        ')}
        <p class="small">Hranice státu: Natural Earth (public domain).</p>
      </main>
      <script>${HUB_SCRIPT}</script>
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
 * uses (fw:vid / fw:sid), tagged static:true. Skips crawlers and automation.
 * Nothing when the build has no Supabase config. */
export function feastBeacon(supabaseUrl: string | undefined, key: string | undefined): string {
  if (!supabaseUrl || !key) return ''
  const cfg = JSON.stringify({ u: `${supabaseUrl.replace(/\/$/, '')}/rest/v1/events`, k: key }).replaceAll('<', '\\u003c')
  return (
    `<script>(()=>{try{const c=${cfg};const n=navigator;` +
    // same rule as isLikelyBot (lib/telemetry.ts): crawlers and automation are not visitors
    `if(n.webdriver||/(?:^|[^u])bot\\b|crawl|spider|slurp|headless|lighthouse|prerender|pagespeed|inspectiontool|googleother|facebookexternalhit|embedly|preview/i.test(n.userAgent||''))return;` +
    `const rUID=()=>crypto.randomUUID?.()??Array.from({length:8},()=>Math.floor(Math.random()*0x10000).toString(16).padStart(4,'0')).join('-');` +
    `const id=(s,n)=>{try{let v=s.getItem(n);if(!v){v=rUID();s.setItem(n,v)}return v}catch(e){return rUID()}};` +
    `let ref=null;try{const b=h=>h.replace(/^www\\./,'');const h=b(new URL(document.referrer).hostname);if(h&&h!==b(location.host))ref=h}catch(e){}` +
    `fetch(c.u,{method:'POST',keepalive:true,headers:{apikey:c.k,authorization:'Bearer '+c.k,'content-type':'application/json',prefer:'return=minimal'},` +
    `body:JSON.stringify({app:'bohosluzby',event:'page_view',props:{route:'feast',feast:'dusicky',path:location.pathname,static:true,ref:ref,platform:'web'},` +
    `visitor_id:id(localStorage,'fw:vid'),session_id:id(sessionStorage,'fw:sid'),flywheel_uid:null,created_at:new Date().toISOString()})}).catch(()=>{})}catch(e){}})()</script>`
  )
}

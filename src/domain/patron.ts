// Mechanic B (docs/SIGNATURE.md): the title of a church (CIC can. 1218) and
// the day it is celebrated — in a Czech village, the pouť. The Schematismus
// printed it for every church; the registry has it only inside the name, so
// we read it from there. Only titles with one unambiguous date in the Czech
// calendar are listed: a wrong date is worse than none ("sv. Jakuba" alone
// could be Starší 25. 7. or Mladší 3. 5.; a bare "Panny Marie" is no feast).
// Node imports this via type stripping: explicit .ts specifiers.
import { easterSunday } from './liturgical.ts'

export interface Patron {
  /** "svátek sv. Václava" — reads after "titulární svátek:" and in running text. */
  title: string
  /** "9-28" for a fixed date; absent for the Easter-dependent ones. */
  fixed?: string
  /** Days after Easter Sunday, for the movable ones. */
  easter?: number
}

// [match on the normalised name, title, month-day | days after Easter]; most specific first
const TITLES: [RegExp, string, string | number][] = [
  [/stětí sv\. jana křtitele/, 'památka Umučení sv. Jana Křtitele', '8-29'],
  [/(narození )?(sv\. )?jana křtitele/, 'slavnost Narození sv. Jana Křtitele', '6-24'],
  [/sv\. jana nepomuckého/, 'svátek sv. Jana Nepomuckého', '5-16'],
  [/sv\. jana evangelisty/, 'svátek sv. Jana, apoštola a evangelisty', '12-27'],
  [/nanebevzetí panny marie/, 'slavnost Nanebevzetí Panny Marie', '8-15'],
  [/narození panny marie/, 'svátek Narození Panny Marie', '9-8'],
  [/neposkvrněného početí panny marie/, 'slavnost Panny Marie, počaté bez poskvrny prvotního hříchu', '12-8'],
  [/panny marie bolestné/, 'památka Panny Marie Bolestné', '9-15'],
  [/panny marie sněžné/, 'památka Posvěcení římské baziliky Panny Marie', '8-5'],
  [/panny marie růžencové/, 'památka Panny Marie Růžencové', '10-7'],
  [/panny marie lurdské/, 'památka Panny Marie Lurdské', '2-11'],
  [/jména panny marie/, 'památka Jména Panny Marie', '9-12'],
  [/zvěstování (páně|panny marie|panně marii)/, 'slavnost Zvěstování Páně', '3-25'],
  [/proměnění páně/, 'svátek Proměnění Páně', '8-6'],
  [/povýšení sv\. kříže/, 'svátek Povýšení svatého Kříže', '9-14'],
  [/všech svatých/, 'slavnost Všech svatých', '11-1'],
  [/andělů strážných/, 'památka svatých andělů strážných', '10-2'],
  [/nejsvětější trojice/, 'slavnost Nejsvětější Trojice', 56],
  [/(božského|nejsvětějšího) srdce (páně|ježíšova)/, 'slavnost Nejsvětějšího Srdce Ježíšova', 68],
  [/(seslání )?sv\. ducha/, 'slavnost Seslání Ducha Svatého', 49],
  [/nanebevstoupení páně/, 'slavnost Nanebevstoupení Páně', 39],
  [/sv\. petra a pavla/, 'slavnost sv. Petra a Pavla', '6-29'],
  [/sv\. cyrila a metoděje/, 'slavnost sv. Cyrila a Metoděje', '7-5'],
  [/sv\. filipa a jakuba/, 'svátek sv. Filipa a Jakuba', '5-3'],
  [/sv\. šimona a judy/, 'svátek sv. Šimona a Judy', '10-28'],
  [/sv\. jakuba (staršího|většího)/, 'svátek sv. Jakuba Staršího', '7-25'],
  [/sv\. václava/, 'svátek sv. Václava', '9-28'],
  [/sv\. bartoloměje/, 'svátek sv. Bartoloměje', '8-24'],
  [/sv\. mikuláše/, 'památka sv. Mikuláše', '12-6'],
  [/sv\. martina/, 'památka sv. Martina', '11-11'],
  [/sv\. vavřince/, 'svátek sv. Vavřince', '8-10'],
  [/sv\. anny/, 'památka sv. Jáchyma a Anny', '7-26'],
  [/sv\. jiří/, 'památka sv. Jiří', '4-24'],
  [/sv\. jiljí/, 'památka sv. Jiljí', '9-1'],
  [/sv\. prokopa/, 'památka sv. Prokopa', '7-4'],
  [/sv\. kateřiny/, 'památka sv. Kateřiny Alexandrijské', '11-25'],
  [/sv\. floriána/, 'památka sv. Floriána', '5-4'],
  [/sv\. josefa/, 'slavnost sv. Josefa', '3-19'],
  [/sv\. havla/, 'památka sv. Havla', '10-16'],
  [/sv\. antonína paduánského/, 'památka sv. Antonína z Padovy', '6-13'],
  [/sv\. víta/, 'památka sv. Víta', '6-15'],
  [/sv\. michaela/, 'svátek sv. Michaela archanděla', '9-29'],
  [/sv\. barbory/, 'památka sv. Barbory', '12-4'],
  [/sv\. ondřeje/, 'svátek sv. Ondřeje', '11-30'],
  [/sv\. vojtěcha/, 'svátek sv. Vojtěcha', '4-23'],
  [/sv\. (marie|maří|máří) magdalény/, 'svátek sv. Marie Magdalény', '7-22'],
  [/sv\. matouše/, 'svátek sv. Matouše', '9-21'],
  [/sv\. ludmily/, 'památka sv. Ludmily', '9-16'],
  [/sv\. štěpána/, 'svátek sv. Štěpána', '12-26'],
  [/sv\. marka/, 'svátek sv. Marka', '4-25'],
  [/sv\. františka z assisi/, 'památka sv. Františka z Assisi', '10-4'],
  [/sv\. karla boromejského/, 'památka sv. Karla Boromejského', '11-4'],
  [/sv\. hedviky/, 'památka sv. Hedviky', '10-16'],
  [/sv\. zdislavy/, 'památka sv. Zdislavy', '5-30'],
  [/sv\. klementa/, 'památka sv. Klementa', '11-23'],
  [/sv\. alžběty uherské/, 'památka sv. Alžběty Uherské', '11-17'],
]

const normalise = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\bp\. marie/g, 'panny marie')
    .replace(/svat(ého|é) /g, 'sv. ')
    .replace(/sv\. (\S+) a sv\. /g, 'sv. $1 a ')
    .replace(/sv\. michala/g, 'sv. michaela')
    .replace(/magdalen[ya]/g, 'magdalény')
    .replace(/sv\. stětí /g, 'stětí sv. ')

// What may stand before the title: the kind of building and its status.
const BUILDING = new Set([
  'kostel', 'kostelík', 'kaple', 'katedrála', 'konkatedrála', 'bazilika', 'chrám', 'rotunda', 'minor',
  'farní', 'filiální', 'klášterní', 'poutní', 'hřbitovní', 'děkanský', 'proboštský', 'zámecký',
  'kapitulní', 'bývalý', 'špitální', 'zámecká',
])

export function patronOf(name: string): Patron | null {
  // the place after the comma is not part of the title
  const n = normalise(name.split(',')[0])
  for (const [re, title, when] of TITLES) {
    const m = re.exec(n)
    if (!m) continue
    // the title must be the church's only one: nothing but the building kind
    // before it, and no "… a sv. X" / "s kaplí …" after it — which of two
    // titles is the church's own is not ours to guess
    const before = n.slice(0, m.index).replace(/[()]/g, ' ').split(/\s+/).filter(Boolean)
    if (!before.every((w) => BUILDING.has(w))) continue
    if (/^\s+(a|s|se)\s/.test(n.slice(m.index + m[0].length))) return null
    return typeof when === 'number' ? { title, easter: when } : { title, fixed: when }
  }
  return null
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const DAY = 86_400_000
const isSunday = (t: number) => new Date(t).getUTCDay() === 0

/** The three titles here that the General Norms move when they collide:
 * Annunciation in Holy Week or the Easter Octave → Monday after the 2nd
 * Sunday of Easter, on a Sunday of Lent → Monday; St Joseph in Holy Week →
 * the Saturday before Palm Sunday, on a Sunday of Lent → Monday; 8 Dec on a
 * Sunday of Advent → Monday. */
function transferred(md: string, t: number, easter: number): number {
  const palm = easter - 7 * DAY
  if (md === '3-25') {
    if (t >= palm && t <= easter + 7 * DAY) return easter + 8 * DAY
    return isSunday(t) ? t + DAY : t
  }
  if (md === '3-19') {
    if (t >= palm && t < easter) return palm - DAY
    return isSunday(t) ? t + DAY : t
  }
  if (md === '12-8') return isSunday(t) ? t + DAY : t
  return t
}

/** The next celebration on or after `today` ("YYYY-MM-DD"). */
export function nextPatronDate(p: Patron, today: string): string {
  const y = Number(today.slice(0, 4))
  const on = (year: number) => {
    const e = easterSunday(year)
    const easter = Date.UTC(year, e.month - 1, e.day)
    if (!p.fixed) return iso(easter + (p.easter ?? 0) * DAY)
    const [m, d] = p.fixed.split('-').map(Number)
    return iso(transferred(p.fixed, Date.UTC(year, m - 1, d), easter))
  }
  return on(y) >= today ? on(y) : on(y + 1)
}

const MONTH_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince']

/** "28. září" (fixed) or "23. 5. 2027" (movable — the date moves with Easter). */
export function patronDateLabel(p: Patron, today: string): string {
  const next = nextPatronDate(p, today)
  const [y, m, d] = next.split('-').map(Number)
  return p.fixed ? `${d}. ${MONTH_GEN[m - 1]}` : `${d}. ${m}. ${y}`
}

/** Titles the name alone leaves open ("sv. Jakuba", two titles, Navštívení
 * P. M. — 2 Jul in the Czech calendar, 31 May in the universal one), settled
 * by the parish's own website or bulletin (Pavol 2026-10-30: "Explore parish
 * sites of the ambiguous ones"). id → [title, month-day, source URL]. The
 * verbatim quote and check date for each live in data/patron-sources.json;
 * patron.test.ts keeps the two in step. No source, no entry: nothing shown. */
export const PARISH_TITLES: Record<string, [string, string, string]> = {
  '1000353': ['svátek Navštívení Panny Marie', '5-31', 'https://www.farnoststechovice.cz/wp-content/uploads/2025/12/Planfarnosti_2026.pdf'], // kaple Navštívení Panny Marie, Davle
  '1000726': ['svátek Navštívení Panny Marie', '7-2', 'http://www.rkfrakovnik.cz/pout-v-petrovicich/'], // farní kostel Navštívení Panny Marie, Petrovice u Rakovníka
  '2000316': ['svátek Navštívení Panny Marie', '7-2', 'https://www.farnosthejnice.cz/2026/05/15/hejnicka-poutni-mse-patrocinium/'], // farní kostel Navštívení Panny Marie, Hejnice
  '2000453': ['svátek sv. Jakuba Staršího', '7-25', 'http://www.farnostlouny.com/index.php?id=8'], // farní kostel sv. Jakuba apoštola, Cítoliby
  '2000573': ['svátek sv. Jakuba Staršího', '7-25', 'https://dekanstvimh.cz/poutni-slavnost-ke-cti-sv-jakuba-a-sv-anny-do-mn-hradiste-nedele-28-cervence/'], // děkanský kostel sv. Jakuba apoštola, Mnichovo Hradiště
  '200069': ['svátek Navštívení Panny Marie', '7-2', 'https://farnostbozkov.cz/2013/07/07/pout-ke-kralovne-hor/'], // farní kostel Navštívení Panny Marie, Bozkov
  '30001021059087': ['svátek Navštívení Panny Marie', '5-31', 'https://farnostbousin.cz/bohosluzby/'], // farní kostel Navštívení Panny Marie
  '30003227384806': ['slavnost Nanebevzetí Panny Marie', '8-15', 'https://sedlec.info/ohlasky/437/'], // farní kostel Nanebevzetí Panny Marie a sv. Jana Křtitele
  '30003645000453': ['svátek Narození Panny Marie', '9-8', 'http://www.farnostzeliv.cz'], // opatský a farní kostel Narození Panny Marie
  '4000850126195': ['svátek sv. Jana Nepomuckého', '5-16', 'https://farnostkaplice.cz/2023.pdf'], // filiální kostel Panny Marie Bolestné a sv. Jana Nepomuckého
  '50002050314628': ['svátek sv. Jakuba Staršího', '7-25', 'https://doo.cz/2026/09/07/fotogalerie-v-libhosti-oslavili-250-let-kostela/'], // farní kostel sv. Jakuba
  '50002078022509': ['svátek Navštívení Panny Marie', '5-31', 'https://www.farnostodry.cz/misto/farni-kostel-navstiveni-p-marie-mankovice-2866'], // farní kostel Navštívení P. Marie
  '50002237542694': ['svátek Navštívení Panny Marie', '5-31', 'https://www.farnost-spalov.cz/wp-content/uploads/2026/05/Ohlasky_2026-05-24_o.pdf'], // farní kostel Navštívení P. Marie
  '50003474315039': ['svátek Navštívení Panny Marie', '5-31', 'http://farnost-domaslavice.webnode.cz/menu/'], // filiální kostel Navštívení P. Marie
  '5000368960041': ['svátek Navštívení Panny Marie', '5-31', 'https://farnostdobra.cz/'], // kaple Navštívení P. Marie
  '60002871972936': ['svátek sv. Šimona a Judy', '10-28', 'https://www.farnostdysina.cz/blog/2026/10/29/pout-ktera-zapustila-koreny-28-10-2026/'], // farní kostel Nejsvětější Trojice a sv. Šimona a Judy Dýšina
  '60003999141812': ['svátek sv. Jakuba Staršího', '7-25', 'http://farnostkraslice.estranky.cz/clanky/poute---feste-v-kraslicke-farnosti-v-kalendarnim-roce/poutni-slavnosti-ve-farnosti-2026.html'], // filiální kostel sv. Jakuba Sněžná
  '70001082828364': ['slavnost Nanebevzetí Panny Marie', '8-15', 'https://kyjov.farnost.cz/blog_clanek/farni-kostel-zdobi-dve-nove-vitraze-26109'], // farní kostel Nanebevzetí Panny Marie a sv. Cyrila a Metoděje
  '70001610901718': ['svátek Navštívení Panny Marie', '7-2', 'http://zasova.net/archiv_poradu_bohosluzeb?porad=Q1g1ZTV0YzBRU2htY2pzcVlTY1EvQT09Ojpa7JiyBRdv3J98qrEeUk8N&t=TjY4bTlMY0tsYmtBWTA4QXFTMUJVRTdCRUxsWHZnemhibDM5MW1XRVczZz06OskWB643oOFdwhiribBihK0%3D'], // farní kostel Navštívení Panny Marie
  '70001825863035': ['svátek Navštívení Panny Marie', '5-31', 'http://farnostvelehrad.cz/clanek/kaple-navstiveni-panny-marie-v-tupesich-5695'], // kaple Navštívení Panny Marie
  '7000303200716': ['svátek Navštívení Panny Marie', '7-2', 'http://www.farnostsuchdol.eu/images/pvf-year01736.jpg'], // farní kostel Navštívení Panny Marie
  '70003039211055': ['svátek Navštívení Panny Marie', '5-31', 'https://www.farnost-trnava.cz/index.php/2026/05/26/trnavska-pout-31-5-2026/'], // farní kostel Navštívení Panny Marie
  '70003306529547': ['svátek Navštívení Panny Marie', '5-31', 'http://svatykopecek.cz/PageDecision.asp?ID=115'], // farní kostel Navštívení Panny Marie - bazilika minor
  '70003995026689': ['památka sv. Floriána', '5-4', 'https://www.farnost-senice.cz/2026/05/03/slavime-5-nedeli-velikonocni-14/'], // kaple sv. Floriána a Isidora
  '80001285799546': ['svátek sv. Jakuba Staršího', '7-25', 'https://www.farnostbrankovice.cz/2026/07/23/fain-leto-2026/'], // kostel farní sv. Jakuba 
  '8000177625842': ['slavnost sv. Cyrila a Metoděje', '7-5', 'https://www.farnostbrankovice.cz/wp/wp-content/uploads/2022/10/fain_brankovice_15_03.pdf'], // kostel filiální Všech svatých  a sv. Cyrila a Metoděje
  '80001978461163': ['památka sv. Aloise Gonzagy', '6-21', 'http://www.otnice.9e.cz/2013/09/2012/'], // kostel farní sv. Aloise a sv. Havla
  '80003287724522': ['svátek sv. Jakuba Staršího', '7-25', 'https://www.svatyjakub.cz/program-o-prazdninach-2026/'], // kostel farní sv. Jakuba
  '80003291841355': ['svátek Navštívení Panny Marie', '7-2', 'http://www.farnostlomnice.cz/clanky/aktualne/dobre-zpravy/poute-2026.html'], // kostel farní Navštívení Panny Marie
  '80003795866278': ['slavnost Narození sv. Jana Křtitele', '6-24', 'https://www.faby.cz/akce-pozvanky/pripravujeme/748-kalendar-hlavnich-akci-v-roce-2026.html'], // kostel farní sv. Jana Křtitele a sv. Jana Evangelisty
  '8000515450433': ['svátek Navštívení Panny Marie', '5-31', 'http://www.farnostbabice.com/inpage/bohosluzby-438/'], // kostel farní Navštívení Panny Marie
  '8000567053899': ['svátek sv. Václava', '9-28', 'http://farnostlouka.cz/aktuality/7/'], // kostel farní sv. Václava a Panny Marie
}

/** The church's title feast: from its name, else from a parish source. */
export function patronOfChurch(church: { id: string; name: string }): Patron | null {
  const named = patronOf(church.name)
  if (named) return named
  const p = PARISH_TITLES[church.id]
  return p ? { title: p[0], fixed: p[1] } : null
}

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
  [/zvěstování (páně|panny marie)/, 'slavnost Zvěstování Páně', '3-25'],
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
  [/sv\. (marie|maří) magdalény/, 'svátek sv. Marie Magdalény', '7-22'],
  [/sv\. matouše/, 'svátek sv. Matouše', '9-21'],
  [/sv\. ludmily/, 'památka sv. Ludmily', '9-16'],
  [/sv\. štěpána/, 'svátek sv. Štěpána', '12-26'],
  [/sv\. marka/, 'svátek sv. Marka', '4-25'],
  [/sv\. františka z assisi/, 'památka sv. Františka z Assisi', '10-4'],
  [/sv\. karla boromejského/, 'památka sv. Karla Boromejského', '11-4'],
  [/sv\. hedviky/, 'památka sv. Hedviky', '10-16'],
  [/sv\. zdislavy/, 'památka sv. Zdislavy', '5-30'],
  [/sv\. klementa/, 'památka sv. Klementa', '11-23'],
]

const normalise = (name: string) =>
  name
    .toLowerCase()
    .replace(/\bp\. marie/g, 'panny marie')
    .replace(/svat(ého|é) /g, 'sv. ')
    .replace(/sv\. (\S+) a sv\. /g, 'sv. $1 a ')
    .replace(/sv\. michala/g, 'sv. michaela')
    .replace(/magdalen[ya]/g, 'magdalény')

export function patronOf(name: string): Patron | null {
  const n = normalise(name)
  for (const [re, title, when] of TITLES) {
    if (!re.test(n)) continue
    return typeof when === 'number' ? { title, easter: when } : { title, fixed: when }
  }
  return null
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

/** The next celebration on or after `today` ("YYYY-MM-DD"). */
export function nextPatronDate(p: Patron, today: string): string {
  const y = Number(today.slice(0, 4))
  const on = (year: number) => {
    if (p.fixed) {
      const [m, d] = p.fixed.split('-').map(Number)
      return iso(Date.UTC(year, m - 1, d))
    }
    const e = easterSunday(year)
    return iso(Date.UTC(year, e.month - 1, e.day) + (p.easter ?? 0) * 86_400_000)
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

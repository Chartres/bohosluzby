// Liturgical season → color, computed client-side (Roman rite, CZ calendar).
// The app's accent follows the church year (docs/DESIGN-BRIEF.md):
//   green  — ordinary time
//   violet — Advent, Lent
//   gold   — Christmas & Easter seasons, non-martyr solemnities (white/gold)
//   red    — Palm Sunday, Good Friday, Pentecost, martyrs (sv. Václav…)
//
// Boundaries used (simplified to day granularity, sufficient for an accent color):
//   Advent      = 4th Sunday before Christmas … 24 Dec
//   Christmas   = 25 Dec … Baptism of the Lord (Sunday after 6 Jan)
//   Lent        = Ash Wednesday (Easter − 46) … Holy Saturday
//   Easter      = Easter Sunday … Pentecost (Easter + 49)
//   Ordinary    = the rest
// Fixed-date CZ solemnities override the running season's color.

export type Season = 'advent' | 'christmas' | 'lent' | 'easter' | 'ordinary'
export type LiturgicalColor = 'green' | 'violet' | 'gold' | 'red'

export interface LiturgicalDay {
  season: Season
  color: LiturgicalColor
  /** Solemnity/feast name for the highlighted days (CZ calendar), e.g. "sv. Václava". */
  feast?: string
}

/** Gregorian Easter Sunday (anonymous/Meeus computus). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

// Day-precision date math on UTC timestamps (no TZ concerns at this granularity).
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d)
const DAY = 86_400_000
const dow = (t: number) => new Date(t).getUTCDay() // 0 = Sunday

// Fixed-date solemnities/feasts that override the season color (CZ calendar).
const FIXED: Record<string, { color: LiturgicalColor; feast: string }> = {
  '1-6': { color: 'gold', feast: 'Zjevení Páně' },
  '6-29': { color: 'red', feast: 'sv. Petra a Pavla' }, // martyrs
  '7-5': { color: 'gold', feast: 'sv. Cyrila a Metoděje' }, // CZ solemnity
  '8-15': { color: 'gold', feast: 'Nanebevzetí Panny Marie' },
  '9-28': { color: 'red', feast: 'sv. Václava' }, // martyr, CZ solemnity
  '11-1': { color: 'gold', feast: 'Všech svatých' },
  '12-8': { color: 'gold', feast: 'Neposkvrněného početí Panny Marie' },
  '12-25': { color: 'gold', feast: 'Narození Páně' },
}

export function liturgicalDay(year: number, month: number, day: number): LiturgicalDay {
  const t = utc(year, month, day)
  const easter = easterSunday(year)
  const easterT = utc(year, easter.month, easter.day)
  const fixed = FIXED[`${month}-${day}`]

  // Movable days from the computus
  if (t === easterT - 7 * DAY) return { season: 'lent', color: 'red', feast: 'Květná neděle' }
  if (t === easterT - 2 * DAY) return { season: 'lent', color: 'red', feast: 'Velký pátek' }
  if (t === easterT) return { season: 'easter', color: 'gold', feast: 'Zmrtvýchvstání Páně' }
  if (t === easterT + 39 * DAY) return { season: 'easter', color: 'gold', feast: 'Nanebevstoupení Páně' }
  if (t === easterT + 49 * DAY) return { season: 'easter', color: 'red', feast: 'Seslání Ducha svatého' }
  if (t === easterT + 60 * DAY) return { season: 'ordinary', color: 'gold', feast: 'Těla a krve Páně' } // Boží Tělo

  if (t >= easterT - 46 * DAY && t < easterT) return { season: 'lent', color: 'violet' }
  if (t >= easterT && t <= easterT + 49 * DAY) return { season: 'easter', color: 'gold' }

  // Christmas season spills into January: Baptism of the Lord = Sunday after 6 Jan.
  const jan6 = utc(year, 1, 6)
  const baptism = jan6 + ((7 - dow(jan6)) % 7 || 7) * DAY
  if (t <= baptism) return { season: 'christmas', color: 'gold', feast: fixed?.feast }

  // Advent: 4th Sunday before 25 Dec (the Sunday in the 27 Nov – 3 Dec window).
  const christmas = utc(year, 12, 25)
  const advent1 = christmas - dow(christmas) * DAY - 21 * DAY
  if (t >= christmas) return { season: 'christmas', color: 'gold', feast: fixed?.feast }
  if (t === advent1 - 7 * DAY) return { season: 'ordinary', color: 'gold', feast: 'Ježíše Krista Krále' }
  if (t >= advent1) return { season: 'advent', color: fixed?.color ?? 'violet', feast: fixed?.feast }

  return { season: 'ordinary', color: fixed?.color ?? 'green', feast: fixed?.feast }
}

/** Today's liturgical color in Prague (used for the --season accent). */
export function currentLiturgicalDay(now: Date = new Date()): LiturgicalDay {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const get = (type: string) => Number(p.find((x) => x.type === type)?.value)
  return liturgicalDay(get('year'), get('month'), get('day'))
}

// ---- "verify the times" advisory season -----------------------------------
// Parishes shuffle schedules in predictable windows: summer holidays, Advent,
// Christmas, Lent, and the Easter octave. In those windows the app shows one
// banner ("times often change now — check the parish website") instead of
// per-row provenance years, which nobody could act on.
export type VerifySeason = 'summer' | 'advent' | 'christmas' | 'lent' | 'easter' | null

export function verifySeason(now: Date = new Date()): VerifySeason {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const get = (type: string) => Number(p.find((x) => x.type === type)?.value)
  const [year, month, day] = [get('year'), get('month'), get('day')]
  // CZ school summer holidays — the single biggest schedule-shuffle window
  if (month === 7 || month === 8) return 'summer'
  const lit = liturgicalDay(year, month, day)
  if (lit.season === 'advent' || lit.season === 'christmas' || lit.season === 'lent') {
    return lit.season
  }
  // Easter octave only — the full 50-day season mostly runs normal schedules
  const easter = easterSunday(year)
  const t = utc(year, month, day)
  const easterT = utc(year, easter.month, easter.day)
  if (t >= easterT && t <= easterT + 7 * DAY) return 'easter'
  return null
}

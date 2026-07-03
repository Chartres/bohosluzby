// Czech schedule-note parser: turns the registry's free-text conditions
// ("kromě července a srpna", "1. sobota v měsíci", "letní čas"…) into a
// date predicate. Trust-critical direction: a service is EXCLUDED only when
// the note provably says it doesn't run on the queried date; any conditional
// wording we can't interpret keeps the row and is flagged `uncertain` so the
// UI shows the note loudly instead of hiding a lie.
//
// ponytail: this is a pattern library, not NLP — it covers the frequent
// registry phrasings (see notes.test.ts). Everything else degrades to
// "uncertain", never to a wrong exclusion. Upgrade path: add patterns as the
// feedback card surfaces them.

import { liturgicalDay } from './liturgical'

export interface NoteRule {
  /** true = may run on that Prague calendar date; false = provably does not. */
  runsOn: (y: number, m: number, d: number) => boolean
  /** A conditional segment we could not interpret — render the note prominently. */
  uncertain: boolean
}

type Pred = (y: number, m: number, d: number) => boolean

const ALWAYS: NoteRule = { runsOn: () => true, uncertain: false }
const DAY = 86_400_000

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
/** ISO day of week, 1 = Monday … 7 = Sunday. */
const isoDow = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7

function isoWeek(y: number, m: number, d: number): number {
  const t = Date.UTC(y, m - 1, d)
  const thursday = t + (4 - isoDow(y, m, d)) * DAY
  const jan1 = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1)
  return Math.floor((thursday - jan1) / DAY / 7) + 1
}

/** CEST at day granularity: last Sunday of March … day before last Sunday of October. */
const summerTime: Pred = (y, m, d) => {
  const lastSunday = (mo: number) => {
    const last = daysInMonth(y, mo)
    return last - (isoDow(y, mo, last) % 7)
  }
  const t = Date.UTC(y, m - 1, d)
  return t >= Date.UTC(y, 2, lastSunday(3)) && t < Date.UTC(y, 9, lastSunday(10))
}

const julyAugust: Pred = (_y, m) => m === 7 || m === 8
const schoolYear: Pred = (_y, m) => m >= 9 || m <= 6
const advent: Pred = (y, m, d) => liturgicalDay(y, m, d).season === 'advent'
const lent: Pred = (y, m, d) => liturgicalDay(y, m, d).season === 'lent'
const not = (p: Pred): Pred => (y, m, d) => !p(y, m, d)

// Registry notes use genitive/nominative/locative month forms interchangeably.
const MONTH: Record<string, number> = {
  leden: 1, ledna: 1, lednu: 1,
  únor: 2, února: 2, únoru: 2,
  březen: 3, března: 3, březnu: 3,
  duben: 4, dubna: 4, dubnu: 4,
  květen: 5, května: 5, květnu: 5,
  červen: 6, června: 6, červnu: 6,
  červenec: 7, července: 7, červenci: 7,
  srpen: 8, srpna: 8, srpnu: 8,
  září: 9,
  říjen: 10, října: 10, říjnu: 10,
  listopad: 11, listopadu: 11,
  prosinec: 12, prosince: 12, prosinci: 12,
}
const MONTH_RE = Object.keys(MONTH).sort((a, b) => b.length - a.length).join('|')

const WEEKDAY: Record<string, number> = {
  pondělí: 1, úterý: 2, středa: 3, středu: 3, středy: 3, čtvrtek: 4, čtvrtku: 4,
  pátek: 5, pátku: 5, sobota: 6, sobotu: 6, soboty: 6, neděle: 7, neděli: 7,
}
const WEEKDAY_RE = Object.keys(WEEKDAY).sort((a, b) => b.length - a.length).join('|')

const ORDINAL: Record<string, number | 'last'> = {
  '1': 1, 'první': 1, '2': 2, 'druhá': 2, 'druhou': 2, 'druhé': 2, '3': 3, 'třetí': 3,
  '4': 4, 'čtvrtá': 4, 'čtvrtou': 4, '5': 5, 'pátá': 5, 'poslední': 'last', 'posl': 'last',
}
const ORDINAL_RE = "(?:\\d|první|druh[áoé]u?|třetí|čtvrt[áoé]u?|pát[áé]|posl(?:ední)?)\\.?"

/** "července a srpna" | "červenec až srpen" | "září" → month set (null = not months). */
function parseMonthSet(s: string): Set<number> | null {
  const range = new RegExp(`^(${MONTH_RE})\\s*(?:až|[-–])\\s*(${MONTH_RE})$`).exec(s)
  if (range) {
    const from = MONTH[range[1]]
    const to = MONTH[range[2]]
    const out = new Set<number>()
    for (let m = from; ; m = (m % 12) + 1) {
      out.add(m)
      if (m === to) break
    }
    return out
  }
  const parts = s.split(/\s*(?:,|\s+a\s+)\s*/)
  const out = new Set<number>()
  for (const p of parts) {
    const m = MONTH[p.trim()]
    if (!m) return null
    out.add(m)
  }
  return out.size > 0 ? out : null
}

/** Nth-weekday predicate: governs only dates falling on the named weekday. */
function nthWeekday(ords: (number | 'last')[], wd: number): Pred {
  return (y, m, d) =>
    isoDow(y, m, d) !== wd
      ? true
      : ords.some((o) => (o === 'last' ? d + 7 > daysInMonth(y, m) : Math.ceil(d / 7) === o))
}

function parseOrdinals(s: string): (number | 'last')[] | null {
  const out: (number | 'last')[] = []
  for (const part of s.split(/\s*(?:,|\s+a\s+)\s*/)) {
    const o = ORDINAL[part.replace(/\.$/, '').trim()]
    if (o === undefined) return null
    out.push(o)
  }
  return out.length > 0 ? out : null
}

/** Positive-inclusion object after "kromě/mimo/vyjma" or "pouze v": months,
 * prázdniny, advent, nth weekday — or an " a "-joined union of those. */
function parseInclusion(s: string): Pred | null {
  const months = parseMonthSet(s)
  if (months) return (_y, m) => months.has(m)
  if (/^(?:období\s+|dobu\s+|doby\s+)?(?:letní(?:ch)?\s+|hlavní(?:ch)?\s+)?prázdnin(?:y|ách)?$/.test(s)) return julyAugust
  if (/^adventu?$/.test(s)) return advent
  if (/^(?:dobu\s+|doby\s+|období\s+)?postní(?:\s+dob[uy])?$/.test(s) || s === 'postu') return lent
  const nth = new RegExp(`^(${ORDINAL_RE}(?:\\s*(?:,|\\s+a\\s+)\\s*${ORDINAL_RE})*)\\s+(${WEEKDAY_RE})(?:\\s+v\\s+měsíci)?$`).exec(s)
  if (nth) {
    const ords = parseOrdinals(nth[1])
    if (ords) return nthWeekday(ords, WEEKDAY[nth[2]])
  }
  // union: "adventu a letních prázdnin"
  const parts = s.split(/\s+a\s+/)
  if (parts.length > 1) {
    const preds = parts.map((p) => parseInclusion(p.trim()))
    if (preds.every((p): p is Pred => p !== null))
      return (y, m, d) => preds.some((p) => p(y, m, d))
  }
  return null
}

/** "od X do Y" boundary → [month, day] (day defaults per edge). */
function parseBound(s: string, edge: 'from' | 'to'): [number, number] | null {
  const t = s.replace(/^kon(?:ce|ec)\s+/, '').trim()
  const m = MONTH[t]
  if (m) return [m, edge === 'from' ? 1 : 31]
  const dm = /^(\d{1,2})\.\s*(\d{1,2})\.?$/.exec(t)
  if (dm) return [Number(dm[2]), Number(dm[1])]
  return null
}

// (?:^|\s)…(?=\s|$) instead of \b — Czech diacritics are non-word chars for \b
const NEGATION = /(?:^|\s)(?:není|nejsou|nekoná|nekonají|neslouží|nebývá|odpadá)(?=\s|$)/

/** One comma/sentence segment → predicate, 'none' (descriptive), or null (not understood). */
function parseSegment(seg: string): Pred | 'none' | null {
  const s = seg.trim().replace(/\.$/, '')
  if (!s) return 'none'

  // DST / season
  if (/^(?:pouze\s+|jen\s+)?(?:v\s+)?(?:období\s+|době\s+)?letní(?:ho|m)?\s+(?:čas[eu]?|období)$/.test(s)) return summerTime
  if (/^(?:pouze\s+|jen\s+)?(?:v\s+)?(?:období\s+|době\s+)?zimní(?:ho|m)?\s+(?:čas[eu]?|období)$/.test(s)) return not(summerTime)

  // school year / holidays
  if (/školní(?:m|ho)?\s+ro[ck]/.test(s)) return schoolYear
  if (/^(?:pouze\s+|jen\s+)?(?:o|v|během)\s+(?:době\s+|období\s+)?(?:letních\s+)?prázdnin(?:ách)?$/.test(s)) return julyAugust

  // advent ("v adventu rorátní" = a rorate mass — advent-only by definition)
  if (/^v\s+adventu(?:\s+rorátní)?$/.test(s)) return advent
  if (/^v\s+(?:době\s+|období\s+)?postní(?:\s+době)?$/.test(s) || /^v\s+postu$/.test(s)) return lent

  // kromě/mimo/vyjma <inclusion>
  const except = /^(?:kromě|mimo|vyjma|s výjimkou)\s+(.+)$/.exec(s)
  if (except) {
    const inc = parseInclusion(except[1])
    return inc ? not(inc) : null
  }

  // (období) od X do Y
  const range = /^(?:(?:v\s+)?období\s+)?od\s+(.+?)\s+do\s+(.+)$/.exec(s)
  if (range) {
    const from = parseBound(range[1], 'from')
    const to = parseBound(range[2], 'to')
    if (from && to) {
      const [fk, tk] = [from[0] * 100 + from[1], to[0] * 100 + to[1]]
      return (_y, m, d) => {
        const k = m * 100 + d
        return fk <= tk ? k >= fk && k <= tk : k >= fk || k <= tk
      }
    }
    return null
  }

  // v <měsících> … nejsou/nekoná se → excluded in those months
  const inMonths = /^(?:v|během)\s+(.+?)\s+(?=(?:se\s+)?(?:vždy|pouze|jen|není|nejsou|nekoná|neslouží|nebývá|se))(.*)$/.exec(s)
  if (inMonths) {
    const months = parseMonthSet(inMonths[1])
    if (months) {
      const rest = inMonths[2].trim()
      if (NEGATION.test(rest)) return (_y, m) => !months.has(m)
      // "vždy pouze první sobota" — restricted inside the months, free outside
      const cond = new RegExp(`^(?:se\\s+)?(?:vždy\\s+)?(?:pouze|jen)\\s+(${ORDINAL_RE}(?:\\s*(?:,|\\s+a\\s+)\\s*${ORDINAL_RE})*)\\s+(${WEEKDAY_RE})(?:\\s+v\\s+měsíci)?$`).exec(rest)
      if (cond) {
        const ords = parseOrdinals(cond[1])
        if (ords) {
          const nth = nthWeekday(ords, WEEKDAY[cond[2]])
          return (y, m, d) => (months.has(m) ? nth(y, m, d) : true)
        }
      }
    }
    return null
  }

  // pouze v <měsících> / v <měsících>
  const onlyMonths = /^(?:pouze\s+|jen\s+)?v(?:e)?\s+(.+)$/.exec(s)
  if (onlyMonths) {
    const months = parseMonthSet(onlyMonths[1])
    if (months) return (_y, m) => months.has(m)
  }

  // nth weekday: "1. sobota v měsíci", "2. a 4. neděle v měsíci", "pouze první sobota…",
  // with an optional prose prefix before "pouze" ("Mše sv. je sloužena pouze 1. sobotu v měsíci")
  const nthRe = new RegExp(`(?:^|^.*\\s)(?:vždy\\s+)?(?:pouze|jen)\\s+(${ORDINAL_RE}(?:\\s*(?:,|\\s+a\\s+)\\s*${ORDINAL_RE})*)\\s+(${WEEKDAY_RE})(?:\\s+v\\s+měsíci)?$`).exec(s) ??
    new RegExp(`^(?:1x\\s+za\\s+měsíc\\s+)?(${ORDINAL_RE}(?:\\s*(?:,|\\s+a\\s+)\\s*${ORDINAL_RE})*)\\s+(${WEEKDAY_RE})\\s+v\\s+měsíci$`).exec(s)
  if (nthRe) {
    const ords = parseOrdinals(nthRe[1])
    if (ords) return nthWeekday(ords, WEEKDAY[nthRe[2]])
  }

  // week of month: "1. týden v měsíci", "posl. týden v měsíci"
  const week = /^(?:(\d)\.|posl(?:\.|ední))\s+týden\s+v\s+měsíci$/.exec(s)
  if (week)
    return week[1]
      ? (_y, _m, d) => Math.ceil(d / 7) === Number(week[1])
      : (y, m, d) => d + 7 > daysInMonth(y, m)

  // ISO week parity: "sudý týden" / "lichý týden" / "v lichém týdnu"
  const parity = /^(?:v\s+)?(sud|lich)(?:ý|ém)\s+týd(?:en|nu)$/.exec(s)
  if (parity) return (y, m, d) => isoWeek(y, m, d) % 2 === (parity[1] === 'sud' ? 0 : 1)

  return null
}

// A segment that talks about dates/conditions but didn't parse → uncertain.
// Descriptive segments ("pro děti", "s nedělní platností", "č/p") pass silently.
const CONDITIONAL = new RegExp(
  // 'svát(?:ek|k|c)' not bare 'svát' — "svátost smíření" is not a feast condition
  `krom|mimo|vyjma|výjimk|pouze|\\bjen\\b|nepravidel|není|nejsou|nekoná|neslouž|nebývá|odpadá|období|prázdnin|čas|týd(?:en|n)|měsíc|advent|postní|škol|sud[ýé]|lich[ýé]|svát(?:ek|k|c)|ohlášen|\\d+\\s*[x×]|${MONTH_RE}`,
)

// Frequency markers that a sibling segment makes concrete ("1x za měsíc, 1. týden v měsíci").
const FREQUENCY = /^(?:1x\s+(?:za\s+měsíc|měsíčně|za\s+14\s+dní|za\s+2\s+týdny)|každých\s+14\s+dní)$/

const cache = new Map<string, NoteRule>()

export function parseNote(note: string): NoteRule {
  const trimmed = note.trim()
  if (!trimmed) return ALWAYS
  const hit = cache.get(trimmed)
  if (hit) return hit

  // split sentences (". " before an uppercase letter) and comma/semicolon segments;
  // the lookbehind spares ordinals ("1. sobotu") and abbreviations ("posl. týden")
  const segs = trimmed
    .split(/(?<=\p{Ll}{3})\.\s+(?=\p{Lu})/u)
    .flatMap((s) => s.split(/\s*[,;]\s*/))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  const parsed = segs.map(parseSegment)
  const preds = parsed.filter((p): p is Pred => typeof p === 'function')
  let uncertain = false
  segs.forEach((seg, i) => {
    if (parsed[i] !== null) return
    if (FREQUENCY.test(seg) && preds.length > 0) return // sibling pins the schedule
    if (CONDITIONAL.test(seg)) uncertain = true
  })

  const rule: NoteRule =
    preds.length === 0
      ? { runsOn: ALWAYS.runsOn, uncertain }
      : { runsOn: (y, m, d) => preds.every((p) => p(y, m, d)), uncertain }
  cache.set(trimmed, rule)
  return rule
}

/** Should this note be rendered as a warning rubric? */
export const noteUncertain = (note: string): boolean => parseNote(note).uncertain

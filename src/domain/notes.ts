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

import { liturgicalDay } from './liturgical.ts' // explicit: the Node prerender imports this
import { pragueToday } from './occurrences.ts'

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
  '4': 4, 'čtvrtá': 4, 'čtvrtou': 4, '5': 5, 'pátá': 5, 'páté': 5, 'poslední': 'last', 'posl': 'last',
}
const ORDINAL_RE = "(?:\\d|první|druh[áoé]u?|třetí|čtvrt[áoé]u?|pát[áé]|posl(?:ední)?)\\.?"
/** "1." | "1. a 3." | "2., 4." — an ordinal list. */
const ORDINALS_RE = `${ORDINAL_RE}(?:\\s*(?:,|\\s+a\\s+)\\s*${ORDINAL_RE})*`

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

/** Is d the Nth (or last) of its weekday in the month, for any listed N? */
const nthHit = (ords: (number | 'last')[], y: number, m: number, d: number) =>
  ords.some((o) => (o === 'last' ? d + 7 > daysInMonth(y, m) : Math.ceil(d / 7) === o))

/** Nth-weekday predicate: governs only dates falling on the named weekday. */
function nthWeekday(ords: (number | 'last')[], wd: number): Pred {
  return (y, m, d) => isoDow(y, m, d) !== wd || nthHit(ords, y, m, d)
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
 * prázdniny, advent, nth weekday — or an " a "-joined union of those.
 * negated=true is used by the except branch so the correct predicate is built
 * in one call; notably nthWeekday returns true for non-target weekdays (a
 * "governs only wd" sentinel) so not(nthWeekday) would wrongly exclude them. */
function parseInclusion(s: string, negated = false): Pred | null {
  // one full date, year included ("kromě 2. 11. 2026"): data/corrections.mjs
  // writes these when a parish announces a Mass doesn't take place that day
  const date = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(s)
  if (date) {
    const [dd, mm, yy] = [Number(date[1]), Number(date[2]), Number(date[3])]
    const pos: Pred = (y, m, d) => y === yy && m === mm && d === dd
    return negated ? not(pos) : pos
  }
  const months = parseMonthSet(s)
  if (months) {
    const pos: Pred = (_y, m) => months.has(m)
    return negated ? not(pos) : pos
  }
  if (/^(?:období\s+|dobu\s+|doby\s+)?(?:letní(?:ch)?\s+|hlavní(?:ch)?\s+)?prázdnin(?:y|ách)?$/.test(s))
    return negated ? not(julyAugust) : julyAugust
  if (/^adventu?$/.test(s)) return negated ? not(advent) : advent
  if (/^(?:dobu\s+|doby\s+|období\s+)?postní(?:\s+dob[uy])?$/.test(s) || s === 'postu')
    return negated ? not(lent) : lent
  if (/^školní(?:ho|m)?\s+ro[ck](?:e[mk]?|u)?$/.test(s)) return negated ? not(schoolYear) : schoolYear
  const nth = new RegExp(`^(${ORDINALS_RE})\\s+(${WEEKDAY_RE})(?:\\s+v\\s+měsíci)?$`).exec(s)
  if (nth) {
    const ords = parseOrdinals(nth[1])
    const wd = WEEKDAY[nth[2]]
    if (ords) {
      if (negated) {
        // "kromě Nth wd": exclude only that specific occurrence; pass all other days including other weekdays
        return (y, m, d) => isoDow(y, m, d) !== wd || !nthHit(ords, y, m, d)
      }
      return nthWeekday(ords, wd)
    }
  }
  // union: "adventu a letních prázdnin" — De Morgan: not(A or B) = not(A) and not(B)
  const parts = s.split(/\s+a\s+/)
  if (parts.length > 1) {
    const preds = parts.map((p) => parseInclusion(p.trim(), negated))
    if (preds.every((p): p is Pred => p !== null))
      return negated
        ? (y, m, d) => (preds as Pred[]).every((p) => p(y, m, d))
        : (y, m, d) => (preds as Pred[]).some((p) => p(y, m, d))
  }
  return null
}

/** "od X do Y" boundary → [month, day] (day defaults per edge). */
function parseBound(s: string, edge: 'from' | 'to'): [number, number] | null {
  const konce = /^kon(?:ce|ec)\s+/.test(s)
  const t = s.replace(/^kon(?:ce|ec)\s+/, '').trim()
  const m = MONTH[t]
  // For 'to' edge: return 31 — a sentinel always ≥ the real last day, so
  // Feb 29 in a leap year passes the range check (M2). For 'from' edge with
  // konce: use daysInMonth with non-leap 2023; all non-Feb months are exact
  // and Feb 'from' uses day 28 which still includes Feb 29 (k≥228).
  if (m) return [m, konce && edge === 'from' ? daysInMonth(2023, m) : edge === 'from' ? 1 : 31]
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
  // Guard against "mimo/kromě školní rok" — the except handler below resolves those.
  if (/školní(?:m|ho)?\s+ro[ck]/.test(s) && !/^(?:kromě|mimo|vyjma|s výjimkou)/.test(s))
    return NEGATION.test(s) ? not(schoolYear) : schoolYear
  if (/^(?:pouze\s+|jen\s+)?(?:o|v|během)\s+(?:době\s+|období\s+)?(?:letních\s+)?prázdnin(?:ách)?$/.test(s)) return julyAugust

  // advent ("v adventu rorátní" = a rorate mass — advent-only by definition)
  // "pouze/jen" only restates the inclusion; "během" = "v"; "v době adventní" = advent
  if (/^(?:pouze\s+|jen\s+)?(?:v|během)\s+(?:době\s+adventní|adventu(?:\s+rorátní)?)$/.test(s)) return advent
  if (
    /^(?:pouze\s+|jen\s+)?(?:v|během)\s+(?:době\s+|období\s+)?postní(?:\s+době)?$/.test(s) ||
    /^(?:pouze\s+|jen\s+)?(?:v|během)\s+postu$/.test(s)
  )
    return lent

  // kromě/mimo/vyjma <inclusion>
  const except = /^(?:kromě|mimo|vyjma|s výjimkou)\s+(.+)$/.exec(s)
  if (except) return parseInclusion(except[1], true)

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
      const cond = new RegExp(`^(?:se\\s+)?(?:vždy\\s+)?(?:pouze|jen)\\s+(${ORDINALS_RE})\\s+(${WEEKDAY_RE})(?:\\s+v\\s+měsíci)?$`).exec(rest)
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
  // Guard: skip when the prefix prose contains negation ("nekoná se pouze…" means the opposite).
  const nthRe = (!NEGATION.test(s)
    ? new RegExp(`(?:^|^.*\\s)(?:vždy\\s+)?(?:pouze|jen)\\s+(${ORDINALS_RE})\\s+(${WEEKDAY_RE})(?:\\s+v\\s+měsíci)?$`).exec(s)
    : null) ??
    // "v měsíci" optional: the registry also writes a bare "1. neděle" / "2. a 4. sobota"
    // segment (after "1x za měsíc,"), which can only mean the nth weekday of the month
    new RegExp(`^(?:1x\\s+za\\s+měsíc\\s+)?(${ORDINALS_RE})\\s+(${WEEKDAY_RE})(?:\\s+v\\s+měsíci)?$`).exec(s)
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
// Segments that contribute exclusion predicates — ANDed so each exclusion stacks.
const EXCL_SEG = /^(?:kromě|mimo|vyjma|s\s+výjimkou)\s+/
const EXCL_DATE = /^kromě\s+\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\.?$/

// H2: classify an inclusion segment so same-kind segments can be OR'd.
// "v červenci, v srpnu" → both 'month' → OR → July or August.
// "ve školním roce, 1. sobota" → 'other' + 'weekday' → AND across kinds.
// Every other segment is its own kind (`i`): "letní čas, 1. týden v měsíci" and
// "zimní čas, sudý týden" are two conditions that must both hold, not
// alternatives — OR-ing them listed those Masses all year (34 registry notes).
function segKind(seg: string, i: number): string {
  const s = seg.replace(/\.$/, '').trim()
  const onlyMonths = /^(?:pouze\s+|jen\s+)?v(?:e)?\s+(.+)$/.exec(s)
  if (onlyMonths && parseMonthSet(onlyMonths[1])) return 'month'
  // keyed by weekday: "1. sobota, 3. sobota" OR; "1. sobota, 3. neděle" must
  // AND, since each nth predicate passes every other weekday (OR = always true)
  const wd = new RegExp(WEEKDAY_RE).exec(s)
  if (wd) return `weekday${WEEKDAY[wd[0]]}`
  if (/^(?:(?:v\s+)?období\s+)?od\s+.+\s+do\s+/.test(s)) return 'range'
  return `other${i}`
}

export function parseNote(note: string): NoteRule {
  const trimmed = note.trim()
  if (!trimmed) return ALWAYS
  const hit = cache.get(trimmed)
  if (hit) return hit

  // split sentences (". " before an uppercase letter) and comma/semicolon segments;
  // requiring 3 lowercase letters before the dot spares ordinals ("1. sobotu")
  // and abbreviations ("posl. týden"). No lookbehind: iOS 15 WebKit (the app's
  // deployment target) can't parse one, and a lookbehind literal blanks the app.
  //
  // H1: protect "1., 3. sobota v měsíci" style ordinal lists from the generic
  // comma split — replace internal commas with " a " so the phrase stays one segment.
  // Anchored at a word start (no lookbehind): "do 31.10., 3. sobota" must not
  // read the date's last digit as an ordinal and glue the two segments together.
  const multiNthRe = new RegExp(
    `(^|\\s)(${ORDINAL_RE}(?:\\s*,\\s*${ORDINAL_RE})+)(\\s+(?:${WEEKDAY_RE})(?:\\s+v\\s+měsíci)?)`,
    'gi',
  )
  const allSegs = trimmed
    .replace(/(\p{Ll}{3})\.\s+(?=\p{Lu})/gu, '$1\u0000')
    .split('\u0000')
    .map((s) => s.replace(multiNthRe, (_, pre: string, ords: string, wd: string) => pre + ords.replace(/\s*,\s*/g, ' a ') + wd))
    .flatMap((s) => s.split(/\s*[,;]\s*/))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  // "kromě 2. 11. 2026" (data/corrections.mjs: the parish announced it doesn't
  // take place that day) holds even when the rest of the note is unreadable
  const dateExcl = allSegs.filter((s) => EXCL_DATE.test(s)).map((s) => parseSegment(s) as Pred)
  const segs = allSegs.filter((s) => !EXCL_DATE.test(s))
  if (dateExcl.length) {
    const base = parseNote(segs.join(', '))
    const rule: NoteRule = { runsOn: (y, m, d) => dateExcl.every((p) => p(y, m, d)) && base.runsOn(y, m, d), uncertain: base.uncertain }
    cache.set(trimmed, rule)
    return rule
  }

  const parsed = segs.map(parseSegment)
  const preds = parsed.filter((p): p is Pred => typeof p === 'function')
  let uncertain = false
  segs.forEach((seg, i) => {
    if (parsed[i] !== null) return
    if (FREQUENCY.test(seg) && preds.length > 0) return // sibling pins the schedule
    if (CONDITIONAL.test(seg)) uncertain = true
  })

  // When a sibling segment is uncertain, don't trust a parsed exclusion either:
  // "ve školním roce v 18:00, o prázdninách v 8:00" parses segment 1 to a
  // school-year exclusion but can't read segment 2 — applying the exclusion
  // would hide the real summer mass. Degrade to kept-uncertain (runs, flagged);
  // showing a flagged row beats silently dropping a mass the note half-explains.
  let rule: NoteRule
  if (preds.length === 0 || uncertain) {
    rule = { runsOn: ALWAYS.runsOn, uncertain }
  } else {
    // Exclusion segs (kromě/mimo/vyjma) are ANDed — each exclusion must hold.
    // Inclusion segs: same-kind segs are OR'd (alternatives), different kinds AND'd (H2).
    // "v červenci, v srpnu" → OR (both month kind). "ve školním roce, 1. sobota" → AND.
    const excls: Pred[] = []
    const incls: Pred[] = []
    const inclSegs: string[] = []
    parsed.forEach((p, i) => {
      if (typeof p !== 'function') return
      if (EXCL_SEG.test(segs[i])) excls.push(p)
      else { incls.push(p); inclSegs.push(segs[i]) }
    })
    // Group inclusions by kind; OR within group, AND across groups.
    const kindGroups = new Map<string, Pred[]>()
    incls.forEach((p, i) => {
      const k = segKind(inclSegs[i], i)
      const arr = kindGroups.get(k) ?? []
      arr.push(p)
      kindGroups.set(k, arr)
    })
    const inclPred: Pred =
      kindGroups.size === 0
        ? () => true
        : (y, m, d) => [...kindGroups.values()].every((group) => group.some((p) => p(y, m, d)))
    const runsOn: Pred =
      excls.length === 0
        ? inclPred
        : incls.length === 0
          ? (y, m, d) => excls.every((p) => p(y, m, d))
          : (y, m, d) => inclPred(y, m, d) && excls.every((p) => p(y, m, d))
    rule = { runsOn, uncertain }
  }
  cache.set(trimmed, rule)
  return rule
}

/** Note-aware occurrence check: false only when the note provably excludes `start`'s Prague date. */
export function runsAt(note: string | undefined, start: Date): boolean {
  const { y, m, d } = pragueToday(start)
  return parseNote(note ?? '').runsOn(y, m, d)
}

/** Should this note be rendered as a warning rubric? */
export const noteUncertain = (note: string): boolean => parseNote(note).uncertain

/** Returns true when every restriction in `note` is a one-off dated exclusion
 * ("kromě D. M. YYYY") — the RRULE can stay open-ended; EXDATE handles the gaps. */
export function hasDatedOnlyExclusions(note: string | undefined): boolean {
  const segs = (note ?? '')
    .split(/\s*[,;]\s*/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (!segs.some((s) => EXCL_DATE.test(s))) return false
  // Base note without the dated exclusions must be unrestricted (ALWAYS).
  const rest = segs.filter((s) => !EXCL_DATE.test(s)).join(', ')
  const base = parseNote(rest)
  return !base.uncertain && base.runsOn === ALWAYS.runsOn
}

// Weekdays a note names, in the forms the registry uses ("páteční", "v úterý",
// "Každý čtvrtek", "s nedělní platností"). Word-start anchored without
// lookbehind (iOS 15 WebKit can't parse it): "uprostřed", "čtvrt hodiny" and
// "pátý" don't count.
const NAMED_DAYS: [number, RegExp][] = [
  [1, /(?:^|[^\p{L}])(?:pondělí|pondělk|pondělní)/iu],
  [2, /(?:^|[^\p{L}])(?:úterý|úterk|úterní)/iu],
  [3, /(?:^|[^\p{L}])(?:(?:středa|středu|středy|středou|středě)(?!\p{L})|středeční)/iu],
  [4, /(?:^|[^\p{L}])čtvrt(?:ek|k|eční)/iu],
  [5, /(?:^|[^\p{L}])pát(?:ek|k|eční)/iu],
  [6, /(?:^|[^\p{L}])sobot/iu],
  [7, /(?:^|[^\p{L}])neděl/iu],
]
const RESTRICTIVE = /(?:^|[^\p{L}])(?:jen|pouze)(?!\p{L})/iu

/** Should a multi-day service's note print on `day`'s row? A note that names
 * some of the service's own weekdays belongs on those rows only — "V červenci…
 * není páteční mše" on Po/St/Pá printed under Monday too. "jen/pouze v sobotu"
 * restricts the OTHER days, so it stays everywhere; so does a note naming no
 * weekday, or only days the service doesn't run on ("po nedělní mši"). */
export function noteShownOnDay(note: string, days: string, day: number | string): boolean {
  if (!note || RESTRICTIVE.test(note)) return true
  const own = NAMED_DAYS.filter(([d, re]) => days.includes(String(d)) && re.test(note)).map(([d]) => String(d))
  return own.length === 0 || own.includes(String(day))
}

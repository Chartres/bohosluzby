// The trust-critical parser: a July tourist must not be sent to a mass that
// provably doesn't run ("mimo červenec a srpen"). Only provable exclusions
// exclude; unparseable conditional notes stay visible and are flagged uncertain.
import { describe, expect, it } from 'vitest'
import { parseNote, noteUncertain, noteShownOnDay } from './notes'

const runs = (note: string, iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return parseNote(note).runsOn(y, m, d)
}

describe('no constraint', () => {
  it('empty and descriptive notes always run and are certain', () => {
    for (const note of ['', 'mše svatá', 's nedělní platností', 'pro rodiny s dětmi', 'č', 'p/č']) {
      expect(runs(note, '2026-07-06'), note).toBe(true)
      expect(noteUncertain(note), note).toBe(false)
    }
  })
})

describe('month exclusions (kromě/mimo/vyjma)', () => {
  it.each([
    'kromě července a srpna',
    'mimo červenec a srpen',
    'mimo červenec až srpen',
    'vyjma července a srpna',
  ])('%s: July no, June yes', (note) => {
    expect(runs(note, '2026-07-06')).toBe(false)
    expect(runs(note, '2026-08-15')).toBe(false)
    expect(runs(note, '2026-06-06')).toBe(true)
    expect(noteUncertain(note)).toBe(false)
  })
  it('single month', () => {
    expect(runs('kromě srpna', '2026-08-01')).toBe(false)
    expect(runs('kromě srpna', '2026-07-01')).toBe(true)
  })
  it('v <měsících> není/nekoná se', () => {
    expect(runs('V červenci a srpnu nejsou mše sv. slouženy.', '2026-07-06')).toBe(false)
    expect(runs('během července a srpna se nekoná', '2026-07-06')).toBe(false)
    expect(runs('během července a srpna se nekoná', '2026-09-06')).toBe(true)
  })
})

describe('AND-combination of inclusion segments (M1)', () => {
  it('ve školním roce, 1. sobota v měsíci — both conditions must hold', () => {
    const note = 've školním roce, 1. sobota v měsíci'
    expect(runs(note, '2026-07-04')).toBe(false) // 1st Saturday of July — not school year
    expect(runs(note, '2026-09-05')).toBe(true)  // 1st Saturday of September — in school year
    expect(runs(note, '2026-09-12')).toBe(false) // 2nd Saturday — not 1st Sat
    expect(noteUncertain(note)).toBe(false)
  })
})

describe('OR-combination of same-kind inclusion segments (H2)', () => {
  it('"v červenci, v srpnu" means July OR August, not July AND August', () => {
    const note = 'v červenci, v srpnu'
    expect(runs(note, '2026-07-15')).toBe(true)  // July
    expect(runs(note, '2026-08-15')).toBe(true)  // August
    expect(runs(note, '2026-06-15')).toBe(false) // June
    expect(noteUncertain(note)).toBe(false)
  })
  it('"1. sobota, 3. sobota" means 1st OR 3rd Saturday', () => {
    const note = '1. sobota v měsíci, 3. sobota v měsíci'
    expect(runs(note, '2026-07-04')).toBe(true)  // 1st Saturday
    expect(runs(note, '2026-07-18')).toBe(true)  // 3rd Saturday
    expect(runs(note, '2026-07-11')).toBe(false) // 2nd Saturday
    expect(runs(note, '2026-07-05')).toBe(true)  // Sunday — not governed
    expect(noteUncertain(note)).toBe(false)
  })
  it('different weekdays AND: "1. sobota…, 3. neděle…" = 1st Saturdays and 3rd Sundays only', () => {
    // each nth-weekday predicate passes every other weekday, so OR-ing two of
    // them listed every Saturday and every Sunday
    const note = '1. sobota v měsíci, 3. neděle v měsíci'
    expect(runs(note, '2026-07-04')).toBe(true) // 1st Saturday
    expect(runs(note, '2026-07-19')).toBe(true) // 3rd Sunday
    expect(runs(note, '2026-07-11')).toBe(false) // 2nd Saturday
    expect(runs(note, '2026-07-05')).toBe(false) // 1st Sunday
    expect(noteUncertain(note)).toBe(false)
  })
  it('cross-kind is still AND: "v červenci, 1. sobota v měsíci" = July AND 1st Sat', () => {
    const note = 'v červenci, 1. sobota v měsíci'
    expect(runs(note, '2026-07-04')).toBe(true)  // 1st Saturday of July
    expect(runs(note, '2026-07-11')).toBe(false) // 2nd Saturday of July
    expect(runs(note, '2026-09-05')).toBe(false) // 1st Saturday outside July
    expect(noteUncertain(note)).toBe(false)
  })
})

describe('summer holidays and school year', () => {
  it.each([
    'kromě letních prázdnin',
    'mimo letních prázdnin',
    'kromě období letních prázdnin',
    'vyjma letních prázdnin',
  ])('%s: July/August no', (note) => {
    expect(runs(note, '2026-07-15')).toBe(false)
    expect(runs(note, '2026-08-15')).toBe(false)
    expect(runs(note, '2026-09-15')).toBe(true)
    expect(noteUncertain(note)).toBe(false)
  })
  it('školní rok = September–June', () => {
    expect(runs('školní rok', '2026-07-06')).toBe(false)
    expect(runs('školní rok', '2026-09-06')).toBe(true)
    expect(runs('ve školním roce pro děti', '2026-07-06')).toBe(false)
  })
  it('mimo/kromě školní rok = July/August only', () => {
    expect(runs('mimo školní rok', '2026-10-06')).toBe(false) // Oct = school year → excluded
    expect(runs('mimo školní rok', '2026-07-06')).toBe(true)  // Jul = not school year → runs
    expect(runs('kromě školního roku', '2026-10-06')).toBe(false)
    expect(runs('kromě školního roku', '2026-07-06')).toBe(true)
    expect(noteUncertain('mimo školní rok')).toBe(false)
  })
  it('ve školním roce se nekoná = summer-only', () => {
    expect(runs('ve školním roce se nekoná', '2026-10-06')).toBe(false)
    expect(runs('ve školním roce se nekoná', '2026-07-06')).toBe(true)
  })
  it('pouze o letních prázdninách runs only in July/August', () => {
    expect(runs('pouze o letních prázdninách', '2026-07-06')).toBe(true)
    expect(runs('pouze o letních prázdninách', '2026-09-06')).toBe(false)
  })
})

describe('month ranges (období od … do …)', () => {
  it('období od července do srpna: only July+August', () => {
    expect(runs('období od července do srpna', '2026-07-06')).toBe(true)
    expect(runs('období od července do srpna', '2026-09-06')).toBe(false)
    expect(runs('období od červenec do srpen', '2026-07-06')).toBe(true)
  })
  it('období od září do června wraps the year', () => {
    expect(runs('období od září do června', '2026-07-15')).toBe(false)
    expect(runs('období od září do června', '2026-10-15')).toBe(true)
    expect(runs('období od září do června', '2026-02-15')).toBe(true)
  })
  it('day-precision range', () => {
    expect(runs('období od 1.7. do 31.8.', '2026-07-01')).toBe(true)
    expect(runs('období od 1.7. do 31.8.', '2026-06-30')).toBe(false)
  })
  it('od července do konce srpna', () => {
    expect(runs('období od července do konce srpna', '2026-08-31')).toBe(true)
    expect(runs('období od července do konce srpna', '2026-09-01')).toBe(false)
  })
  it('od konce června do září: starts at end of June, not June 1 (M2)', () => {
    expect(runs('od konce června do září', '2026-06-30')).toBe(true)  // last day of June
    expect(runs('od konce června do září', '2026-06-05')).toBe(false) // before end of June
    expect(runs('od konce června do září', '2026-07-15')).toBe(true)  // inside range
    expect(runs('od konce června do září', '2026-10-01')).toBe(false) // after September
  })
  it('do konce února includes Feb 29 in leap years (M2)', () => {
    expect(runs('od ledna do konce února', '2024-02-29')).toBe(true)  // leap year Feb 29
    expect(runs('od ledna do konce února', '2024-02-28')).toBe(true)
    expect(runs('od ledna do konce února', '2024-03-01')).toBe(false) // after range
  })
})

describe('summer/winter time (DST)', () => {
  it('letní čas: between last March and last October Sundays', () => {
    expect(runs('letní čas', '2026-07-06')).toBe(true)
    expect(runs('letní čas', '2026-01-15')).toBe(false)
    expect(runs('letní čas', '2026-03-29')).toBe(true) // DST starts 29 Mar 2026
    expect(runs('letní čas', '2026-03-28')).toBe(false)
    expect(runs('letní čas', '2026-10-24')).toBe(true)
    expect(runs('letní čas', '2026-10-25')).toBe(false) // DST ends 25 Oct 2026
  })
  it.each(['v letním čase', 'v období letního času', 'v letním období'])('%s', (note) => {
    expect(runs(note, '2026-07-06')).toBe(true)
    expect(runs(note, '2026-01-15')).toBe(false)
  })
  it.each(['zimní čas', 'v zimním čase', 'v období zimního času', 'v zimním období'])('%s', (note) => {
    expect(runs(note, '2026-01-15')).toBe(true)
    expect(runs(note, '2026-07-06')).toBe(false)
  })
})

describe('nth weekday of month', () => {
  it('1. sobota v měsíci', () => {
    expect(runs('1. sobota v měsíci', '2026-07-04')).toBe(true) // 1st Saturday
    expect(runs('1. sobota v měsíci', '2026-07-11')).toBe(false) // 2nd Saturday
    expect(runs('1. sobota v měsíci', '2026-07-05')).toBe(true) // a Sunday — note doesn't govern it
  })
  // registry form without "v měsíci" (8 services, e.g. the Malá Morava chapel that
  // showed "dnes 14:00" on the 4th Sunday of October — Pavol, 2026-10-25)
  it('bare ordinal + weekday segments: "1x za měsíc, 1. neděle", "2. a 4. sobota", "první pátek"', () => {
    const chapel = 'období od května do října, 1x za měsíc, 1. neděle '
    expect(runs(chapel, '2026-10-25')).toBe(false) // 4th Sunday
    expect(runs(chapel, '2026-10-04')).toBe(true) // 1st Sunday, in season
    expect(runs(chapel, '2026-11-01')).toBe(false) // 1st Sunday, out of season
    expect(runs('1x za měsíc, 1. pátek', '2026-10-02')).toBe(true)
    expect(runs('1x za měsíc, 1. pátek', '2026-10-09')).toBe(false)
    expect(runs('2. a 4. sobota', '2026-10-10')).toBe(true)
    expect(runs('2. a 4. sobota', '2026-10-17')).toBe(false)
    expect(runs('první pátek', '2026-11-06')).toBe(true)
    expect(runs('první pátek', '2026-11-13')).toBe(false)
    expect(runs('1x za měsíc, poslední čtvrtek', '2026-10-29')).toBe(true)
    expect(runs('1x za měsíc, poslední čtvrtek', '2026-10-22')).toBe(false)
  })
  it('první/pouze variants', () => {
    expect(runs('pouze první sobota v měsíci', '2026-07-04')).toBe(true)
    expect(runs('pouze 3. neděle v měsíci', '2026-07-19')).toBe(true)
    expect(runs('pouze 3. neděle v měsíci', '2026-07-12')).toBe(false)
    expect(runs('Mše sv. je sloužena pouze 1. sobotu v měsíci.', '2026-07-11')).toBe(false)
  })
  it('2. a 4. neděle v měsíci', () => {
    expect(runs('2. a 4. neděle v měsíci', '2026-07-12')).toBe(true)
    expect(runs('2. a 4. neděle v měsíci', '2026-07-26')).toBe(true)
    expect(runs('2. a 4. neděle v měsíci', '2026-07-05')).toBe(false)
  })
  it('poslední neděle v měsíci', () => {
    expect(runs('poslední neděle v měsíci', '2026-07-26')).toBe(true)
    expect(runs('poslední neděle v měsíci', '2026-07-19')).toBe(false)
  })
  it('kromě 1. soboty / kromě poslední neděle', () => {
    expect(runs('kromě 1. soboty v měsíci', '2026-07-04')).toBe(false)
    expect(runs('kromě 1. soboty v měsíci', '2026-07-11')).toBe(true)
    expect(runs('kromě poslední neděle v měsíci', '2026-07-26')).toBe(false)
  })
  it('páté (genitive ordinal) parses as 5 without uncertain degradation', () => {
    // "páté soboty" = "fifth Saturday" in genitive case — must not fall back to uncertain
    expect(runs('páté soboty v měsíci', '2026-08-29')).toBe(true)  // 5th Saturday
    expect(runs('páté soboty v měsíci', '2026-08-22')).toBe(false) // 4th Saturday
    expect(noteUncertain('páté soboty v měsíci')).toBe(false)
  })
  it('comma-joined ordinals "1., 3. sobota v měsíci" — both treated as one multi-nth predicate (H1)', () => {
    // "1., 3. sobota v měsíci" means 1st OR 3rd Saturday; the comma is an ordinal
    // conjunction, not a segment separator.
    const note = '1., 3. sobota v měsíci'
    expect(runs(note, '2026-07-04')).toBe(true)  // 1st Saturday
    expect(runs(note, '2026-07-18')).toBe(true)  // 3rd Saturday
    expect(runs(note, '2026-07-11')).toBe(false) // 2nd Saturday
    expect(runs(note, '2026-07-05')).toBe(true)  // Sunday — note doesn't govern it
    expect(noteUncertain(note)).toBe(false)
  })
})

describe('week-of-month and parity', () => {
  it('1x za měsíc, N. týden v měsíci', () => {
    expect(runs('1x za měsíc, 1. týden v měsíci', '2026-07-03')).toBe(true)
    expect(runs('1x za měsíc, 1. týden v měsíci', '2026-07-10')).toBe(false)
    expect(noteUncertain('1x za měsíc, 1. týden v měsíci')).toBe(false) // sibling pins the week
    expect(runs('1x za měsíc, posl. týden v měsíci', '2026-07-27')).toBe(true)
    expect(runs('1x za měsíc, posl. týden v měsíci', '2026-07-10')).toBe(false)
  })
  it('sudý/lichý týden (ISO weeks)', () => {
    expect(runs('1x za 14 dní, sudý týden', '2026-07-06')).toBe(true) // ISO week 28
    expect(runs('1x za 14 dní, sudý týden', '2026-07-13')).toBe(false) // ISO week 29
    expect(runs('lichý týden', '2026-07-13')).toBe(true)
    expect(noteUncertain('1x za 14 dní, sudý týden')).toBe(false)
  })
})

describe('advent', () => {
  it('v adventu / kromě adventu', () => {
    expect(runs('v adventu', '2026-12-06')).toBe(true) // advent 2026: 29 Nov – 24 Dec
    expect(runs('v adventu', '2026-07-06')).toBe(false)
    expect(runs('kromě adventu', '2026-12-06')).toBe(false)
    expect(runs('kromě adventu', '2026-07-06')).toBe(true)
  })
  it('pouze / jen / během / v době adventní — the cathedral\'s rorate showed every October Sunday', () => {
    for (const n of ['pouze v adventu', 'jen v adventu', 'během adventu', 'v době adventní', 'pouze v době adventní']) {
      expect(runs(n, '2026-12-06'), n).toBe(true)
      expect(runs(n, '2026-10-11'), n).toBe(false)
    }
    for (const n of ['pouze v postní době', 'jen v době postní', 'během postu']) {
      expect(runs(n, '2027-03-07'), n).toBe(true) // Lent 2027: 10 Feb – 27 Mar
      expect(runs(n, '2026-10-11'), n).toBe(false)
    }
  })
  it('compound: kromě adventu a letních prázdnin', () => {
    expect(runs('kromě adventu a letních prázdnin', '2026-07-06')).toBe(false)
    expect(runs('kromě adventu a letních prázdnin', '2026-12-06')).toBe(false)
    expect(runs('kromě adventu a letních prázdnin', '2026-10-06')).toBe(true)
  })
  it('exclusion + schedule: exclusion is not cancelled by a schedule predicate (H1)', () => {
    // "kromě července a srpna, 1. sobota v měsíci" — should exclude July even on 1st Saturdays
    const note = 'kromě července a srpna, 1. sobota v měsíci'
    expect(runs(note, '2026-07-04')).toBe(false) // 1st Saturday of July — excluded
    expect(runs(note, '2026-08-01')).toBe(false) // 1st Saturday of August — excluded
    expect(runs(note, '2026-09-05')).toBe(true)  // 1st Saturday of September — runs
    expect(runs(note, '2026-09-12')).toBe(false) // 2nd Saturday of September — not 1st Sat
  })
})

describe('conditional-in-months', () => {
  it('v červenci a srpnu vždy pouze první sobota', () => {
    const note = 'V červenci a srpnu vždy pouze první sobota'
    expect(runs(note, '2026-07-04')).toBe(true) // 1st Saturday of July
    expect(runs(note, '2026-07-11')).toBe(false) // 2nd Saturday of July
    expect(runs(note, '2026-05-09')).toBe(true) // outside July/August: unrestricted
  })
})

describe('long-tail variants', () => {
  it('v lichém týdnu', () => {
    expect(runs('v lichém týdnu', '2026-07-13')).toBe(true) // ISO week 29
    expect(runs('v lichém týdnu', '2026-07-06')).toBe(false)
  })
  it('mimo letní prázdniny (accusative)', () => {
    expect(runs('mimo letní prázdniny', '2026-07-06')).toBe(false)
    expect(runs('mimo letní prázdniny', '2026-09-06')).toBe(true)
  })
  it('mimo červenec - srpen (dash range)', () => {
    expect(runs('mimo červenec - srpen', '2026-07-06')).toBe(false)
    expect(runs('mimo červenec - srpen', '2026-06-06')).toBe(true)
  })
  it('v adventu rorátní = advent-only', () => {
    expect(runs('v adventu rorátní', '2026-12-06')).toBe(true)
    expect(runs('v adventu rorátní', '2026-07-06')).toBe(false)
    expect(noteUncertain('v adventu rorátní')).toBe(false)
  })
  it('mimo dobu postní', () => {
    expect(runs('mimo dobu postní', '2026-02-20')).toBe(false) // Lent 2026: 18 Feb – 4 Apr
    expect(runs('mimo dobu postní', '2026-07-06')).toBe(true)
  })
  it('svátost smíření is not a feast condition', () => {
    expect(noteUncertain('půlhodiny před mší svatou je možnost přijetí svátosti smíření.')).toBe(false)
  })
})

describe('uncertain notes: kept, flagged', () => {
  it.each([
    '1x za 14 dní',
    '1x za 14 dní, jinak',
    'nepravidelně',
    'dle ohlášení',
    'svátky 18.00 hod',
    'nepravidelně, od července do 2. srpnového týdne',
  ])('%s → runs (never silently dropped) + uncertain', (note) => {
    expect(runs(note, '2026-07-06')).toBe(true)
    expect(noteUncertain(note)).toBe(true)
  })
  it('descriptive tails do not flag parsed notes', () => {
    expect(noteUncertain('letní čas, mše svatá')).toBe(false)
  })
  it('an uncertain sibling degrades a parsed exclusion to kept-uncertain', () => {
    // "školní rok, dle ohlášení" — July would be provably out, but "dle
    // ohlášení" is uncertain: don't hide a mass the note half-explains, keep
    // it and flag it loud (reviewed: a flagged row beats a silent drop).
    expect(runs('školní rok, dle ohlášení', '2026-07-06')).toBe(true)
    expect(noteUncertain('školní rok, dle ohlášení')).toBe(true)
  })
  it('školní-rok / prázdniny split does not hide the summer mass', () => {
    const note = 've školním roce v 18:00, o prázdninách v 8:00'
    expect(runs(note, '2026-07-06')).toBe(true) // summer 8:00 mass kept, not hidden
    expect(runs(note, '2026-11-06')).toBe(true) // school-year exclusion no longer trusted
    expect(noteUncertain(note)).toBe(true) // flagged loud instead
  })
})

// A multi-day service ("135" = Po/St/Pá) expands into one row per day; a note
// that names one of those days belongs on that row only. Cases are real
// registry notes (2026-10-14 scan: 14 multi-day services name a weekday).
describe('noteShownOnDay', () => {
  it('a note about Friday shows on the Friday row only (church 10009)', () => {
    const note = 'V červenci, srpnu a září není páteční mše sv.'
    expect(noteShownOnDay(note, '135', 5)).toBe(true)
    expect(noteShownOnDay(note, '135', 1)).toBe(false)
    expect(noteShownOnDay(note, '135', '3')).toBe(false)
  })
  it('reads the usual Czech forms', () => {
    expect(noteShownOnDay('v úterý na mši navazují nešpory', '246', 2)).toBe(true)
    expect(noteShownOnDay('v úterý na mši navazují nešpory', '246', 4)).toBe(false)
    expect(noteShownOnDay('Každý čtvrtek po mši sv. je krátká tichá adorace', '123457', 1)).toBe(false)
    expect(noteShownOnDay('1. pátek v měsíci v 17.30 adorace', '354', 5)).toBe(true)
    expect(noteShownOnDay('1. pátek v měsíci v 17.30 adorace', '354', 3)).toBe(false)
    expect(noteShownOnDay('v sobotu mše sv. s nedělní platností', '12456', 6)).toBe(true)
    expect(noteShownOnDay('v sobotu mše sv. s nedělní platností', '12456', 1)).toBe(false)
    expect(noteShownOnDay('Úterý bohoslužba slova, středa mše svatá', '23', 3)).toBe(true)
  })
  it('"jen/pouze" restricts the other days, so it stays on every row', () => {
    expect(noteShownOnDay('v době letních prázdnin jsou mše jen v sobotu', '23456', 2)).toBe(true)
    expect(noteShownOnDay('během letních prázdnin pouze pondělí, středa, pátek', '123456', 2)).toBe(true)
  })
  it('stays everywhere when it names no weekday, or only days the service lacks', () => {
    expect(noteShownOnDay('kromě července a srpna', '135', 1)).toBe(true)
    expect(noteShownOnDay('po nedělní mši setkání', '135', 1)).toBe(true)
    expect(noteShownOnDay('', '135', 1)).toBe(true)
  })
  it('does not mistake look-alike words for weekdays', () => {
    expect(noteShownOnDay('uprostřed náměstí, čtvrt hodiny před mší zpověď', '135', 1)).toBe(true)
    expect(noteShownOnDay('pátý ročník poutě', '135', 1)).toBe(true)
  })
})

describe('exclusions read exactly what they name (sweep 2026-09-30, consolidated)', () => {
  it('a date range before an ordinal list stays its own segment', () => {
    const note = 'období od 01.10. do 31.10., 3. sobota v měsíci'
    expect(noteUncertain(note)).toBe(false)
    expect(runs(note, '2026-10-17')).toBe(true) // 3rd Saturday of October
    expect(runs(note, '2026-10-10')).toBe(false) // 2nd Saturday
    expect(runs(note, '2026-11-21')).toBe(false) // 3rd Saturday, but November
  })
  it('two unrelated conditions both hold: "letní čas, 1. týden v měsíci" is not all year', () => {
    const note = 'letní čas, 1x za měsíc, 1. týden v měsíci'
    expect(runs(note, '2026-07-03')).toBe(true) // summer, 1st week
    expect(runs(note, '2026-07-10')).toBe(false) // summer, 2nd week
    expect(runs(note, '2026-12-04')).toBe(false) // 1st week, but winter time
  })
  it('"kromě 1. neděle v měsíci" drops only that Sunday, never a weekday (e876eb4)', () => {
    const note = 'kromě 1. neděle v měsíci'
    expect(runs(note, '2026-07-05')).toBe(false) // 1st Sunday
    expect(runs(note, '2026-07-06')).toBe(true) // Monday — was excluded
    expect(runs(note, '2026-07-12')).toBe(true) // 2nd Sunday
  })
  it('stacked exclusions each still hold (09769a1)', () => {
    const note = 'kromě července, kromě srpna'
    expect(runs(note, '2026-07-10')).toBe(false)
    expect(runs(note, '2026-08-10')).toBe(false)
    expect(runs(note, '2026-09-10')).toBe(true)
  })
  it('"nekoná se pouze 1. sobotu" is not read as "only the 1st Saturday" (52d55d5)', () => {
    const note = 'mše sv. se nekoná pouze 1. sobotu v měsíci'
    expect(runs(note, '2026-07-11')).toBe(true) // 2nd Saturday — was hidden
    expect(noteUncertain(note)).toBe(true) // can't prove it either way → shown, flagged
  })
})

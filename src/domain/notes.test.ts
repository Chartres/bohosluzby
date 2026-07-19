// The trust-critical parser: a July tourist must not be sent to a mass that
// provably doesn't run ("mimo červenec a srpen"). Only provable exclusions
// exclude; unparseable conditional notes stay visible and are flagged uncertain.
import { describe, expect, it } from 'vitest'
import { parseNote, noteUncertain } from './notes'

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
  it('compound: kromě adventu a letních prázdnin', () => {
    expect(runs('kromě adventu a letních prázdnin', '2026-07-06')).toBe(false)
    expect(runs('kromě adventu a letních prázdnin', '2026-12-06')).toBe(false)
    expect(runs('kromě adventu a letních prázdnin', '2026-10-06')).toBe(true)
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

// localStorage path (supabase is null with no VITE_SUPABASE_* env): submit
// mirrors locally, loadAggregates folds the mirror into the cache, aggregateFor
// reads it synchronously. Force supabase null so a local .env.local can't make
// these tests hit the live DB (CI has no env, so it was green there only).
import { vi } from 'vitest'
vi.mock('./supabase', () => ({ supabase: null }))
import {
  CORROBORATION_MIN,
  aggregateFor,
  divergentChips,
  loadAggregates,
  rankChurchTags,
  rankDistinctive,
  submitFeedback,
  suggestTag,
} from './feedbackStore'

afterEach(() => localStorage.clear())

// occurrence fields are irrelevant to the localStorage aggregation path (it
// folds churchId/massKey/deviceId/chips) — pass placeholders to satisfy the type
const OCC = { weekday: 7, time: '09:30', rite: 'ord' as const, lang: 'česky', massDate: '2026-07-05' }
const sub = (massKey: string, chips: string[]) =>
  submitFeedback({ churchId: 'c1', massKey, chips, ...OCC })
const aggAfterLoad = async (churchId: string) => {
  await loadAggregates([churchId])
  return aggregateFor(churchId).slots
}

// Bypass resolveIds() to write rows with explicit deviceIds — lets tests meet
// CORROBORATION_MIN (3 distinct devices) without needing a real multi-device env.
const STORE_KEY = 'bohosluzby:massFeedback'
const subAs = (deviceId: string, massKey: string, chips: string[]) => {
  const list = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as Array<{
    churchId: string; massKey: string; deviceId: string; chips: string[]
  }>
  const i = list.findIndex((r) => r.churchId === 'c1' && r.massKey === massKey && r.deviceId === deviceId)
  const row = { churchId: 'c1', massKey, deviceId, chips }
  if (i >= 0) list[i] = row; else list.push(row)
  localStorage.setItem(STORE_KEY, JSON.stringify(list))
}

describe('aggregateFor', () => {
  it('counts witnesses and surfaces chips once corroboration threshold met', async () => {
    // Three distinct devices must select a chip before it surfaces (CORROBORATION_MIN=3).
    subAs('d1', 'c1|w7|09:30', ['hluboky_prozitek', 'krasny_zpev'])
    subAs('d2', 'c1|w7|09:30', ['hluboky_prozitek', 'krasny_zpev'])
    subAs('d3', 'c1|w7|09:30', ['hluboky_prozitek', 'krasny_zpev'])
    const agg = (await aggAfterLoad('c1')).get('c1|w7|09:30')!
    expect(agg.witnesses).toBe(3)
    expect(agg.chips.map((c) => c.id)).toEqual(['hluboky_prozitek', 'krasny_zpev'])
  })

  it('single witness is counted but chips are below threshold', async () => {
    sub('c1|w7|09:30', ['hluboky_prozitek'])
    const agg = (await aggAfterLoad('c1')).get('c1|w7|09:30')!
    expect(agg.witnesses).toBe(1)
    expect(agg.chips).toHaveLength(0) // count=1 < CORROBORATION_MIN=3
  })

  it('returns chips in the locked display order, not selection order', async () => {
    subAs('d1', 'c1|w7|09:30', ['krasny_zpev', 'hluboky_prozitek'])
    subAs('d2', 'c1|w7|09:30', ['krasny_zpev', 'hluboky_prozitek'])
    subAs('d3', 'c1|w7|09:30', ['krasny_zpev', 'hluboky_prozitek'])
    const agg = (await aggAfterLoad('c1')).get('c1|w7|09:30')!
    expect(agg.chips.map((c) => c.id)).toEqual(['hluboky_prozitek', 'krasny_zpev'])
  })

  it('hides chips below the corroboration threshold', async () => {
    // an unselected chip has count 0 < CORROBORATION_MIN → never shown
    subAs('d1', 'c1|w7|09:30', ['hluboky_prozitek'])
    subAs('d2', 'c1|w7|09:30', ['hluboky_prozitek'])
    subAs('d3', 'c1|w7|09:30', ['hluboky_prozitek'])
    const agg = (await aggAfterLoad('c1')).get('c1|w7|09:30')!
    expect(agg.chips.some((c) => c.id === 'krasny_zpev')).toBe(false)
    expect(CORROBORATION_MIN).toBe(3) // single device cannot publish chips
  })

  it('keeps masses and churches separate; ignores other churches', async () => {
    sub('c1|w7|09:30', ['hluboky_prozitek'])
    sub('c1|w1|18:00', ['krasny_zpev'])
    submitFeedback({ churchId: 'c2', massKey: 'c2|w7|09:30', chips: ['vrele_prijeti'], ...OCC })
    const agg = await aggAfterLoad('c1')
    expect([...agg.keys()].sort()).toEqual(['c1|w1|18:00', 'c1|w7|09:30'])
  })

  it('upserts one row per device per mass (a re-save does not double-count)', async () => {
    sub('c1|w7|09:30', ['hluboky_prozitek'])
    sub('c1|w7|09:30', ['hluboky_prozitek', 'krasny_zpev']) // same device, revised
    const agg = (await aggAfterLoad('c1')).get('c1|w7|09:30')!
    expect(agg.witnesses).toBe(1) // one device still counts as one witness
    // chips are below threshold (1 device < CORROBORATION_MIN=3) — that is expected
    expect(agg.chips).toHaveLength(0)
  })
})

describe('rankDistinctive', () => {
  const chip = (id: string, count: number) => ({ id, count })

  it('down-weights a tag common across churches below a rarer, lower-count one', () => {
    // rodinná atmosféra is louder here (5 vs 3) but present in every church;
    // krásný zpěv marks this church out, so distinctiveness ranks it first.
    const target = [chip('rodinna_atmosfera', 5), chip('krasny_zpev', 3)]
    const corpus = [
      [chip('rodinna_atmosfera', 5), chip('krasny_zpev', 3)],
      [chip('rodinna_atmosfera', 4)],
      [chip('rodinna_atmosfera', 6)],
    ]
    expect(rankDistinctive(target, corpus).map((c) => c.id)).toEqual([
      'krasny_zpev',
      'rodinna_atmosfera',
    ])
  })

  it('caps at the top three (inflation cap)', () => {
    const target = [
      chip('hluboky_prozitek', 4),
      chip('krasny_zpev', 3),
      chip('vrele_prijeti', 2),
      chip('rodinna_atmosfera', 1),
    ]
    // two churches → distinctiveness applies, but every tag is unique here so
    // order stays by count; only three survive the cap.
    const corpus = [target, [chip('dustojna_atmosfera', 2)]]
    expect(rankDistinctive(target, corpus).map((c) => c.id)).toEqual([
      'hluboky_prozitek',
      'krasny_zpev',
      'vrele_prijeti',
    ])
  })

  it('falls back to raw count order with too few churches to compare', () => {
    const target = [chip('rodinna_atmosfera', 5), chip('krasny_zpev', 3)]
    // one church loaded → no notion of "common everywhere", keep frequency order
    expect(rankDistinctive(target, [target]).map((c) => c.id)).toEqual([
      'rodinna_atmosfera',
      'krasny_zpev',
    ])
  })
})

describe('rankChurchTags', () => {
  it('ranks the church-wide tier and caps it at three', async () => {
    // Multiple devices across masses: counts are church-wide (across all mass keys).
    // hluboky: 4, krasny: 3, vrele: 3, rodinna: 1 → top 3 after cap, hluboky first.
    subAs('d1', 'c1|w7|09:30', ['hluboky_prozitek', 'krasny_zpev', 'vrele_prijeti'])
    subAs('d2', 'c1|w7|09:30', ['hluboky_prozitek', 'krasny_zpev', 'vrele_prijeti'])
    subAs('d3', 'c1|w7|09:30', ['hluboky_prozitek', 'krasny_zpev', 'vrele_prijeti'])
    subAs('d4', 'c1|w7|09:30', ['hluboky_prozitek'])
    subAs('d5', 'c1|w1|18:00', ['rodinna_atmosfera'])
    await loadAggregates(['c1'])
    const tags = rankChurchTags('c1')
    expect(tags).toHaveLength(3)
    expect(tags[0].id).toBe('hluboky_prozitek') // count 4, the loudest
  })
})

describe('divergentChips', () => {
  const agg = (ids: string[]) => ({
    massKey: 'k',
    witnesses: 1,
    chips: ids.map((id) => ({ id, count: 1 })),
  })

  it('surfaces a slot tag the church block does not already carry', () => {
    const slot = agg(['krasny_zpev', 'hluboky_prozitek'])
    expect(divergentChips(slot, ['hluboky_prozitek']).map((c) => c.id)).toEqual(['krasny_zpev'])
  })

  it('says nothing when the slot is covered by the church top tags', () => {
    const slot = agg(['hluboky_prozitek'])
    expect(divergentChips(slot, ['hluboky_prozitek', 'krasny_zpev'])).toEqual([])
  })

  it('is empty for a Mass with no aggregate', () => {
    expect(divergentChips(undefined, ['hluboky_prozitek'])).toEqual([])
  })
})

describe('suggestTag', () => {
  it('stores a trimmed suggestion privately and ignores blank text', () => {
    suggestTag('  latina s gregoriánským chorálem  ')
    suggestTag('   ')
    const list = JSON.parse(localStorage.getItem('bohosluzby:tagSuggestions')!)
    expect(list).toHaveLength(1)
    expect(list[0].text).toBe('latina s gregoriánským chorálem')
  })
})

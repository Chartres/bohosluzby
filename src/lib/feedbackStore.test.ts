import { CORROBORATION_MIN, aggregateFor, submitFeedback, suggestTag } from './feedbackStore'

afterEach(() => localStorage.clear())

const sub = (massKey: string, chips: string[], lang: string | null = null) =>
  submitFeedback({ churchId: 'c1', massKey, chips, lang: lang as never })

describe('aggregateFor', () => {
  it('counts a witness and surfaces its chosen chips', () => {
    sub('c1|w7|09:30', ['hluboky_prozitek', 'krasny_zpev'])
    const agg = aggregateFor('c1').get('c1|w7|09:30')!
    expect(agg.witnesses).toBe(1)
    expect(agg.chips.map((c) => c.id)).toEqual(['hluboky_prozitek', 'krasny_zpev'])
  })

  it('returns chips in the locked display order, not selection order', () => {
    sub('c1|w7|09:30', ['krasny_zpev', 'hluboky_prozitek'])
    const agg = aggregateFor('c1').get('c1|w7|09:30')!
    expect(agg.chips.map((c) => c.id)).toEqual(['hluboky_prozitek', 'krasny_zpev'])
  })

  it('hides chips below the corroboration threshold', () => {
    // an unselected chip has count 0 < CORROBORATION_MIN → never shown
    sub('c1|w7|09:30', ['hluboky_prozitek'])
    const agg = aggregateFor('c1').get('c1|w7|09:30')!
    expect(agg.chips.some((c) => c.id === 'krasny_zpev')).toBe(false)
    expect(CORROBORATION_MIN).toBe(1) // local prototype value
  })

  it('keeps masses and churches separate; ignores other churches', () => {
    sub('c1|w7|09:30', ['hluboky_prozitek'])
    sub('c1|w1|18:00', ['krasny_zpev'])
    submitFeedback({ churchId: 'c2', massKey: 'c2|w7|09:30', chips: ['vrele_prijeti'], lang: null })
    const agg = aggregateFor('c1')
    expect([...agg.keys()].sort()).toEqual(['c1|w1|18:00', 'c1|w7|09:30'])
  })

  it('upserts one row per device per mass (a re-save does not double-count)', () => {
    sub('c1|w7|09:30', ['hluboky_prozitek'])
    sub('c1|w7|09:30', ['hluboky_prozitek', 'krasny_zpev']) // same device, revised
    const agg = aggregateFor('c1').get('c1|w7|09:30')!
    expect(agg.witnesses).toBe(1)
    expect(agg.chips.map((c) => c.id)).toEqual(['hluboky_prozitek', 'krasny_zpev'])
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

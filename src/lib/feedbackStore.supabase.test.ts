// Supabase path (client STUBBED — no network): loadAggregates selects visible
// rows for the requested churches and folds them into TWO tiers — per-Mass slot
// aggregates and one church-wide aggregate. submitFeedback writes through the
// submit-feedback Edge Function (the only anon-writable path). Witnesses are
// DISTINCT devices; chips are thresholded by CORROBORATION_MIN and ordered by
// frequency.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  rows: [] as { church_id: string; mass_key: string; device_id: string; chips: string[] }[],
  query: null as { table: string; status: string; ids: string[] } | null,
  invoked: null as { name: string; body: Record<string, unknown> } | null,
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, status: string) => ({
          in: (_c2: string, ids: string[]) => {
            h.query = { table, status, ids }
            return Promise.resolve({ data: h.rows, error: null })
          },
        }),
      }),
    }),
    functions: {
      invoke: (name: string, opts: { body: Record<string, unknown> }) => {
        h.invoked = { name, body: opts.body }
        return Promise.resolve({ data: { ok: true }, error: null })
      },
    },
  },
}))

vi.mock('../platform/flywheel-client', () => ({
  resolveIds: () => ({ visitor_id: 'device-under-test' }),
}))

import { aggregateFor, churchHasTags, clearAggregateCache, loadAggregates, submitFeedback } from './feedbackStore'

beforeEach(() => {
  h.rows = []
  h.query = null
  h.invoked = null
  localStorage.clear()
  clearAggregateCache()
})

describe('loadAggregates (supabase stub)', () => {
  it('queries visible rows for exactly the requested churches', async () => {
    await loadAggregates(['c1', 'c2', 'c1']) // deduped
    expect(h.query).toEqual({ table: 'mass_feedback', status: 'visible', ids: ['c1', 'c2'] })
  })

  it('counts distinct devices as witnesses and sums per-chip counts (frequency order)', async () => {
    // Five devices: hluboky_prozitek=5, krasny_zpev=3 (both ≥ CORROBORATION_MIN=3).
    h.rows = [
      { church_id: 'c1', mass_key: 'm', device_id: 'd1', chips: ['krasny_zpev', 'hluboky_prozitek'] },
      { church_id: 'c1', mass_key: 'm', device_id: 'd2', chips: ['krasny_zpev', 'hluboky_prozitek'] },
      { church_id: 'c1', mass_key: 'm', device_id: 'd3', chips: ['krasny_zpev', 'hluboky_prozitek'] },
      { church_id: 'c1', mass_key: 'm', device_id: 'd4', chips: ['hluboky_prozitek'] },
      { church_id: 'c1', mass_key: 'm', device_id: 'd5', chips: ['hluboky_prozitek'] },
    ]
    await loadAggregates(['c1'])
    const a = aggregateFor('c1').slots.get('m')!
    expect(a.witnesses).toBe(5)
    // hluboky_prozitek chosen 5 times, krasny_zpev 3 times — most-frequent first
    expect(a.chips).toEqual([
      { id: 'hluboky_prozitek', count: 5 },
      { id: 'krasny_zpev', count: 3 },
    ])
  })

  it('does not double-count a device that appears twice (dedup by device)', async () => {
    h.rows = [
      { church_id: 'c1', mass_key: 'm', device_id: 'd1', chips: ['hluboky_prozitek'] },
      { church_id: 'c1', mass_key: 'm', device_id: 'd1', chips: ['hluboky_prozitek'] },
    ]
    await loadAggregates(['c1'])
    expect(aggregateFor('c1').slots.get('m')!.witnesses).toBe(1)
  })

  it('omits chips below the corroboration threshold (unselected chips)', async () => {
    h.rows = [{ church_id: 'c1', mass_key: 'm', device_id: 'd1', chips: ['hluboky_prozitek'] }]
    await loadAggregates(['c1'])
    const a = aggregateFor('c1').slots.get('m')!
    expect(a.chips.some((c) => c.id === 'krasny_zpev')).toBe(false)
  })

  it('caches an empty map for a requested church with no rows', async () => {
    await loadAggregates(['c3'])
    expect(aggregateFor('c3').slots.size).toBe(0)
    expect(aggregateFor('c3').church.chips).toEqual([])
  })
})

describe('two-tier aggregation (slot + church)', () => {
  it('folds every Mass into the church-wide tier', async () => {
    // Three devices per mass key so chips clear CORROBORATION_MIN=3.
    // m1: krasny_zpev×3; m2: krasny_zpev×3 + vrele_prijeti×3 → church: krasny=6, vrele=3.
    h.rows = [
      { church_id: 'c1', mass_key: 'm1', device_id: 'd1', chips: ['krasny_zpev'] },
      { church_id: 'c1', mass_key: 'm1', device_id: 'd2', chips: ['krasny_zpev'] },
      { church_id: 'c1', mass_key: 'm1', device_id: 'd3', chips: ['krasny_zpev'] },
      { church_id: 'c1', mass_key: 'm2', device_id: 'd4', chips: ['krasny_zpev', 'vrele_prijeti'] },
      { church_id: 'c1', mass_key: 'm2', device_id: 'd5', chips: ['krasny_zpev', 'vrele_prijeti'] },
      { church_id: 'c1', mass_key: 'm2', device_id: 'd6', chips: ['krasny_zpev', 'vrele_prijeti'] },
    ]
    await loadAggregates(['c1'])
    const { slots, church } = aggregateFor('c1')
    // slot tier keeps the two masses apart
    expect([...slots.keys()].sort()).toEqual(['m1', 'm2'])
    // church tier merges them: 6 devices, krasny_zpev 6× (most-frequent first)
    expect(church.witnesses).toBe(6)
    expect(church.chips).toEqual([
      { id: 'krasny_zpev', count: 6 },
      { id: 'vrele_prijeti', count: 3 },
    ])
  })
})

describe('churchHasTags (witness filter predicate)', () => {
  beforeEach(async () => {
    // Three devices per slot so each chip clears CORROBORATION_MIN=3.
    h.rows = [
      { church_id: 'c1', mass_key: 'm1', device_id: 'd1', chips: ['krasny_zpev'] },
      { church_id: 'c1', mass_key: 'm1', device_id: 'd2', chips: ['krasny_zpev'] },
      { church_id: 'c1', mass_key: 'm1', device_id: 'd3', chips: ['krasny_zpev'] },
      { church_id: 'c1', mass_key: 'm2', device_id: 'd4', chips: ['vrele_prijeti'] },
      { church_id: 'c1', mass_key: 'm2', device_id: 'd5', chips: ['vrele_prijeti'] },
      { church_id: 'c1', mass_key: 'm2', device_id: 'd6', chips: ['vrele_prijeti'] },
    ]
    await loadAggregates(['c1'])
  })
  it('matches a tag present at a specific slot', () => {
    expect(churchHasTags('c1', 'm1', ['krasny_zpev'])).toBe(true)
  })
  it('falls back to the church tier when the slot lacks the tag', () => {
    // m1's slot has no vrele_prijeti, but the church tier does
    expect(churchHasTags('c1', 'm1', ['vrele_prijeti'])).toBe(true)
  })
  it('with no specific mass, any slot carrying the tag matches', () => {
    expect(churchHasTags('c1', null, ['vrele_prijeti'])).toBe(true)
  })
  it('requires ALL selected tags', () => {
    // no single mass has both, but the church tier does (union across masses)
    expect(churchHasTags('c1', 'm1', ['krasny_zpev', 'vrele_prijeti'])).toBe(true)
    expect(churchHasTags('c1', 'm1', ['krasny_zpev', 'dustojna_atmosfera'])).toBe(false)
  })
  it('empty tag set always matches', () => {
    expect(churchHasTags('c1', 'm1', [])).toBe(true)
  })
})

describe('submitFeedback (Edge Function write path)', () => {
  it('invokes submit-feedback with the occurrence body, not a direct table write', async () => {
    submitFeedback({
      churchId: 'c1',
      massKey: 'c1|w7|09:30|lat|latinsky',
      chips: ['krasny_zpev'],
      weekday: 7,
      time: '09:30',
      rite: 'lat',
      lang: 'latinsky',
      massDate: '2026-07-05',
    })
    expect(h.invoked!.name).toBe('submit-feedback')
    expect(h.invoked!.body).toEqual({
      church_id: 'c1',
      mass_key: 'c1|w7|09:30|lat|latinsky',
      device_id: 'device-under-test',
      chips: ['krasny_zpev'],
      weekday: 7,
      mass_time: '09:30',
      rite: 'lat',
      lang: 'latinsky',
      mass_date: '2026-07-05',
    })
  })
})

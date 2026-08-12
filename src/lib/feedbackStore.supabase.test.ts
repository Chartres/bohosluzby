// Supabase path (client STUBBED — no network): loadAggregates selects visible
// rows for the requested churches and folds them into per-Mass aggregates —
// witnesses are DISTINCT devices, chips are thresholded by CORROBORATION_MIN.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  rows: [] as { church_id: string; mass_key: string; device_id: string; chips: string[] }[],
  query: null as { table: string; status: string; ids: string[] } | null,
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
  },
}))

import { aggregateFor, loadAggregates } from './feedbackStore'

beforeEach(() => {
  h.rows = []
  h.query = null
})

describe('loadAggregates (supabase stub)', () => {
  it('queries visible rows for exactly the requested churches', async () => {
    await loadAggregates(['c1', 'c2', 'c1']) // deduped
    expect(h.query).toEqual({ table: 'mass_feedback', status: 'visible', ids: ['c1', 'c2'] })
  })

  it('counts distinct devices as witnesses and sums per-chip counts', async () => {
    h.rows = [
      { church_id: 'c1', mass_key: 'm', device_id: 'd1', chips: ['hluboky_prozitek', 'krasny_zpev'] },
      { church_id: 'c1', mass_key: 'm', device_id: 'd2', chips: ['hluboky_prozitek'] },
    ]
    await loadAggregates(['c1'])
    const a = aggregateFor('c1').get('m')!
    expect(a.witnesses).toBe(2)
    // hluboky_prozitek chosen twice, krasny_zpev once — both over the threshold (1),
    // returned in the locked display order
    expect(a.chips).toEqual([
      { id: 'hluboky_prozitek', count: 2 },
      { id: 'krasny_zpev', count: 1 },
    ])
  })

  it('does not double-count a device that appears twice (dedup by device)', async () => {
    h.rows = [
      { church_id: 'c1', mass_key: 'm', device_id: 'd1', chips: ['hluboky_prozitek'] },
      { church_id: 'c1', mass_key: 'm', device_id: 'd1', chips: ['hluboky_prozitek'] },
    ]
    await loadAggregates(['c1'])
    expect(aggregateFor('c1').get('m')!.witnesses).toBe(1)
  })

  it('omits chips below the corroboration threshold (unselected chips)', async () => {
    h.rows = [{ church_id: 'c1', mass_key: 'm', device_id: 'd1', chips: ['hluboky_prozitek'] }]
    await loadAggregates(['c1'])
    const a = aggregateFor('c1').get('m')!
    expect(a.chips.some((c) => c.id === 'krasny_zpev')).toBe(false)
  })

  it('caches an empty map for a requested church with no rows', async () => {
    await loadAggregates(['c3'])
    expect(aggregateFor('c3').size).toBe(0)
  })
})

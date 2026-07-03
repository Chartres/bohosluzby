import { rankUpcoming } from './ranking'
import type { Church, ChurchServices } from './data'

const church = (id: string, lat: number, lng: number): Church => ({
  id,
  name: `kostel ${id}`,
  city: 'Praha',
  lat,
  lng,
  barrierFree: false,
  cell: '50-14',
})

const services = (regular: { days: string; time: string }[], extra: { date: string; time: string }[] = []) =>
  ({
    updated: '2026-06-01',
    parish: '',
    parishAddress: '',
    contacts: [],
    regular: regular.map((r) => ({ ...r, lang: 'česky', greek: false, type: 'mše sv.', note: '' })),
    extra: extra.map((r) => ({ ...r, lang: 'česky', greek: false, type: 'mše sv.', note: '' })),
  }) satisfies ChurchServices

// Friday 3 Jul 2026, 17:00 Prague (15:00 UTC); origin = Prague centre.
const now = new Date('2026-07-03T15:00:00Z')
const origin = { lat: 50.0875, lng: 14.4213 }

describe('rankUpcoming — soonest you can make it', () => {
  it('sorts by the earliest reachable start, not raw distance', () => {
    const near = church('near', 50.088, 14.422) // ~50 m away, mass tomorrow
    const far = church('far', 50.1, 14.45) // ~2.5 km away, mass in 65 min
    const ranked = rankUpcoming(
      now,
      origin,
      [near, far],
      new Map([
        [near.id, services([{ days: '6', time: '09:00' }])],
        [far.id, services([{ days: '5', time: '18:05' }])],
      ]),
    )
    expect(ranked.map((r) => r.church.id)).toEqual(['far', 'near'])
  })

  it('skips services you cannot walk to in time', () => {
    // 18:00 mass, 5 km away → ~67 min walk but only 60 min remain: unreachable.
    // Its 19:30 mass is reachable and wins over the near church at 20:00.
    const far = church('far', 50.1325, 14.4213)
    const near = church('near', 50.088, 14.422)
    const ranked = rankUpcoming(
      now,
      origin,
      [far, near],
      new Map([
        [far.id, services([{ days: '5', time: '18:00' }, { days: '5', time: '19:30' }])],
        [near.id, services([{ days: '5', time: '20:00' }])],
      ]),
    )
    expect(ranked[0].church.id).toBe('far')
    expect(ranked[0].start.toISOString()).toBe('2026-07-03T17:30:00.000Z')
  })

  it('includes one-off (extra) services and carries distance + service through', () => {
    const c = church('x', 50.09, 14.43)
    const ranked = rankUpcoming(now, origin, [c], new Map([[c.id, services([], [{ date: '2026-07-04', time: '08:00' }])]]))
    expect(ranked).toHaveLength(1)
    expect(ranked[0].service.type).toBe('mše sv.')
    expect(ranked[0].distanceKm).toBeGreaterThan(0)
    expect(ranked[0].distanceKm).toBeLessThan(1)
  })

  it('returns [] when no church has an upcoming service', () => {
    const c = church('x', 50.09, 14.43)
    expect(rankUpcoming(now, origin, [c], new Map([[c.id, services([], [{ date: '2026-07-01', time: '08:00' }])]]))).toEqual([])
  })

  it('respects the limit', () => {
    const churches = Array.from({ length: 30 }, (_, i) => church(String(i), 50.09 + i * 0.001, 14.43))
    const map = new Map(churches.map((c) => [c.id, services([{ days: '1234567', time: '18:00' }])]))
    expect(rankUpcoming(now, origin, churches, map, { limit: 10 })).toHaveLength(10)
  })
})

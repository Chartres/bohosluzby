import { ordoForDay, rankUpcoming } from './ranking'
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
  it('sorts by the earliest start time, not raw distance', () => {
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

  it('never excludes a service on distance — no walk-only reachability filter', () => {
    // 18:00 mass, 5 km away: too far to walk in the 60 min remaining, but it
    // still shows (and wins, being soonest) — a car or transit might get you
    // there in a fraction of the walking estimate.
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
    expect(ranked[0].start.toISOString()).toBe('2026-07-03T16:00:00.000Z') // 18:00 Prague (CEST +2)
  })

  it('ties on start time are broken by distance', () => {
    const near = church('near', 50.088, 14.422) // ~50 m away
    const far = church('far', 50.1325, 14.4213) // ~5 km away
    const ranked = rankUpcoming(
      now,
      origin,
      [far, near], // far listed first — the sort, not input order, must decide
      new Map([
        [far.id, services([{ days: '5', time: '18:00' }])],
        [near.id, services([{ days: '5', time: '18:00' }])],
      ]),
    )
    expect(ranked.map((r) => r.church.id)).toEqual(['near', 'far'])
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

  it('excludes services whose note provably rules out the date (July: "mimo červenec a srpen")', () => {
    const c = church('x', 50.088, 14.422)
    const svc = services([{ days: '5', time: '18:00' }, { days: '5', time: '19:00' }])
    svc.regular[0].note = 'mimo červenec a srpen'
    svc.regular[1].note = 'období od července do srpna'
    const ranked = rankUpcoming(now, origin, [c], new Map([[c.id, svc]]))
    // it is 3 July: the 18:00 does not run; the church's real July mass (19:00) wins
    expect(ranked).toHaveLength(1)
    expect(ranked[0].service.time).toBe('19:00')
  })

  it('keeps services with unparseable conditional notes (never a silent drop)', () => {
    const c = church('x', 50.088, 14.422)
    const svc = services([{ days: '5', time: '18:00' }])
    svc.regular[0].note = 'nepravidelně, dle ohlášení'
    expect(rankUpcoming(now, origin, [c], new Map([[c.id, svc]]))).toHaveLength(1)
  })
})

describe('ordoForDay — the planning view', () => {
  // now is Friday 3 Jul 2026; Sunday = offset 2
  const c1 = church('a', 50.088, 14.422)
  const c2 = church('b', 50.09, 14.43)
  const map = new Map([
    [c1.id, services([{ days: '7', time: '09:00' }, { days: '7', time: '11:30' }, { days: '5', time: '18:00' }])],
    [c2.id, services([{ days: '67', time: '08:00' }], [{ date: '2026-07-05', time: '15:00' }])],
  ])

  it('lists every service on the chosen day, chronological, all churches', () => {
    const rows = ordoForDay(now, 2, origin, [c1, c2], map)
    expect(rows.map((r) => [r.church.id, r.service.time])).toEqual([
      ['b', '08:00'],
      ['a', '09:00'],
      ['a', '11:30'],
      ['b', '15:00'], // the one-off lands in its day
    ])
  })

  it('today (offset 0) shows only what is still ahead — but without a walk buffer', () => {
    const rows = ordoForDay(now, 0, origin, [c1, c2], map)
    // Friday: only c1's 18:00 remains (it is 17:00 now)
    expect(rows.map((r) => [r.church.id, r.service.time])).toEqual([['a', '18:00']])
  })

  it('empty day yields []', () => {
    expect(ordoForDay(now, 3, origin, [c1], map)).toEqual([]) // Monday: c1 has nothing
  })
})

describe('selectUpcoming — okruh (maxKm) filter', () => {
  const near = church('near', 50.088, 14.422) // ~50 m
  const far = church('far', 50.2, 14.6) // ~17 km
  const byId = new Map([
    [near.id, services([{ days: '5', time: '18:00' }])],
    [far.id, services([{ days: '5', time: '18:00' }])],
  ])
  const f = { lang: null, greek: false, barrierFree: false, massOnly: false, maxKm: null }

  it('maxKm drops churches beyond the radius in both day modes', async () => {
    const { selectUpcoming } = await import('./ranking')
    const hned = selectUpcoming(now, origin, [near, far], byId, { ...f, maxKm: 5 }, null, 'now')
    expect(hned.map((r) => r.church.id)).toEqual(['near'])
    const ordo = selectUpcoming(now, origin, [near, far], byId, { ...f, maxKm: 5 }, null, 0)
    expect(ordo.map((r) => r.church.id)).toEqual(['near'])
  })

  it('maxKm null keeps everything', async () => {
    const { selectUpcoming } = await import('./ranking')
    const rows = selectUpcoming(now, origin, [near, far], byId, f, null, 'now')
    expect(rows.map((r) => r.church.id).sort()).toEqual(['far', 'near'])
  })
})

import { dayLine, ordoForDay, rankUpcoming } from './ranking'
import { isMass } from './filters'
import { dayLabel } from './format'
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
    confession: [],
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
  const f = { lang: null, greek: false, barrierFree: false, massOnly: false, maxKm: null, witnessTags: [] }

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

describe('rankUpcoming — where you can make it (UX-1, UX-2)', () => {
  const typed = (type: string, days: string, time: string) => {
    const s = services([{ days, time }])
    return { ...s, regular: s.regular.map((r) => ({ ...r, type })) }
  }

  it('sinks a service you cannot reach by its start, and a non-Mass below Masses', () => {
    // Prague Wed 08:30: an 08:40 adoration 7.5 km away came first, the 09:00
    // Mass 1.2 km away second
    const wed = new Date('2026-10-14T06:30:00Z')
    const lhotka = church('lhotka', 50.0205, 14.4213) // ~7.4 km south
    const victory = church('victory', 50.0983, 14.4213) // ~1.2 km north
    const praise = church('praise', 50.0884, 14.4213) // ~0.1 km, chvály at 09:00
    const ranked = rankUpcoming(
      wed,
      origin,
      [lhotka, victory, praise],
      new Map([
        [lhotka.id, typed('adorace', '3', '08:40')],
        [victory.id, typed('mše sv.', '3', '09:00')],
        [praise.id, typed('chvály', '3', '09:00')],
      ]),
    )
    expect(ranked.map((r) => r.church.id)).toEqual(['victory', 'praise', 'lhotka'])
  })

  it('FOUNDER-CASE Telč, Sunday 07:00: the parish 09:00 Mass beats 07:30–08:00 Masses 18–28 km out', () => {
    const sun7 = new Date('2026-10-18T05:00:00Z')
    const telc = { lat: 49.184, lng: 15.453 }
    const jakub = church('jakub', 49.1845, 15.4535)
    const villages = Array.from({ length: 20 }, (_, i) => church(`v${i}`, 49.184 + 0.17 + i * 0.004, 15.453))
    const byId = new Map([
      [jakub.id, typed('', '7', '09:00')], // blank type = plain Mass in the registry
      ...villages.map((v, i) => [v.id, typed('', '7', i % 2 ? '07:30' : '08:00')] as const),
    ])
    const ranked = rankUpcoming(sun7, telc, [...villages, jakub], byId)
    expect(ranked[0].church.id).toBe('jakub')
  })

  it('a blank registry type is a Mass', () => {
    expect(isMass('')).toBe(true)
    expect(isMass('mše sv.')).toBe(true)
    expect(isMass('adorace')).toBe(false)
  })
})

describe('rankUpcoming — per-church pick and day grouping (review of UX-1/UX-2)', () => {
  const svcs = (list: { type: string; days: string; time: string }[]) => {
    const s = services(list)
    return { ...s, regular: s.regular.map((r, i) => ({ ...r, type: list[i].type })) }
  }
  const dlat = (km: number) => km / 111.2

  it('a church is represented by its best service, not its earliest (Prague, Sunday 08:25)', () => {
    const sun = new Date('2026-10-18T06:25:00Z') // Sunday 08:25 Prague
    const x = church('x', origin.lat + dlat(3), origin.lng) // 08:30 unreachable from 3 km, 10:00 fine
    const n = church('n', origin.lat + dlat(0.4), origin.lng) // adorace 08:35, Mass 09:00
    const far = Array.from({ length: 25 }, (_, i) => church(`y${i}`, origin.lat - dlat(4 + i * 0.16), origin.lng))
    const byId = new Map([
      [x.id, svcs([{ type: 'mše sv.', days: '7', time: '08:30' }, { type: 'mše sv.', days: '7', time: '10:00' }])],
      [n.id, svcs([{ type: 'adorace', days: '7', time: '08:35' }, { type: 'mše sv.', days: '7', time: '09:00' }])],
      ...far.map((c, i) => [c.id, svcs([{ type: 'mše sv.', days: '7', time: i % 2 ? '10:30' : '10:00' }])] as const),
    ])
    const ranked = rankUpcoming(sun, origin, [x, ...far, n], byId)
    expect(ranked.slice(0, 2).map((r) => [r.church.id, r.service.type, r.service.time])).toEqual([
      ['n', 'mše sv.', '09:00'],
      ['x', 'mše sv.', '10:00'],
    ])
  })

  it('rows stay grouped by Prague day — no repeated day headings (Saturday 17:55)', () => {
    const sat = new Date('2026-10-17T15:55:00Z')
    const telc = { lat: 49.184, lng: 15.453 }
    const at = (id: string, km: number) => church(id, telc.lat + dlat(km), telc.lng)
    const a = at('a', 5) // 18:00 tonight is out of reach; Sunday 09:00
    const b = at('b', 2) // 18:30 tonight
    const c = at('c', 1) // adorace 19:00 tonight only
    const v = Array.from({ length: 8 }, (_, i) => at(`v${i}`, 3 + i * 2))
    const byId = new Map([
      [a.id, svcs([{ type: '', days: '6', time: '18:00' }, { type: '', days: '7', time: '09:00' }])],
      [b.id, svcs([{ type: '', days: '6', time: '18:30' }])],
      [c.id, svcs([{ type: 'adorace', days: '6', time: '19:00' }])],
      ...v.map((x, i) => [x.id, svcs([{ type: '', days: '7', time: i % 2 ? '08:00' : '10:00' }])] as const),
    ])
    const ranked = rankUpcoming(sat, telc, [a, b, c, ...v], byId, { limit: 50 })
    const headings = ranked.map((r) => dayLabel(sat, r.start)).filter((d, i, all) => d !== all[i - 1])
    expect(headings).toEqual(['dnes', 'zítra'])
    expect(ranked.slice(0, 2).map((r) => r.church.id)).toEqual(['b', 'c'])
    expect(ranked.find((r) => r.church.id === 'a')!.service.time).toBe('09:00')
  })
})

// The church-page line under the title: the tapped service's day, every
// service that day, so "17:00 růženec · 17:30 mše sv." reads without scrolling.
describe('dayLine', () => {
  const c = church('c', 50.08, 14.4)
  const svc = (): ChurchServices => {
    const s = services([
      { days: '5', time: '07:00' },
      { days: '5', time: '17:30' },
      { days: '6', time: '08:00' },
    ])
    s.regular.push({ days: '5', time: '17:00', lang: 'česky', greek: false, type: 'růženec', note: '' })
    return s
  }
  it('lists the rest of the tapped day in time order (Fri 3 Jul, 17:00 now)', () => {
    const line = dayLine(now, c, svc(), new Date('2026-07-03T15:00:00Z'))
    expect(line.map((u) => `${u.start.toISOString().slice(11, 16)} ${u.service.type}`)).toEqual([
      '15:00 růženec',
      '15:30 mše sv.',
    ])
  })
  it('a tap on tomorrow shows tomorrow', () => {
    const line = dayLine(now, c, svc(), new Date('2026-07-04T06:00:00Z'))
    expect(line.map((u) => dayLabel(now, u.start))).toEqual(['zítra'])
  })
  it('no tap (deep link): the next day that still has something', () => {
    const late = new Date('2026-07-03T19:00:00Z') // Fri 21:00, nothing left today
    expect(dayLine(late, c, svc(), null).map((u) => u.start.toISOString())).toEqual(['2026-07-04T06:00:00.000Z'])
  })
})

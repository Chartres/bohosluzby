import { haversineKm } from './distance'

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(50.08, 14.42, 50.08, 14.42)).toBe(0)
  })

  it('Prague centre → Brno centre is ~185 km', () => {
    const d = haversineKm(50.0875, 14.4213, 49.1951, 16.6068)
    expect(d).toBeGreaterThan(180)
    expect(d).toBeLessThan(190)
  })

  it('one degree of latitude is ~111 km', () => {
    expect(haversineKm(49, 14, 50, 14)).toBeCloseTo(111.2, 0)
  })
})

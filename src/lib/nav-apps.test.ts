import { describe, expect, it } from 'vitest'
import { navApps } from './nav-apps'

describe('navApps', () => {
  const apps = navApps(50.0875, 14.4213)

  it('offers the three navigation apps in order', () => {
    expect(apps.map((a) => a.name)).toEqual(['Apple Maps', 'Google Maps', 'Mapy.cz'])
  })

  it('Apple Maps gets a directions universal link', () => {
    expect(apps[0].url).toBe('https://maps.apple.com/?daddr=50.0875,14.4213&dirflg=w')
  })

  it('Google Maps gets the dir api link', () => {
    expect(apps[1].url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=50.0875%2C14.4213',
    )
  })

  it('Mapy.cz gets the point link', () => {
    expect(apps[2].url).toBe('https://mapy.cz/zakladni?q=50.0875%2C14.4213')
  })
})

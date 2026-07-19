import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getCurrentPosition } from './geo'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const stubGeo = (impl: (ok: (p: unknown) => void, err: (e: unknown) => void) => void) =>
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition: vi.fn(impl) },
    configurable: true,
  })

it('resolves coordinates when the browser answers', async () => {
  stubGeo((ok) => ok({ coords: { latitude: 50.1, longitude: 14.4 } }))
  await expect(getCurrentPosition()).resolves.toEqual({ coords: { lat: 50.1, lng: 14.4 } })
})

it('reports denial with its reason', async () => {
  stubGeo((_ok, err) => err({ code: 1 }))
  await expect(getCurrentPosition()).resolves.toEqual({ coords: null, error: 'denied' })
})

it('OS location services off → unavailable (its own guidance)', async () => {
  stubGeo((_ok, err) => err({ code: 2 }))
  await expect(getCurrentPosition()).resolves.toEqual({ coords: null, error: 'unavailable' })
})

it('permission-prompt limbo: no callback ever → null at the hard deadline, no hang', async () => {
  stubGeo(() => {
    /* dismissed prompt / OS location off: the API never calls back */
  })
  const p = getCurrentPosition()
  await vi.advanceTimersByTimeAsync(10_000)
  await expect(p).resolves.toEqual({ coords: null, error: 'deadline' })
})

const stubPermissions = (state: string) =>
  Object.defineProperty(navigator, 'permissions', {
    value: { query: vi.fn(async () => ({ state })) },
    configurable: true,
  })

it('getPermissionState reads the Permissions API without prompting', async () => {
  const { getPermissionState } = await import('./geo')
  stubPermissions('denied')
  await expect(getPermissionState()).resolves.toBe('denied')
  stubPermissions('granted')
  await expect(getPermissionState()).resolves.toBe('granted')
  stubPermissions('prompt')
  await expect(getPermissionState()).resolves.toBe('prompt')
})

it('getPermissionState degrades to unknown without the API', async () => {
  const { getPermissionState } = await import('./geo')
  Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true })
  await expect(getPermissionState()).resolves.toBe('unknown')
})

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { track } from '../analytics'
import { getCurrentPosition } from './geo'

vi.mock('../analytics', () => ({ logError: vi.fn(), track: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(track).mockClear()
})
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

// The late window. iOS delivers a coarse fix in ~10–12 s; the UI deadline
// (10 s) used to win the race and the real fix was thrown away — 12 of 14
// native visitors in Aug–Oct 2026 logged geo_deadline (docs/EVOLVE.md).
it('a fix that lands after the deadline still arrives — via onLate, not thrown away', async () => {
  stubGeo((ok) => {
    setTimeout(() => ok({ coords: { latitude: 50.1, longitude: 14.4 } }), 11_000)
  })
  const onLate = vi.fn()
  const p = getCurrentPosition({ deadlineMs: 10_000, onLate })
  await vi.advanceTimersByTimeAsync(10_000)
  await expect(p).resolves.toEqual({ coords: null, error: 'deadline' })
  expect(onLate).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1_000)
  expect(onLate).toHaveBeenCalledTimes(1)
  expect(onLate).toHaveBeenCalledWith({ coords: { lat: 50.1, lng: 14.4 } })
  // measured, so the next evolve run can see how many deadlines recover
  expect(track).toHaveBeenCalledWith('key_action', expect.objectContaining({ action: 'geo_late', ms: 11_000 }))
})

it('a fix in time never calls onLate', async () => {
  stubGeo((ok) => ok({ coords: { latitude: 50.1, longitude: 14.4 } }))
  const onLate = vi.fn()
  await expect(getCurrentPosition({ onLate })).resolves.toEqual({ coords: { lat: 50.1, lng: 14.4 } })
  await vi.advanceTimersByTimeAsync(120_000)
  expect(onLate).not.toHaveBeenCalled()
})

it('the late window closes: a read that never answers ends with one final deadline', async () => {
  stubGeo(() => {
    /* dismissed prompt: no callback, ever */
  })
  const onLate = vi.fn()
  const p = getCurrentPosition({ deadlineMs: 10_000, lateWindowMs: 60_000, onLate })
  await vi.advanceTimersByTimeAsync(10_000)
  await p
  await vi.advanceTimersByTimeAsync(49_000)
  expect(onLate).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1_000)
  expect(onLate).toHaveBeenCalledTimes(1)
  expect(onLate).toHaveBeenCalledWith({ coords: null, error: 'deadline' })
  await vi.advanceTimersByTimeAsync(120_000)
  expect(onLate).toHaveBeenCalledTimes(1)
})

it('a late failure is passed on (the caller stops "locating…"), not logged twice', async () => {
  stubGeo((_ok, err) => {
    setTimeout(() => err({ code: 3 }), 15_000)
  })
  const onLate = vi.fn()
  const p = getCurrentPosition({ deadlineMs: 10_000, onLate })
  await vi.advanceTimersByTimeAsync(15_000)
  await p
  expect(onLate).toHaveBeenCalledWith({ coords: null, error: 'timeout' })
  expect(track).not.toHaveBeenCalled()
})

it('the read itself waits longer than the UI deadline, so a slow fix has room to land', async () => {
  const getCurrent = vi.fn()
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: getCurrent }, configurable: true })
  void getCurrentPosition({ deadlineMs: 10_000 })
  await vi.advanceTimersByTimeAsync(0)
  const opts = getCurrent.mock.calls[0][2] as PositionOptions
  expect(opts.timeout).toBeGreaterThanOrEqual(25_000)
})

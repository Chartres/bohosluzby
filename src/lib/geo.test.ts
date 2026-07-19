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
  await expect(getCurrentPosition()).resolves.toEqual({ lat: 50.1, lng: 14.4 })
})

it('resolves null on denial', async () => {
  stubGeo((_ok, err) => err({ code: 1 }))
  await expect(getCurrentPosition()).resolves.toBeNull()
})

it('permission-prompt limbo: no callback ever → null at the hard deadline, no hang', async () => {
  stubGeo(() => {
    /* dismissed prompt / OS location off: the API never calls back */
  })
  const p = getCurrentPosition()
  await vi.advanceTimersByTimeAsync(10_000)
  await expect(p).resolves.toBeNull()
})

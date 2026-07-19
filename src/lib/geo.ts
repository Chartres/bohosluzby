import { isNative } from './native'

export type Coords = { lat: number; lng: number }

/**
 * One geolocation read. Inside the native shell, WKWebView's
 * `navigator.geolocation` is unreliable, so we go through
 * `@capacitor/geolocation` (which prompts via CoreLocation); on the web we use
 * the browser API. Resolves `null` on any denial/failure — the caller falls
 * back to the last known position.
 */
export async function getCurrentPosition(
  opts: { timeout?: number; maximumAge?: number } = {},
): Promise<Coords | null> {
  // Hard deadline around the WHOLE read: the browser API's own `timeout` only
  // starts counting once the permission prompt is answered — a dismissed
  // prompt (or Android with OS location off) never calls back at all, and the
  // app would hang on "zjišťuji polohu" forever. Null → caller's fallback
  // (last known position → city picker).
  const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000))
  return Promise.race([deadline, read(opts)])
}

async function read(
  opts: { timeout?: number; maximumAge?: number } = {},
): Promise<Coords | null> {
  const { timeout = 12_000, maximumAge = 300_000 } = opts

  if (isNative) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      let perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') {
        perm = await Geolocation.requestPermissions({ permissions: ['location'] })
      }
      if (perm.location !== 'granted') return null
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout,
        maximumAge,
      })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {
      return null
    }
  }

  if (!('geolocation' in navigator) || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout, maximumAge },
    )
  })
}

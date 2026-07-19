import { isNative } from './native'
import { logError } from '../analytics'

export type Coords = { lat: number; lng: number }
export type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unknown'
/** Why a read failed — each gets its own user guidance:
 * denied (site permission) · unavailable (OS location services off) ·
 * timeout/deadline (no fix / unanswered prompt) · unsupported (no API). */
export type GeoFailure = 'denied' | 'unavailable' | 'timeout' | 'deadline' | 'unsupported'
export type GeoResult = { coords: Coords | null; error?: GeoFailure }

/** Current permission state WITHOUT prompting — lets the UI say "enable
 * location" instead of waiting on a callback that will never come. */
export async function getPermissionState(): Promise<GeoPermission> {
  if (isNative) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      const p = await Geolocation.checkPermissions()
      return p.location === 'granted' ? 'granted' : p.location === 'denied' ? 'denied' : 'prompt'
    } catch {
      return 'unknown'
    }
  }
  try {
    const s = await navigator.permissions.query({ name: 'geolocation' })
    return s.state === 'granted' || s.state === 'denied' ? s.state : 'prompt'
  } catch {
    return 'unknown' // Permissions API unavailable — behave as before
  }
}

/**
 * One geolocation read. Inside the native shell, WKWebView's
 * `navigator.geolocation` is unreliable, so we go through
 * `@capacitor/geolocation` (which prompts via CoreLocation); on the web we use
 * the browser API. A failure carries its reason (and is reported to analytics —
 * "Ask but no prompt" class bugs are invisible without it); the caller picks
 * the matching guidance.
 *
 * Hard deadline around the WHOLE read: the browser API's own `timeout` only
 * starts counting once the permission prompt is answered — a dismissed prompt
 * never calls back at all. `deadlineMs` is caller-tunable: a pending prompt
 * deserves a longer wait than a granted-but-slow fix.
 */
export async function getCurrentPosition(
  opts: { timeout?: number; maximumAge?: number; deadlineMs?: number } = {},
): Promise<GeoResult> {
  const deadline = new Promise<GeoResult>((resolve) =>
    setTimeout(() => resolve({ coords: null, error: 'deadline' }), opts.deadlineMs ?? 10_000),
  )
  const result = await Promise.race([deadline, read(opts)])
  if (result.error) {
    // fire-and-forget telemetry: which failure class do real devices hit?
    try {
      logError(`geo_${result.error}`, { where: 'geolocation', native: isNative })
    } catch {
      /* analytics unavailable — never break the flow */
    }
  }
  return result
}

async function read(
  opts: { timeout?: number; maximumAge?: number } = {},
): Promise<GeoResult> {
  const { timeout = 12_000, maximumAge = 300_000 } = opts

  if (isNative) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      let perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') {
        perm = await Geolocation.requestPermissions({ permissions: ['location'] })
      }
      if (perm.location !== 'granted') return { coords: null, error: 'denied' }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout,
        maximumAge,
      })
      return { coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } }
    } catch (e) {
      // CoreLocation throws "location disabled" when OS services are off
      const msg = String((e as Error)?.message ?? e).toLowerCase()
      return { coords: null, error: msg.includes('disabled') ? 'unavailable' : 'timeout' }
    }
  }

  if (!('geolocation' in navigator) || !navigator.geolocation) {
    return { coords: null, error: 'unsupported' }
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      (err) =>
        resolve({
          coords: null,
          // 1 PERMISSION_DENIED · 2 POSITION_UNAVAILABLE (OS location off) · 3 TIMEOUT
          error: err?.code === 1 ? 'denied' : err?.code === 2 ? 'unavailable' : 'timeout',
        }),
      { timeout, maximumAge },
    )
  })
}

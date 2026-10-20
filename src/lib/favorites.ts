// Moje kostely — starred churches, kept on this device only (no account, no
// sync, nothing sent anywhere). Newest first; a small cap keeps the home
// section a glance, not a second list.
import { readList, writeJson } from './storage'

const KEY = 'bohosluzby:favorites'
export const FAVORITES_MAX = 12

const listeners = new Set<() => void>()

export function getFavorites(): string[] {
  return readList<unknown>(KEY).filter((x): x is string => typeof x === 'string')
}

/** Adds or removes `id`; returns whether it is now a favourite. */
export function toggleFavorite(id: string): boolean {
  const cur = getFavorites()
  const on = !cur.includes(id)
  const next = on ? [id, ...cur].slice(0, FAVORITES_MAX) : cur.filter((x) => x !== id)
  writeJson(KEY, next) // private mode: the star still flips for this session's listeners
  for (const l of listeners) l()
  return on
}

export function subscribeFavorites(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// useSyncExternalStore needs a stable snapshot between changes. Keyed on the
// stored string, so a write from another tab (or anything else) is never hidden
// behind a stale cache.
let snapshot: string[] = []
let snapshotRaw: string | null | undefined
export function favoritesSnapshot(): string[] {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    // private mode
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw
    snapshot = getFavorites()
  }
  return snapshot
}

// another tab starred something → refresh this one
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) for (const l of listeners) l()
  })

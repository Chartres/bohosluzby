// Over-the-air registry refresh. The web app always fetches fresh data from the
// server; the native shell ships a bundled snapshot (offline + first launch) and,
// when online, silently pulls a newer registry from the site and caches it in the
// Filesystem. Reads resolve cache → bundled, so the app is always usable offline.
//
// A version change downloads the WHOLE snapshot (churches.json + all shards + the
// photo and confession side files, ~1.5MB)
// once, gated on version.json, so between monthly refreshes only a tiny version
// check crosses the wire. version.json is written LAST, so its presence marks a
// complete snapshot — a partial/failed refresh falls back to bundled for everything.
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { isNative } from './native'
import { removeKey } from './storage'
import type { RawEntry } from '../domain/churchPage'

const REMOTE = 'https://bohosluzby.dravec.org'
const CACHE = 'registry' // Filesystem subdir under Directory.Data
const ASOF_KEY = 'data_asof'
const EXTRAS = ['photos.json', 'confession.json']

export interface DataVersion {
  /** ISO date the registry was scraped, e.g. "2026-07-03". Also the "as of" label. */
  generated: string
  /** ISO datetime of the publish, so a same-day re-publish still reaches native
   * clients. Older snapshots lack it; comparisons fall back to `generated`. */
  timestamp?: string
  /** church count — powers the shrunken-payload sanity gate. */
  churches: number
}

export interface RefreshResult {
  asOf: string | null
  updated: boolean
}

let cacheReady: boolean | null = null
/** Held while an OTA refresh writes the cache; loadData waits on it so no read
 * mixes a bundled index with half-written shards. */
let refreshLock: Promise<void> | null = null

/** The freshness key: timestamp when present (lexicographic order works for both
 * an ISO date and an ISO datetime), else the date. */
const versionKey = (v: Partial<DataVersion> | null | undefined): string => v?.timestamp ?? v?.generated ?? ''

async function readCache(path: string): Promise<string | null> {
  if (!isNative) return null
  try {
    const { data } = await Filesystem.readFile({
      path: `${CACHE}/${path}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    })
    return typeof data === 'string' ? data : await (data as Blob).text()
  } catch {
    return null
  }
}

async function writeCache(path: string, text: string): Promise<void> {
  await Filesystem.writeFile({
    path: `${CACHE}/${path}`,
    directory: Directory.Data,
    data: text,
    encoding: Encoding.UTF8,
    recursive: true,
  })
}

/** The version.json served with the app (bundled on native), or null. */
const fetchBundledVersion = (): Promise<DataVersion | null> =>
  fetch('/data/version.json')
    .then((r) => (r.ok ? (r.json() as Promise<DataVersion>) : null))
    .catch(() => null)

async function ready(): Promise<boolean> {
  if (!isNative) return false
  if (cacheReady !== null) return cacheReady
  const cached = await readCache('version.json')
  if (!cached) { cacheReady = false; return false }
  // a corrupt marker can't vouch for the snapshot — treat it as absent
  let cachedKey = ''
  try {
    cachedKey = versionKey(JSON.parse(cached) as Partial<DataVersion>)
  } catch {
    /* corrupt */
  }
  if (!cachedKey) { cacheReady = false; return false }
  // After an app update the bundled registry may be newer than the cache: discard
  // the stale cache so loadData falls through to the fresh bundled version, and
  // drop the stored as-of so the footer shows the bundled date and refreshData
  // compares the remote against it, not against the stale cache's.
  const bundledKey = versionKey(await fetchBundledVersion())
  if (bundledKey && cachedKey < bundledKey) {
    removeKey(ASOF_KEY)
    cacheReady = false
    return false
  }
  cacheReady = true
  return true
}

/** Load a /data/<path> JSON from the freshest available source: cache → bundled. */
export async function loadData<T>(path: string): Promise<T> {
  if (refreshLock) await refreshLock
  if (await ready()) {
    const cached = await readCache(path)
    if (cached) return JSON.parse(cached) as T
  }
  const res = await fetch(`/data/${path}`)
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return (await res.json()) as T
}

/** One services/<cell>.json shard, undecoded (callers run decodeShard). */
export const loadShard = (cell: string) => loadData<Record<string, RawEntry>>(`services/${cell}.json`)

export function activeAsOf(): string | null {
  try {
    return localStorage.getItem(ASOF_KEY)
  } catch {
    return null
  }
}

function setAsOf(v: string): void {
  try {
    localStorage.setItem(ASOF_KEY, v)
  } catch {
    /* private mode — ignore */
  }
}

async function fetchText(url: string, ms = 8000): Promise<string> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`${url} ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

/**
 * Silently bring the registry up to date. Never throws.
 * - Web: no-op beyond reading the served version for the "as of" date (server is fresh).
 * - Native: if the remote version is newer and passes the sanity gate, download +
 *   cache the whole snapshot atomically. Any failure keeps the existing data.
 */
export async function refreshData(onDownloading?: () => void): Promise<RefreshResult> {
  await ready() // drops a cache (and its as-of) older than the bundle before we compare
  let asOf = activeAsOf()
  let bundledV: DataVersion | null = null
  if (!asOf) {
    bundledV = await loadData<DataVersion>('version.json').catch(() => null)
    asOf = versionKey(bundledV) || null
    if (asOf) setAsOf(asOf)
  }

  if (!isNative) {
    // Reuse the already-fetched bundledV if available to avoid a second fetch on
    // first visit (web serves fresh data so the bundled file IS the version).
    const v = bundledV ?? (await fetchBundledVersion())
    return { asOf: v?.generated ?? asOf, updated: false }
  }

  const remote = await fetchText(`${REMOTE}/data/version.json`)
    .then((t) => JSON.parse(t) as DataVersion)
    .catch(() => null)
  if (!remote?.generated || (asOf && versionKey(remote) <= asOf)) return { asOf, updated: false }

  try {
    onDownloading?.() // a real payload download is starting — light the indicator
    const churchesText = await fetchText(`${REMOTE}/data/churches.json`)
    const churches = JSON.parse(churchesText) as [string, ...unknown[]][]
    const current = await loadData<unknown[]>('churches.json')
      .then((r) => r.length)
      .catch(() => 0)
    // reject a shrunken payload — the same 90% floor the scraper's sanity gate uses
    if (current && churches.length < 0.9 * current) return { asOf, updated: false }

    const cells = [...new Set(churches.map((r) => r[6] as string))]
    if (cells.some((c) => !c)) return { asOf, updated: false } // guard r[6] undefined
    const shards = await Promise.all(
      cells.map(async (c) => [c, await fetchText(`${REMOTE}/data/services/${c}.json`)] as const),
    )
    // side files the detail page reads; optional — a miss falls back to bundled
    const extras = await Promise.all(
      EXTRAS.map(async (f) => [f, await fetchText(`${REMOTE}/data/${f}`).catch(() => null)] as const),
    )
    let unlock!: () => void
    refreshLock = new Promise<void>((r) => (unlock = r))
    try {
      // Delete the marker BEFORE any shard write: if the app dies mid-write, the
      // next launch finds no marker and reads bundled, not a mixed old/new cache.
      try {
        await Filesystem.deleteFile({ path: `${CACHE}/version.json`, directory: Directory.Data })
      } catch {
        /* absent on first refresh */
      }
      cacheReady = null // re-checked from disk if the writes below fail
      for (const [c, text] of shards) await writeCache(`services/${c}.json`, text)
      for (const [f, text] of extras) {
        if (text !== null) await writeCache(f, text)
        else await Filesystem.deleteFile({ path: `${CACHE}/${f}`, directory: Directory.Data }).catch(() => {})
      }
      await writeCache('churches.json', churchesText)
      await writeCache('version.json', JSON.stringify(remote)) // marker, written last
      cacheReady = true
      setAsOf(versionKey(remote))
    } finally {
      refreshLock = null
      unlock()
    }
    return { asOf: remote.generated, updated: true }
  } catch {
    return { asOf, updated: false } // keep the old snapshot on any failure
  }
}

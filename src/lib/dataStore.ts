// Over-the-air registry refresh. The web app always fetches fresh data from the
// server; the native shell ships a bundled snapshot (offline + first launch) and,
// when online, silently pulls a newer registry from the site and caches it in the
// Filesystem. Reads resolve cache → bundled, so the app is always usable offline.
//
// A version change downloads the WHOLE snapshot (churches.json + all shards, ~1.5MB)
// once, gated on version.json, so between monthly refreshes only a tiny version
// check crosses the wire. version.json is written LAST, so its presence marks a
// complete snapshot — a partial/failed refresh falls back to bundled for everything.
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { isNative } from './native'

const REMOTE = 'https://bohosluzby.dravec.org'
const CACHE = 'registry' // Filesystem subdir under Directory.Data
const ASOF_KEY = 'data_asof'

export interface DataVersion {
  /** ISO date the registry was scraped, e.g. "2026-07-03". Also the "as of" label. */
  generated: string
  /** church count — powers the shrunken-payload sanity gate. */
  churches: number
}

export interface RefreshResult {
  asOf: string | null
  updated: boolean
}

let cacheReady: boolean | null = null

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

async function ready(): Promise<boolean> {
  if (!isNative) return false
  if (cacheReady === null) cacheReady = (await readCache('version.json')) !== null
  return cacheReady
}

/** Load a /data/<path> JSON from the freshest available source: cache → bundled. */
export async function loadData<T>(path: string): Promise<T> {
  if (await ready()) {
    const cached = await readCache(path)
    if (cached) return JSON.parse(cached) as T
  }
  const res = await fetch(`/data/${path}`)
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return (await res.json()) as T
}

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
  let asOf = activeAsOf()
  if (!asOf) {
    const bundled = await loadData<DataVersion>('version.json').catch(() => null)
    asOf = bundled?.generated ?? null
    if (asOf) setAsOf(asOf)
  }

  if (!isNative) {
    const v = await fetch('/data/version.json')
      .then((r) => (r.ok ? (r.json() as Promise<DataVersion>) : null))
      .catch(() => null)
    return { asOf: v?.generated ?? asOf, updated: false }
  }

  const remote = await fetchText(`${REMOTE}/data/version.json`)
    .then((t) => JSON.parse(t) as DataVersion)
    .catch(() => null)
  if (!remote?.generated || (asOf && remote.generated <= asOf)) return { asOf, updated: false }

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
    const shards = await Promise.all(
      cells.map(async (c) => [c, await fetchText(`${REMOTE}/data/services/${c}.json`)] as const),
    )
    for (const [c, text] of shards) await writeCache(`services/${c}.json`, text)
    await writeCache('churches.json', churchesText)
    await writeCache('version.json', JSON.stringify(remote)) // marker, written last
    cacheReady = true
    setAsOf(remote.generated)
    return { asOf: remote.generated, updated: true }
  } catch {
    return { asOf, updated: false } // keep the old snapshot on any failure
  }
}

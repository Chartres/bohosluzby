import { beforeEach, expect, it, vi } from 'vitest'

// In-memory Filesystem so the native cache path is exercised without a device.
function fsMock() {
  const store = new Map<string, string>()
  return {
    store,
    writes: [] as string[],
    module: {
      Directory: { Data: 'DATA' },
      Encoding: { UTF8: 'utf8' },
      Filesystem: {
        readFile: vi.fn(async ({ path }: { path: string }) => {
          if (!store.has(path)) throw new Error('ENOENT')
          return { data: store.get(path)! }
        }),
        writeFile: vi.fn(async ({ path, data }: { path: string; data: string }) => {
          store.set(path, data)
        }),
      },
    },
  }
}

// Route fetch by full URL; `offline` throws for the remote host (network down).
function stubFetch(routes: Record<string, string>, offline = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (offline && u.startsWith('https://')) throw new Error('offline')
      if (u in routes) return new Response(routes[u], { status: 200 })
      return new Response('nf', { status: 404 })
    }),
  )
}

async function loadModule(native: boolean, fs: ReturnType<typeof fsMock>) {
  vi.resetModules()
  vi.doMock('./native', () => ({ isNative: native, platform: native ? 'ios' : 'web' }))
  vi.doMock('@capacitor/filesystem', () => fs.module)
  return import('./dataStore')
}

const version = (generated: string, churches = 100) => JSON.stringify({ generated, churches })
const index = (n: number) =>
  JSON.stringify(Array.from({ length: n }, (_, i) => [String(i), 'k', 'Praha', 50, 14, 0, '50-14']))
const SHARD = JSON.stringify({ '0': { u: '2026-06-01', p: '', pa: '', c: [], s: [] } })

const R = 'https://bohosluzby.dravec.org'

beforeEach(() => {
  localStorage.clear()
})

it('web: reads from the server and reports the served date, never downloads', async () => {
  const fs = fsMock()
  stubFetch({ '/data/version.json': version('2026-07-03'), '/data/churches.json': index(100) })
  const ds = await loadModule(false, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-07-03', updated: false })
  expect((await ds.loadData<unknown[]>('churches.json')).length).toBe(100)
  expect(fs.module.Filesystem.writeFile).not.toHaveBeenCalled()
})

it('native: downloads and caches a newer snapshot, then reads from cache', async () => {
  const fs = fsMock()
  stubFetch({
    '/data/version.json': version('2026-07-03'),
    '/data/churches.json': index(100),
    [`${R}/data/version.json`]: version('2026-08-01'),
    [`${R}/data/churches.json`]: index(100),
    [`${R}/data/services/50-14.json`]: SHARD,
  })
  const ds = await loadModule(true, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-08-01', updated: true })
  expect(ds.activeAsOf()).toBe('2026-08-01')
  expect(fs.store.get('registry/version.json')).toContain('2026-08-01')
  expect(fs.store.get('registry/churches.json')).toBeTruthy()
  // now reads come from the cache, not the bundled /data
  stubFetch({}) // bundled fetch would 404 → proves cache is used
  expect((await ds.loadData<unknown[]>('churches.json')).length).toBe(100)
})

it('native: skips when the remote version is not newer', async () => {
  const fs = fsMock()
  stubFetch({
    '/data/version.json': version('2026-08-01'),
    [`${R}/data/version.json`]: version('2026-08-01'),
  })
  const ds = await loadModule(true, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-08-01', updated: false })
  expect(fs.module.Filesystem.writeFile).not.toHaveBeenCalled()
})

it('native: offline keeps the current data and never throws', async () => {
  const fs = fsMock()
  stubFetch({ '/data/version.json': version('2026-07-03') }, /* offline */ true)
  const ds = await loadModule(true, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-07-03', updated: false })
  expect(fs.module.Filesystem.writeFile).not.toHaveBeenCalled()
})

it('native: rejects a shrunken payload (sanity gate)', async () => {
  const fs = fsMock()
  stubFetch({
    '/data/version.json': version('2026-07-03', 100),
    '/data/churches.json': index(100),
    [`${R}/data/version.json`]: version('2026-08-01', 40),
    [`${R}/data/churches.json`]: index(40), // <90% of 100 → reject
  })
  const ds = await loadModule(true, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-07-03', updated: false })
  expect(ds.activeAsOf()).toBe('2026-07-03')
  expect(fs.store.has('registry/version.json')).toBe(false)
})

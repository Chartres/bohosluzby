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
        deleteFile: vi.fn(async ({ path }: { path: string }) => {
          store.delete(path)
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
// the side files every published snapshot carries (the refresh requires them)
const SIDE = { [`${R}/data/photos.json`]: '{}', [`${R}/data/confession.json`]: '{}' }

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
    ...SIDE,
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

// a native install that already holds an OTA snapshot from `generated`
function seedCache(fs: ReturnType<typeof fsMock>, generated: string, n = 100) {
  fs.store.set('registry/version.json', version(generated))
  fs.store.set('registry/churches.json', index(n))
  fs.store.set('registry/services/50-14.json', SHARD)
}

it('native: a corrupt cached version.json counts as no cache — reads fall back to bundled', async () => {
  const fs = fsMock()
  seedCache(fs, '2026-08-01', 7)
  fs.store.set('registry/version.json', '{not json')
  stubFetch({ '/data/version.json': version('2026-07-03'), '/data/churches.json': index(100) })
  const ds = await loadModule(true, fs)

  expect((await ds.loadData<unknown[]>('churches.json')).length).toBe(100)
})

it('native: a same-day re-publish (newer timestamp, same date) is downloaded', async () => {
  const fs = fsMock()
  localStorage.setItem('data_asof', '2026-08-01T04:00:00.000Z')
  const republished = JSON.stringify({ generated: '2026-08-01', timestamp: '2026-08-01T15:00:00.000Z', churches: 100 })
  stubFetch({
    '/data/churches.json': index(100),
    [`${R}/data/version.json`]: republished,
    [`${R}/data/churches.json`]: index(100),
    [`${R}/data/services/50-14.json`]: SHARD,
    ...SIDE,
  })
  const ds = await loadModule(true, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-08-01', updated: true })
  expect(ds.activeAsOf()).toBe('2026-08-01T15:00:00.000Z')
})

it('native: a refresh that dies mid-write leaves no marker, so the next launch reads bundled', async () => {
  const fs = fsMock()
  seedCache(fs, '2026-07-01', 100)
  localStorage.setItem('data_asof', '2026-07-01')
  stubFetch({
    '/data/version.json': version('2026-07-01'),
    '/data/churches.json': index(95),
    [`${R}/data/version.json`]: version('2026-08-01'),
    [`${R}/data/churches.json`]: index(100),
    [`${R}/data/services/50-14.json`]: SHARD,
    ...SIDE,
  })
  fs.module.Filesystem.writeFile.mockImplementationOnce(async () => {
    throw new Error('disk full') // the first shard write
  })
  const ds = await loadModule(true, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-07-01', updated: false })
  expect(fs.store.has('registry/version.json')).toBe(false)
  const relaunched = await loadModule(true, fs)
  expect((await relaunched.loadData<unknown[]>('churches.json')).length).toBe(95) // bundled
})

it('native: a newer bundled snapshot (app update) wins over the cache and resets the as-of date', async () => {
  const fs = fsMock()
  seedCache(fs, '2026-07-01', 7)
  localStorage.setItem('data_asof', '2026-07-01')
  stubFetch({ '/data/version.json': version('2026-09-01'), '/data/churches.json': index(100) })
  const ds = await loadModule(true, fs)

  expect((await ds.loadData<unknown[]>('churches.json')).length).toBe(100)
  expect(ds.activeAsOf()).toBeNull()
})

it('native: a read during the OTA write phase waits for the new snapshot', async () => {
  const fs = fsMock()
  stubFetch({
    '/data/version.json': version('2026-07-03'),
    '/data/churches.json': index(100),
    [`${R}/data/version.json`]: version('2026-08-01'),
    [`${R}/data/churches.json`]: index(120),
    [`${R}/data/services/50-14.json`]: SHARD,
    ...SIDE,
  })
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const realWrite = fs.module.Filesystem.writeFile.getMockImplementation()!
  fs.module.Filesystem.writeFile.mockImplementationOnce(async (arg) => {
    await gate // hold the first shard write open
    return realWrite(arg)
  })
  const ds = await loadModule(true, fs)

  const refreshing = ds.refreshData()
  await vi.waitFor(() => expect(fs.module.Filesystem.writeFile).toHaveBeenCalled())
  const read = ds.loadData<unknown[]>('churches.json') // issued mid-write
  release()
  await refreshing
  expect((await read).length).toBe(120) // the new snapshot, not bundled
})

it('native: after an app update, a remote equal to the newer bundle is not re-downloaded (sweep F8)', async () => {
  const fs = fsMock()
  seedCache(fs, '2026-07-01', 7)
  localStorage.setItem('data_asof', '2026-07-01')
  stubFetch({
    '/data/version.json': version('2026-09-01'),
    '/data/churches.json': index(100),
    [`${R}/data/version.json`]: version('2026-09-01'),
    [`${R}/data/churches.json`]: index(100),
    [`${R}/data/services/50-14.json`]: SHARD,
  })
  const ds = await loadModule(true, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-09-01', updated: false })
  expect(fs.module.Filesystem.writeFile).not.toHaveBeenCalled()
})

it('native: the OTA refresh also brings photos.json and confession.json (sweep F9)', async () => {
  const fs = fsMock()
  stubFetch({
    '/data/version.json': version('2026-07-03'),
    '/data/churches.json': index(100),
    [`${R}/data/version.json`]: version('2026-08-01'),
    [`${R}/data/churches.json`]: index(100),
    [`${R}/data/services/50-14.json`]: SHARD,
    [`${R}/data/photos.json`]: '{"0":{"new":true}}',
    [`${R}/data/confession.json`]: '{"x":1}',
  })
  const ds = await loadModule(true, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-08-01', updated: true })
  stubFetch({}) // bundled would 404 → proves the cache is used
  expect(await ds.loadData('photos.json')).toEqual({ '0': { new: true } })
  expect(await ds.loadData('confession.json')).toEqual({ x: 1 })
})

it('native: a failed side-file fetch aborts the refresh so the next launch retries (sweep K3)', async () => {
  const fs = fsMock()
  const routes = {
    '/data/version.json': version('2026-07-03'),
    '/data/churches.json': index(100),
    [`${R}/data/version.json`]: version('2026-08-01'),
    [`${R}/data/churches.json`]: index(100),
    [`${R}/data/services/50-14.json`]: SHARD,
    [`${R}/data/confession.json`]: '{"x":1}',
  } // photos.json 404s
  stubFetch(routes)
  const ds = await loadModule(true, fs)

  expect(await ds.refreshData()).toEqual({ asOf: '2026-07-03', updated: false })
  stubFetch({ ...routes, [`${R}/data/photos.json`]: '{"0":{"new":true}}' })
  expect(await ds.refreshData()).toEqual({ asOf: '2026-08-01', updated: true })
  expect(await ds.loadData('photos.json')).toEqual({ '0': { new: true } })
})

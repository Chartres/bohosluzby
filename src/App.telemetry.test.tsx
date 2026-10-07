// What the app tells flywheel-core about a visit — no identifiers beyond the
// anonymous visitor id the client already had: where it landed, where from,
// and how long until a list of times stood on screen (an aha that needs no click).
import { vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: null }))
vi.mock('./analytics', () => ({ track: vi.fn(), conversion: vi.fn(), feedback: vi.fn(), logError: vi.fn() }))
import { render, screen } from '@testing-library/react'
import App from './App'
import { track } from './analytics'
import type { IndexRow } from './domain/data'

const INDEX: IndexRow[] = [['1', 'kostel Nejsvětějšího Salvátora', 'Praha 1', 50.086, 14.417, 1, '50-14']]
const SHARD = { '1': { u: '2026-06-01', p: '', pa: '', c: [], s: [['1234567', '18:00', 'česky', 0, 'mše sv.', '']] } }

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bohosluzby:introSeen', '1')
  vi.useFakeTimers({ now: new Date('2026-07-03T10:00:00Z'), shouldAdvanceTime: true })
  window.history.replaceState(null, '', '/?zobrazeni=seznam&utm_source=farnost')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      const body = u.endsWith('/data/churches.json')
        ? INDEX
        : u.endsWith('/data/version.json')
          ? { generated: '2026-07-03', churches: 1 }
          : u.endsWith('/data/services/50-14.json')
            ? SHARD
            : null
      return body ? new Response(JSON.stringify(body)) : new Response('nf', { status: 404 })
    }),
  )
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 50.0875, longitude: 14.4213 } }) },
    configurable: true,
  })
  vi.mocked(track).mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('page_view carries route, utm and platform', async () => {
  render(<App />)
  await screen.findByText(/Salvátora/)
  expect(track).toHaveBeenCalledWith(
    'page_view',
    expect.objectContaining({ route: 'home', utm_source: 'farnost', platform: 'web', lang: expect.any(String) }),
  )
})

it('list_ready fires once per visit, with how the origin was found and how fast', async () => {
  render(<App />)
  await screen.findByText(/Salvátora/)
  const listReady = () =>
    vi.mocked(track).mock.calls.filter(([e, p]) => e === 'key_action' && p?.action === 'list_ready')
  await vi.waitFor(() => expect(listReady()).toHaveLength(1)) // a passive effect: flushes after paint
  const calls = listReady()
  expect(calls[0][1]).toMatchObject({ source: 'geo', rows: 1 })
  expect(typeof calls[0][1]?.ms).toBe('number')
})

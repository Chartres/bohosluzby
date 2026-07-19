// English UI smoke test — device language is anything but cs/sk (here
// en-US), so lang() resolves to 'en' and the chrome renders translated.
// Setup mirrors App.test.tsx (same mock pattern); registry DATA stays Czech.
import { render, screen } from '@testing-library/react'
import App from './App'
import type { IndexRow } from './domain/data'

// Friday 3 Jul 2026 17:00 Prague. Vitest fake timers pin "now".
const NOW = new Date('2026-07-03T15:00:00Z')

const INDEX: IndexRow[] = [
  ['1', 'kostel Nejsvětějšího Salvátora', 'Praha 1', 50.086, 14.417, 1, '50-14', 'https://www.farnostsalvator.cz'],
]
const SHARD_50_14 = {
  '1': {
    u: '2026-06-01',
    p: 'Akademická farnost Praha',
    pa: 'Křižovnické nám. 4, Praha 1',
    c: [['www', 'https://www.farnostsalvator.cz']],
    s: [['5', '18:00', 'česky', 0, 'mše sv.', '']], // Friday 18:00 — an hour from NOW
  },
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url)
      const body = path.endsWith('/data/churches.json')
        ? INDEX
        : path.endsWith('/data/version.json')
          ? { generated: '2026-07-03', churches: INDEX.length }
          : path.endsWith('/data/services/50-14.json')
            ? SHARD_50_14
            : null
      if (!body) return new Response('not found', { status: 404 })
      return new Response(JSON.stringify(body), { status: 200 })
    }),
  )
}

function stubGeolocation() {
  const getCurrentPosition = vi.fn(
    (ok: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
      ok({ coords: { latitude: 50.0875, longitude: 14.4213 } })
    },
  )
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: NOW, shouldAdvanceTime: true })
  stubFetch()
  Object.defineProperty(window.navigator, 'language', { value: 'en-US', configurable: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // restore the suite-wide default so every other test file keeps asserting Czech
  Object.defineProperty(window.navigator, 'language', { value: 'cs-CZ', configurable: true })
})

describe('English UI (device language en-US)', () => {
  it('renders translated day pill, day rubric, and countdown', async () => {
    stubGeolocation()
    render(<App />)
    await screen.findByText('kostel Nejsvětějšího Salvátora')

    // the day pill: group "day" + value "now", same `${group}: ${label}` pattern
    expect(screen.getByRole('button', { name: /^day: now/ })).toBeInTheDocument()

    // day-group rubric for a same-day service
    expect(screen.getByText('today')).toBeInTheDocument()

    // countdown to the 18:00 mass, an hour out
    expect(screen.getByText(/in \d+ (h|min)/)).toBeInTheDocument()
  })
})

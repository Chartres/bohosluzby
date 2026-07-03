// Persona journey: Marie is in an unfamiliar part of Prague on a Friday
// afternoon and wants the nearest mass she can still make. One primary
// journey, all its states (Standard: persona-journey test per journey).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { IndexRow } from './domain/data'

// Friday 3 Jul 2026 17:00 Prague. Vitest fake timers pin "now".
const NOW = new Date('2026-07-03T15:00:00Z')

const INDEX: IndexRow[] = [
  ['1', 'kostel Nejsvětějšího Salvátora', 'Praha 1', 50.086, 14.417, 1, '50-14'],
  ['2', 'kostel sv. Havla', 'Praha 1', 50.0855, 14.4229, 0, '50-14'],
  ['3', 'kostel sv. Tomáše', 'Brno', 49.1986, 16.6072, 0, '49-16'],
]
const SHARD_50_14 = {
  '1': {
    u: '2026-06-01',
    p: 'Akademická farnost Praha',
    pa: '',
    c: [],
    s: [['5', '18:00', 'česky', 0, 'mše sv.', '']],
  },
  '2': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [['5', '19:30', 'Latine', 0, 'mše sv.', 'tridentská']],
  },
}
const SHARD_49_16 = {
  '3': { u: '2026-06-01', p: '', pa: '', c: [], s: [['7', '09:00', 'česky', 0, 'mše sv.', '']] },
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url)
      const body = path.endsWith('/data/churches.json')
        ? INDEX
        : path.endsWith('/data/services/50-14.json')
          ? SHARD_50_14
          : path.endsWith('/data/services/49-16.json')
            ? SHARD_49_16
            : null
      if (!body) return new Response('not found', { status: 404 })
      return new Response(JSON.stringify(body), { status: 200 })
    }),
  )
}

function stubGeolocation(impl: 'granted' | 'denied') {
  const getCurrentPosition = vi.fn(
    (
      ok: (pos: { coords: { latitude: number; longitude: number } }) => void,
      err: (e: unknown) => void,
    ) => {
      if (impl === 'granted') ok({ coords: { latitude: 50.0875, longitude: 14.4213 } })
      else err({ code: 1 })
    },
  )
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  })
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, shouldAdvanceTime: true })
  stubFetch()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Marie finds the nearest mass', () => {
  it('shows a loading state first', () => {
    stubGeolocation('granted')
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Hledám bohoslužby poblíž…')
  })

  it('with location: lists nearby services soonest-first with time-until and distance', async () => {
    stubGeolocation('granted')
    render(<App />)
    expect(await screen.findByText('kostel Nejsvětějšího Salvátora')).toBeInTheDocument()

    // 18:00 mass (in 1 h) ranks above the 19:30 Latin mass
    const names = screen.getAllByText(/kostel/).map((el) => el.textContent)
    expect(names[0]).toContain('Salvátora')
    expect(screen.getByText('za 1 h')).toBeInTheDocument()
    expect(screen.getByText(/dnes/)).toBeInTheDocument()
    // language chip only for the non-Czech service
    expect(screen.getByText('Latine')).toBeInTheDocument()
    // barrier-free chip from the index
    expect(screen.getByText('bezbariérový přístup')).toBeInTheDocument()
    // Brno (>30 km) is not in the list
    expect(screen.queryByText(/sv\. Tomáše/)).not.toBeInTheDocument()
  })

  it('without permission: explains and offers a manual city fallback', async () => {
    stubGeolocation('denied')
    render(<App />)
    expect(await screen.findByText('Bez přístupu k poloze')).toBeInTheDocument()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // typing a city that matches the datalist selects it immediately
    await user.type(screen.getByLabelText('Zvolte obec'), 'Brno')

    expect(await screen.findByText(/sv\. Tomáše/)).toBeInTheDocument()
    // the list header names the chosen city
    expect(screen.getByRole('button', { name: 'změnit' })).toBeInTheDocument()
  })

  it('empty area: reports no services within 30 km and keeps the picker', async () => {
    stubGeolocation('granted')
    // middle of nowhere (Šumava)
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
          ok({ coords: { latitude: 48.8, longitude: 13.5 } }),
      },
      configurable: true,
    })
    render(<App />)
    expect(await screen.findByText('V okolí nic nenacházím')).toBeInTheDocument()
    expect(screen.getByLabelText('Zvolte obec')).toBeInTheDocument()
  })
})

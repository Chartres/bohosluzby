// The public App Store build (v1.2) ships WITHOUT the pilgrim-witness feature
// (Canon 220 — not yet blessed). The gate is src/lib/flags.ts:WITNESS_ENABLED;
// this file mocks it to false and proves that NONE of the witness surfaces
// render — while confession, photos, schedule, and the rest stay fully working.
// Positive coverage (witness ON) is the rest of the suite (DEV=true) + the e2e
// specs (built with VITE_WITNESS_PREVIEW=1).
import { vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: null }))
vi.mock('./lib/flags', () => ({ WITNESS_ENABLED: false }))
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ChurchDetail } from './ChurchDetail'
import App from './App'
import MapView from './MapView'
import { aggregateFor, loadAggregates } from './lib/feedbackStore'
import type { Church, IndexRow } from './domain/data'

const NO_FILTERS = {
  lang: null,
  greek: false,
  barrierFree: false,
  massOnly: false,
  maxKm: null,
  witnessTags: [] as string[],
}

// Church "1" carries a Mass, a typed confession window, and a photo — the three
// non-witness surfaces that MUST keep rendering with witness gated off.
const SHARD_50_14 = {
  '1': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [
      ['7', '18:00', 'česky', 0, 'mše sv.', ''],
      ['7', '08:30 - 11:30', 'česky', 0, 'svátost smíření', ''],
    ],
  },
}
const PHOTOS = {
  '1': { url: 'https://commons.example/thumb.jpg', credit: 'Jan Novák', license: 'CC BY-SA 4.0' },
}

const church = (id: string): Church => ({
  id,
  name: `kostel ${id}`,
  city: 'Praha 1',
  lat: 50.086,
  lng: 14.417,
  barrierFree: false,
  cell: '50-14',
})

function stubDetailFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u.endsWith('/data/services/50-14.json'))
        return new Response(JSON.stringify(SHARD_50_14), { status: 200 })
      if (u.endsWith('/data/photos.json')) return new Response(JSON.stringify(PHOTOS), { status: 200 })
      return new Response('not found', { status: 404 })
    }),
  )
}

describe('witness gate OFF — church detail', () => {
  beforeEach(() => {
    localStorage.clear()
    // Seed real witness testimony for church "1": with the feature ON this would
    // paint the "V tomto kostele poutníci často zmiňují" block. The gate must
    // suppress it even though the data is present in the store.
    localStorage.setItem(
      'bohosluzby:massFeedback',
      JSON.stringify([{ churchId: '1', massKey: 'm1', deviceId: 'd1', chips: ['krasny_zpev'] }]),
    )
    stubDetailFetch()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('hides every witness surface while confession, photo, and schedule stay', async () => {
    await loadAggregates(['1']) // fold the seeded mirror into the shared cache
    // sanity: the testimony IS in the store, so an absent block is the gate, not missing data
    expect(aggregateFor('1').church.chips.length).toBeGreaterThan(0)

    render(<ChurchDetail church={church('1')} onBack={() => {}} />)

    // schedule renders (non-witness) …
    const schedule = await screen.findByRole('region', { name: 'Pořad bohoslužeb' })
    expect(within(schedule).getByText('18:00')).toBeInTheDocument()
    // … confession renders (non-witness) …
    const confession = screen.getByRole('region', { name: 'Svátost smíření' })
    expect(within(confession).getByText('08:30 - 11:30')).toBeInTheDocument()
    // … photo renders (non-witness) …
    expect(screen.getByRole('img', { name: 'kostel 1' })).toBeInTheDocument()

    // … but the witness block is gone.
    expect(
      screen.queryByRole('region', { name: 'V tomto kostele poutníci často zmiňují' }),
    ).toBeNull()
    expect(screen.queryByText(/diverges|jindy zmiňují/i)).toBeNull()
  })
})

describe('witness gate OFF — filter sheet', () => {
  const INDEX: IndexRow[] = [
    ['1', 'kostel Salvátor', 'Praha 1', 50.086, 14.417, 0, '50-14'],
  ]
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('bohosluzby:introSeen', '1')
    vi.useFakeTimers({ now: new Date('2026-07-03T15:00:00Z'), shouldAdvanceTime: true })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url)
        if (u.endsWith('/data/churches.json')) return new Response(JSON.stringify(INDEX), { status: 200 })
        if (u.endsWith('/data/services/50-14.json'))
          return new Response(JSON.stringify(SHARD_50_14), { status: 200 })
        return new Response('not found', { status: 404 })
      }),
    )
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
          ok({ coords: { latitude: 50.086, longitude: 14.417 } }),
      },
      configurable: true,
    })
    window.history.replaceState(null, '', '/?zobrazeni=seznam')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('has no "Ohlasy poutníků" section in the filters', async () => {
    render(<App />)
    await screen.findByText('kostel Salvátor')
    fireEvent.click(screen.getByRole('button', { name: 'co: filtry' }))
    // the "co" surface still carries its real filters …
    expect(screen.getByRole('button', { name: 'jen mše svaté' })).toBeInTheDocument()
    // … but not the pilgrim-witness block.
    expect(screen.queryByText('Ohlasy poutníků')).toBeNull()
  })
})

describe('witness gate OFF — map legend', () => {
  it('shows only the two colour rows, no witness fold row', () => {
    const { container } = render(
      <MapView
        origin={{ lat: 50.086, lng: 14.417 }}
        churches={[]}
        filters={NO_FILTERS}
        cas={null}
        day={'now'}
        onOpen={() => {}}
        onNavigate={() => {}}
      />,
    )
    const legend = container.querySelector('.map-legend')!
    expect(within(legend as HTMLElement).getByText('vyhovuje zadání')).toBeInTheDocument()
    expect(within(legend as HTMLElement).getByText('jiný den')).toBeInTheDocument()
    expect(within(legend as HTMLElement).queryByText('ohlasy poutníků')).toBeNull()
  })
})

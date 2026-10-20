// J1: the map's chips must follow App's clock (minute tick + resume refresh),
// not freeze at the time of the last pan.
import { vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: null }))
vi.mock('./lib/flags', () => ({ WITNESS_ENABLED: false }))
import { render, waitFor } from '@testing-library/react'
import MapView from './MapView'
import type { Church } from './domain/data'
import { NO_FILTERS } from './domain/filters'

const church: Church = { id: '1', name: 'kostel 1', city: 'Praha 1', lat: 50.086, lng: 14.417, barrierFree: false, cell: '50-14' }
const SHARD = { '1': { u: '2026-06-01', p: '', pa: '', c: [], s: [['7', '18:00', 'česky', 0, 'mše sv.', '']] } }

describe('MapView chips follow the clock', () => {
  beforeEach(() => {
    // jsdom lays nothing out — give Leaflet a phone-sized container so bounds aren't a point
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(393)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SHARD), { status: 200 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('re-renders the chip when App’s now moves past the Mass', async () => {
    const props = {
      origin: { lat: church.lat, lng: church.lng },
      churches: [church],
      filters: NO_FILTERS,
      cas: null,
      day: 'now' as const,
      onOpen: () => {},
      onNavigate: () => {},
    }
    // Sunday 2026-10-18, 17:00 Prague → the 18:00 Mass is next today
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-18T15:00:00Z'))
    const { container, rerender } = render(<MapView {...props} now={new Date()} />)
    const chip = () => container.querySelector('.map-chip')?.textContent
    await waitFor(() => expect(chip()).toBe('18:00'))
    // backgrounded until 18:30 → resume tick: next is a week out, weekday-prefixed
    vi.setSystemTime(new Date('2026-10-18T16:30:00Z'))
    rerender(<MapView {...props} now={new Date()} />)
    await waitFor(() => expect(chip()).toMatch(/^ne 18:00$/))
    vi.useRealTimers()
  })
})

describe('MapView time-driven rebuilds (K1/K2)', () => {
  const props = {
    origin: { lat: church.lat, lng: church.lng },
    churches: [church],
    filters: NO_FILTERS,
    cas: null,
    day: 'now' as const,
    onOpen: () => {},
    onNavigate: () => {},
  }
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(393)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SHARD), { status: 200 })))
    window.history.replaceState({}, '', '/?diag')
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  const tick = () => new Promise((r) => setTimeout(r, 30))
  const mapOf = () => (window as unknown as { __map: { fire: (e: string) => void } }).__map

  it('a minute tick that changes no chip text keeps the marker nodes', async () => {
    vi.setSystemTime(new Date('2026-10-18T15:00:00Z'))
    const { container, rerender } = render(<MapView {...props} now={new Date()} />)
    await waitFor(() => expect(container.querySelector('.map-chip')?.textContent).toBe('18:00'))
    const node = container.querySelector('.map-chip')
    vi.setSystemTime(new Date('2026-10-18T15:01:00Z'))
    rerender(<MapView {...props} now={new Date()} />)
    await tick()
    expect(container.querySelector('.map-chip')).toBe(node)
  })

  it('a tick mid-gesture waits for moveend, which then shows the fresh time', async () => {
    vi.setSystemTime(new Date('2026-10-18T15:00:00Z'))
    const { container, rerender } = render(<MapView {...props} now={new Date()} />)
    await waitFor(() => expect(container.querySelector('.map-chip')?.textContent).toBe('18:00'))
    const node = container.querySelector('.map-chip')
    mapOf().fire('movestart')
    vi.setSystemTime(new Date('2026-10-18T16:30:00Z'))
    rerender(<MapView {...props} now={new Date()} />)
    await tick()
    expect(container.querySelector('.map-chip')).toBe(node) // untouched mid-gesture
    mapOf().fire('moveend')
    await waitFor(() => expect(container.querySelector('.map-chip')?.textContent).toBe('ne 18:00'))
  })

  it('the popover reads the same clock as the chip', async () => {
    vi.setSystemTime(new Date('2026-10-18T15:59:30Z')) // 17:59:30 Prague
    const { container } = render(<MapView {...props} now={new Date()} />)
    await waitFor(() => expect(container.querySelector('.map-chip')?.textContent).toBe('18:00'))
    vi.setSystemTime(new Date('2026-10-18T16:00:30Z')) // 18:00:30, before App's next tick
    ;(container.querySelector('.leaflet-marker-icon.map-chip-wrap') as HTMLElement).click()
    await waitFor(() => expect(container.querySelector('.map-pop-line')).not.toBeNull())
    expect(container.querySelector('.map-pop-line')!.textContent).not.toMatch(/25\. 10\./) // not next week's
  })
})

// Friends' feedback (2026-10-21): a tap on a church should show the whole day's
// services, not only the next one; and coming back from a church page must
// land on the map where you left it, not recentre on your position.
import { vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: null }))
vi.mock('./lib/flags', () => ({ WITNESS_ENABLED: false }))
import { render, waitFor } from '@testing-library/react'
import MapView from './MapView'
import type { Church } from './domain/data'
import { NO_FILTERS, type Filters } from './domain/filters'
import { resetMapMemory } from './lib/mapMemory'

const church: Church = { id: '1', name: 'kostel 1', city: 'Praha 1', lat: 50.086, lng: 14.417, barrierFree: false, cell: '50-14' }
const sunday = (rows: [string, string, number, string][]) => ({
  '1': { u: '2026-06-01', p: '', pa: '', c: [], s: rows.map(([time, lang, greek, type]) => ['7', time, lang, greek, type, '']) },
})
const THREE = sunday([
  ['07:00', 'česky', 0, 'mše sv.'],
  ['09:30', 'latinsky', 0, 'mše sv.'],
  ['18:00', 'česky', 0, 'adorace'],
])
const SIX = sunday([
  ['07:00', 'česky', 0, 'mše sv.'],
  ['08:30', 'česky', 0, 'mše sv.'],
  ['10:00', 'česky', 0, 'mše sv.'],
  ['11:30', 'polsky', 0, 'mše sv.'],
  ['17:00', 'česky', 0, 'růženec'],
  ['18:00', 'česky', 0, 'mše sv.'],
])

const base = {
  origin: { lat: church.lat, lng: church.lng },
  churches: [church],
  filters: NO_FILTERS,
  cas: null,
  day: 'now' as const,
  onNavigate: () => {},
}
type Map = { setView: (c: [number, number], z: number) => void; getCenter: () => { lat: number; lng: number }; getZoom: () => number }
const mapOf = () => (window as unknown as { __map: Map }).__map

function setup(shard: object) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(393)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(shard), { status: 200 })))
}

async function openPopover(container: HTMLElement) {
  await waitFor(() => expect(container.querySelector('.leaflet-marker-icon.map-chip-wrap')).not.toBeNull())
  ;(container.querySelector('.leaflet-marker-icon.map-chip-wrap') as HTMLElement).click()
  await waitFor(() => expect(container.querySelector('.map-pop-ordo')).not.toBeNull())
}
const rows = (c: HTMLElement) => [...c.querySelectorAll('.map-pop-row')] as HTMLElement[]

describe('map popover: the day’s timetable (2B)', () => {
  beforeEach(() => {
    resetMapMemory()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-18T04:00:00Z')) // Sunday 06:00 Prague
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lists every service of the day — time, type, non-Czech language — the next one marked', async () => {
    setup(THREE)
    const { container } = render(<MapView {...base} onOpen={() => {}} now={new Date()} />)
    await openPopover(container)
    expect(container.querySelector('.map-pop-line')!.textContent).toBe('dnes')
    expect(rows(container).map((r) => r.textContent)).toEqual([
      '07:00mše sv.',
      '09:30mše sv. · latinsky',
      '18:00adorace',
    ])
    expect(rows(container)[0].classList.contains('map-pop-row--next')).toBe(true)
    expect(container.querySelector('.map-pop-more')).toBeNull()
  })

  it('services the filters exclude stay listed, dimmed — the match is the marked one', async () => {
    setup(THREE)
    const filters: Filters = { ...NO_FILTERS, lang: 'latinsky' }
    const { container } = render(<MapView {...base} filters={filters} onOpen={() => {}} now={new Date()} />)
    await openPopover(container)
    const r = rows(container)
    expect(r.map((x) => x.classList.contains('map-pop-row--off'))).toEqual([true, false, true])
    expect(r[1].classList.contains('map-pop-row--next')).toBe(true)
  })

  it('a long day shows four rows and "+2 další ›", which opens the church at the marked service', async () => {
    setup(SIX)
    const onOpen = vi.fn()
    const { container } = render(<MapView {...base} onOpen={onOpen} now={new Date()} />)
    await openPopover(container)
    expect(rows(container)).toHaveLength(4)
    const more = container.querySelector('.map-pop-more') as HTMLElement
    expect(more.textContent).toBe('+2 další ›')
    more.click()
    expect(onOpen).toHaveBeenCalledWith('1', new Date('2026-10-18T05:00:00Z')) // the 07:00
  })

  it('nothing for the selection: the miss leads, then the nearest day’s timetable', async () => {
    setup(THREE)
    const filters: Filters = { ...NO_FILTERS, lang: 'polsky' }
    const { container } = render(<MapView {...base} filters={filters} onOpen={() => {}} now={new Date()} />)
    await waitFor(() => expect(container.querySelector('.leaflet-marker-icon.map-marker')).not.toBeNull())
    ;(container.querySelector('.leaflet-marker-icon.map-marker') as HTMLElement).click() // the faded dot
    await waitFor(() => expect(container.querySelector('.map-pop-miss')).not.toBeNull())
    expect(container.querySelector('.map-pop-line')!.textContent).toBe('pro váš výběr nic — nejbližší: dnes')
    expect(rows(container)).toHaveLength(3)
  })
})

describe('map memory: back from a church lands where you left (1A)', () => {
  beforeEach(() => {
    resetMapMemory()
    window.history.replaceState({}, '', '/?diag')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-18T04:00:00Z'))
    setup(THREE)
  })
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('restores centre + zoom and reopens the church’s popover after "otevřít"', async () => {
    const first = render(<MapView {...base} onOpen={() => {}} now={new Date()} />)
    mapOf().setView([church.lat + 0.001, church.lng + 0.001], 15)
    await openPopover(first.container)
    const at = mapOf().getCenter()
    ;(first.container.querySelector('.map-pop-open') as HTMLElement).click() // otevřít
    first.unmount() // the church page replaces the map

    const back = render(<MapView {...base} onOpen={() => {}} now={new Date()} />)
    expect(mapOf().getZoom()).toBe(15)
    expect(mapOf().getCenter().lat).toBeCloseTo(at.lat, 5)
    expect(mapOf().getCenter().lng).toBeCloseTo(at.lng, 5)
    await waitFor(() => expect(back.container.querySelector('.map-pop-name')?.textContent).toBe('kostel 1'))
  })

  it('a pan without opening a church is restored too, with no popover', async () => {
    const first = render(<MapView {...base} onOpen={() => {}} now={new Date()} />)
    mapOf().setView([church.lat + 0.002, church.lng], 14)
    first.unmount() // e.g. switched to seznam and back
    const back = render(<MapView {...base} onOpen={() => {}} now={new Date()} />)
    expect(mapOf().getCenter().lat).toBeCloseTo(church.lat + 0.002, 5)
    expect(mapOf().getZoom()).toBe(14)
    await waitFor(() => expect(back.container.querySelector('.map-chip')).not.toBeNull())
    expect(back.container.querySelector('.map-pop-name')).toBeNull()
  })

  it('a new origin (fresh GPS fix, another city) centres on it and forgets the old view', async () => {
    const first = render(<MapView {...base} onOpen={() => {}} now={new Date()} />)
    await openPopover(first.container)
    ;(first.container.querySelector('.map-pop-open') as HTMLElement).click()
    mapOf().setView([50.2, 14.6], 16)
    first.unmount()
    const elsewhere = { lat: 49.195, lng: 16.608 } // Brno
    const back = render(<MapView {...base} origin={elsewhere} onOpen={() => {}} now={new Date()} />)
    expect(mapOf().getCenter().lat).toBeCloseTo(elsewhere.lat, 5)
    expect(mapOf().getZoom()).toBe(13)
    await new Promise((r) => setTimeout(r, 30))
    expect(back.container.querySelector('.map-pop-name')).toBeNull()
  })
})

// Pavol, 2026-10-25: with "řeckokatolické" on, Brno showed grey "3"/"2" circles that
// turned into near-invisible dots on zoom ("they disappear"). A group with no match
// must look like what it zooms into: the faded dot, not a count circle.
describe('map clusters with no match', () => {
  beforeEach(() => resetMapMemory())
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  it('render as a faded dot, the same mark their churches show when zoomed in', async () => {
    const a: Church = { ...church, id: '1' }
    const b: Church = { ...church, id: '2', name: 'kostel 2', lat: church.lat + 0.0005 }
    const shard = { ...THREE, '2': THREE['1'] }
    setup(shard)
    const filters: Filters = { ...NO_FILTERS, greek: true } // nothing here is Greek-Catholic
    const { container } = render(
      <MapView {...base} churches={[a, b]} filters={filters} onOpen={() => {}} now={new Date('2026-10-18T04:00:00Z')} />,
    )
    await waitFor(() => expect(container.querySelector('.map-dot--faded')).not.toBeNull())
    expect(container.querySelector('.map-cluster')).toBeNull()
    expect(container.querySelectorAll('.map-dot--faded')).toHaveLength(1) // one mark for the pair
  })
  it('a group holding a match keeps its count circle', async () => {
    const a: Church = { ...church, id: '1' }
    const b: Church = { ...church, id: '2', name: 'kostel 2', lat: church.lat + 0.0005 }
    setup({ ...THREE, '2': THREE['1'] })
    const { container } = render(
      <MapView {...base} churches={[a, b]} onOpen={() => {}} now={new Date('2026-10-18T04:00:00Z')} />,
    )
    await waitFor(() => expect(container.querySelector('.map-cluster')?.textContent).toBe('2'))
  })
})

// Pavol, 2026-10-25 (2A): a church with more fitting services that day says so on
// the chip — "7:30⁺²" — instead of hiding the 9:00 and 11:00 behind a tap.
describe('chip count of further matching services that day', () => {
  beforeEach(() => {
    resetMapMemory()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-18T04:00:00Z')) // Sunday 06:00 Prague
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  const chip = (c: HTMLElement) => c.querySelector('.map-chip') as HTMLElement | null
  it('shows +N for the day’s later matching services', async () => {
    setup(SIX)
    const { container } = render(<MapView {...base} onOpen={() => {}} now={new Date()} />)
    await waitFor(() => expect(chip(container)?.textContent).toBe('7:00+5'))
    expect(container.querySelector('.map-chip-more')?.textContent).toBe('+5')
  })
  it('counts only what the filters let through', async () => {
    setup(SIX)
    const filters: Filters = { ...NO_FILTERS, lang: 'polsky' }
    const { container } = render(<MapView {...base} filters={filters} onOpen={() => {}} now={new Date()} />)
    await waitFor(() => expect(chip(container)?.textContent).toBe('11:30'))
    expect(container.querySelector('.map-chip-more')).toBeNull()
  })
  it('on an ordo day (dnes) too — the earliest chip, the rest counted', async () => {
    setup(THREE)
    const { container } = render(<MapView {...base} day={0} onOpen={() => {}} now={new Date()} />)
    await waitFor(() => expect(chip(container)?.textContent).toBe('7:00+2'))
  })
})

// Confession ("svátost smíření") rows are stored as service rows whose TIME is a
// window range, not a Mass start. They must stay out of the Mass schedule and
// render in their own auxiliary section, range intact.
import { vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: null }))
import { render, screen, within } from '@testing-library/react'
import { ChurchDetail } from './ChurchDetail'
import type { Church } from './domain/data'

const church = (id: string, cell: string): Church => ({
  id,
  name: `kostel ${id}`,
  city: 'Praha 1',
  lat: 50.086,
  lng: 14.417,
  barrierFree: false,
  cell,
})

// A shard with one Mass row plus two confession rows (mixed case + a per-day
// code "24" = Tue & Thu) for church "1"; church "2" has only a Mass.
const SHARD = {
  '1': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [
      ['7', '18:00', 'česky', 0, 'mše sv.', ''],
      ['7', '08:30 - 11:30', 'česky', 0, 'svátost smíření', ''],
      ['24', '17:00 - 17:45', 'česky', 0, 'Svátost smíření', ''],
    ],
  },
  '2': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [['7', '09:00', 'česky', 0, 'mše sv.', '']],
  },
  // church "3": no typed confession row — its only confession signal is a Mass note.
  '3': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [['5', '18:00', 'česky', 0, 'mše sv.', 'od 17.00 svátost smíření']],
  },
}

// Church "1" has a photo entry; "2"/"3" do not.
const PHOTOS = {
  '1': { url: 'https://commons.example/thumb.jpg', credit: 'Jan Novák', license: 'CC BY-SA 4.0' },
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u.endsWith('/data/services/50-14.json'))
        return new Response(JSON.stringify(SHARD), { status: 200 })
      if (u.endsWith('/data/photos.json')) return new Response(JSON.stringify(PHOTOS), { status: 200 })
      return new Response('not found', { status: 404 })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('confession section', () => {
  it('keeps confession rows out of the Mass schedule and renders them verbatim', async () => {
    render(<ChurchDetail church={church('1', '50-14')} onBack={() => {}} />)

    const schedule = await screen.findByRole('region', { name: 'Pořad bohoslužeb' })
    // (a) the Mass schedule holds the Mass, not the confession windows
    expect(within(schedule).getByText('18:00')).toBeInTheDocument()
    expect(within(schedule).queryByText(/08:30 - 11:30/)).toBeNull()
    expect(within(schedule).queryByText(/17:00 - 17:45/)).toBeNull()

    // (b) both confession windows show under the Confession section, range intact
    const confession = screen.getByRole('region', { name: 'Svátost smíření' })
    expect(within(confession).getByText('08:30 - 11:30')).toBeInTheDocument()
    // days code "24" = Tuesday & Thursday, so this window groups under both days
    expect(within(confession).getAllByText('17:00 - 17:45')).toHaveLength(2)
  })

  it('renders no Confession section when the church has none', async () => {
    render(<ChurchDetail church={church('2', '50-14')} onBack={() => {}} />)
    await screen.findByRole('region', { name: 'Pořad bohoslužeb' })
    expect(screen.queryByRole('region', { name: 'Svátost smíření' })).toBeNull()
  })
})

describe('church photo', () => {
  it('renders the photo and its attribution when a photo exists', async () => {
    render(<ChurchDetail church={church('1', '50-14')} onBack={() => {}} />)
    const img = await screen.findByRole('img', { name: 'kostel 1' })
    expect(img).toHaveAttribute('src', 'https://commons.example/thumb.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(screen.getByText(/foto: Jan Novák · CC BY-SA 4\.0 · Wikimedia Commons/)).toBeInTheDocument()
  })

  it('renders no image when the church has no photo entry', async () => {
    render(<ChurchDetail church={church('2', '50-14')} onBack={() => {}} />)
    await screen.findByRole('region', { name: 'Pořad bohoslužeb' })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('surfaces a confession time parsed from a Mass note, keeping the note on its Mass', async () => {
    render(<ChurchDetail church={church('3', '50-14')} onBack={() => {}} />)

    // the parsed 17:00 appears in the Confession section...
    const confession = await screen.findByRole('region', { name: 'Svátost smíření' })
    expect(within(confession).getByText('17:00')).toBeInTheDocument()

    // ...while the Mass row keeps its note and its own 18:00 time
    const schedule = screen.getByRole('region', { name: 'Pořad bohoslužeb' })
    expect(within(schedule).getByText('18:00')).toBeInTheDocument()
    expect(within(schedule).getByText('od 17.00 svátost smíření')).toBeInTheDocument()
  })
})

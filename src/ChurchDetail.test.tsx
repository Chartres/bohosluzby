// Confession ("svátost smíření") rows are stored as service rows whose TIME is a
// window range, not a Mass start. They must stay out of the Mass schedule and
// render in their own auxiliary section, range intact.
import { vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: null }))
import { act, render, screen, within } from '@testing-library/react'
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
  // church "4": a plain Mass, no registry/note confession — its ONLY confession
  // signal is the diocesan confession.json entry below.
  '4': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [['7', '10:30', 'česky', 0, 'mše sv.', '']],
  },
  // church "5": a plain Mass; carries a photo whose credit has duplicate wiki
  // markup to tidy.
  '5': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [['7', '09:15', 'česky', 0, 'mše sv.', '']],
  },
  // church "8": a plain Mass whose photo entry has no credit.
  '8': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [['7', '11:00', 'česky', 0, 'mše sv.', '']],
  },
  // church "6": one Po/St/Pá record whose note is about Friday only (registry church 10009).
  '6': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [['135', '15:00', 'česky', 0, 'mše sv.', 'V červenci, srpnu a září není páteční mše sv.']],
  },
}

// Church "1"/"5" have a photo entry; "8" has one without a credit; "2"/"3"/"4" none.
const PHOTOS = {
  '1': { url: 'https://commons.example/thumb.jpg', credit: 'Jan Novák', license: 'CC BY-SA 4.0' },
  '5': { url: 'https://commons.example/sju.jpg', credit: 'ŠJů ( cs:ŠJů )', license: 'CC BY-SA 3.0' },
  // registry church 100044 shipped like this: a CC BY photo with no author to credit
  '8': { url: 'https://commons.example/anon.jpg', credit: '', license: 'CC BY 2.5' },
}

// Diocesan "stálá zpovědní služba" windows, keyed by church id: verbatim day +
// (possibly multi-range) time + note.
const CONFESSION = {
  '4': {
    source: 'apha',
    rows: [
      { den: 'Po – Pá', cas: '9.00 – 15.00', note: '30 min přede mší sv.' },
      { den: 'Ne', cas: '9.00 – 9.45 16.00 – 16.45', note: '' },
    ],
  },
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
      if (u.endsWith('/data/confession.json'))
        return new Response(JSON.stringify(CONFESSION), { status: 200 })
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

  it('shows diocesan confession.json windows — the section appears from that alone', async () => {
    render(<ChurchDetail church={church('4', '50-14')} onBack={() => {}} />)

    const confession = await screen.findByRole('region', { name: 'Svátost smíření' })
    // verbatim day + time-window (multi-range kept intact), not in the Mass schedule
    expect(within(confession).getByText('Po – Pá')).toBeInTheDocument()
    expect(within(confession).getByText('9.00 – 9.45 16.00 – 16.45')).toBeInTheDocument()
    expect(within(confession).getByText('30 min přede mší sv.')).toBeInTheDocument()

    const schedule = screen.getByRole('region', { name: 'Pořad bohoslužeb' })
    expect(within(schedule).queryByText(/9\.00 – 15\.00/)).toBeNull()
  })
})

describe('church photo', () => {
  it('renders the photo as a hero with the title over it when a photo exists', async () => {
    render(<ChurchDetail church={church('1', '50-14')} onBack={() => {}} />)
    const img = await screen.findByRole('img', { name: 'kostel 1' })
    expect(img).toHaveAttribute('src', 'https://commons.example/thumb.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
    // hero: the church title and the image live in the same <figure>, so the
    // name renders OVER the photo (Booking/Airbnb property-header style)
    const figure = img.closest('figure')
    expect(figure).not.toBeNull()
    expect(within(figure!).getByRole('heading', { name: 'kostel 1' })).toBeInTheDocument()
    // the meta links sit over the hero too
    expect(within(figure!).getByRole('button', { name: 'navigace' })).toBeInTheDocument()
    expect(screen.getByText(/foto: Jan Novák · CC BY-SA 4\.0 · Wikimedia Commons/)).toBeInTheDocument()
  })

  it('overlays back + help on the photo hero in one row, and reports the hero', async () => {
    const onBack = vi.fn()
    const onHelp = vi.fn()
    const onHeroChange = vi.fn()
    render(
      <ChurchDetail church={church('1', '50-14')} onBack={onBack} onHelp={onHelp} onHeroChange={onHeroChange} />,
    )
    const img = await screen.findByRole('img', { name: 'kostel 1' })
    const figure = img.closest('figure')!
    // both global controls live ON the hero, in one row (shared baseline), with
    // the legibility text-shadow
    const back = within(figure).getByRole('button', { name: '‹ zpět na seznam' })
    const help = within(figure).getByRole('button', { name: 'nápověda' })
    expect(back.parentElement).toBe(help.parentElement)
    expect(back.closest('.hero-glow')).not.toBeNull() // paper text in an ink halo on the hero gradient
    back.click()
    help.click()
    expect(onBack).toHaveBeenCalled()
    expect(onHelp).toHaveBeenCalled()
    // the shell is told a hero is up so it can drop its masthead — from a passive
    // effect, which can flush after the image is found (flaked in CI 2026-10-07)
    await vi.waitFor(() => expect(onHeroChange).toHaveBeenCalledWith(true))
  })

  it('once the hero nav scrolls away, a paper bar with back takes over', async () => {
    let fire: IntersectionObserverCallback | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          fire = cb
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
      },
    )
    const onBack = vi.fn()
    render(<ChurchDetail church={church('1', '50-14')} onBack={onBack} />)
    await screen.findByRole('img', { name: 'kostel 1' })
    await vi.waitFor(() => expect(fire).toBeDefined())
    expect(screen.getAllByRole('button', { name: '‹ zpět na seznam' })).toHaveLength(1)
    const scrolled = (top: number, isIntersecting: boolean) =>
      act(() => fire!([{ isIntersecting, boundingClientRect: { top } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver))
    scrolled(-4, false)
    const backs = screen.getAllByRole('button', { name: '‹ zpět na seznam' })
    expect(backs).toHaveLength(2)
    const bar = backs.find((b) => !b.closest('figure'))!
    expect(bar.closest('.fixed')!.className).toMatch(/\bbg-paper\b/)
    bar.click()
    expect(onBack).toHaveBeenCalled()
    scrolled(40, true) // back at the top → bar gone
    expect(screen.getAllByRole('button', { name: '‹ zpět na seznam' })).toHaveLength(1)
  })

  it('tidies the photo credit — drops duplicate wiki markup, keeps licence + source', async () => {
    render(<ChurchDetail church={church('5', '50-14')} onBack={() => {}} />)
    await screen.findByRole('img', { name: 'kostel 5' })
    // "ŠJů ( cs:ŠJů )" → "ŠJů"
    expect(screen.getByText('foto: ŠJů · CC BY-SA 3.0 · Wikimedia Commons')).toBeInTheDocument()
    expect(screen.queryByText(/cs:ŠJů/)).toBeNull()
  })

  it('drops a photo with an empty credit — CC licences require the attribution line', async () => {
    const onHeroChange = vi.fn()
    render(<ChurchDetail church={church('8', '50-14')} onBack={() => {}} onHeroChange={onHeroChange} />)
    await screen.findByRole('heading', { name: 'kostel 8' })
    await act(async () => {}) // let photos.json resolve
    expect(screen.queryByRole('img')).toBeNull()
    expect(onHeroChange).not.toHaveBeenCalledWith(true)
  })

  it('renders no image and a plain title when the church has no photo entry', async () => {
    const onHeroChange = vi.fn()
    render(<ChurchDetail church={church('2', '50-14')} onBack={() => {}} onHeroChange={onHeroChange} />)
    const heading = await screen.findByRole('heading', { name: 'kostel 2' })
    expect(screen.queryByRole('img')).toBeNull()
    // plain layout: the title is NOT wrapped in a photo figure
    expect(heading.closest('figure')).toBeNull()
    // no hero → the shell keeps its masthead (no back/help overlaid)
    expect(onHeroChange).not.toHaveBeenCalledWith(true)
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

describe('share', () => {
  // Inside the native shell location.origin is capacitor://localhost (iOS) or
  // https://localhost (Android) — sharing it handed people a dead link. The
  // shared URL is always the public one, whatever origin the app runs on.
  it('shares the public church URL, never the app origin', async () => {
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    render(<ChurchDetail church={church('2', '50-14')} onBack={() => {}} />)
    await screen.findByRole('region', { name: 'Pořad bohoslužeb' })
    screen.getAllByRole('button', { name: 'sdílet' })[0].click()
    await vi.waitFor(() => expect(share).toHaveBeenCalled())
    expect(share).toHaveBeenCalledWith({ title: 'kostel 2', url: 'https://bohosluzby.dravec.org/kostel/2/' })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  })
})

describe('Moje kostely star', () => {
  it('saves the church on this device and shows it as saved', async () => {
    localStorage.clear()
    render(<ChurchDetail church={church('2', '50-14')} onBack={() => {}} />)
    await screen.findByRole('region', { name: 'Pořad bohoslužeb' })
    const star = screen.getByRole('button', { name: /uložit mezi moje kostely/i })
    expect(star).toHaveAttribute('aria-pressed', 'false')
    star.click()
    await vi.waitFor(() => expect(star).toHaveAttribute('aria-pressed', 'true'))
    expect(JSON.parse(localStorage.getItem('bohosluzby:favorites')!)).toEqual(['2'])
  })
})

describe('weekday-specific notes', () => {
  it('prints a Friday-only note under Friday, not under Monday and Wednesday', async () => {
    render(<ChurchDetail church={church('6', '50-14')} onBack={() => {}} />)
    const schedule = await screen.findByRole('region', { name: 'Pořad bohoslužeb' })
    expect(within(schedule).getAllByText('15:00')).toHaveLength(3)
    expect(within(schedule).getAllByText('V červenci, srpnu a září není páteční mše sv.')).toHaveLength(1)
  })
})

// Mechanic C (docs/SIGNATURE.md): pozvat — one person invites another to one Mass.
describe('pozvat', () => {
  it('opens the share sheet with the next date, time, church and a tagged link', async () => {
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    try {
      render(<ChurchDetail church={church('2', '50-14')} onBack={() => {}} />)
      const schedule = await screen.findByRole('region', { name: 'Pořad bohoslužeb' })
      await act(async () => within(schedule).getAllByRole('button', { name: 'pozvat' })[0].click())
      expect(share).toHaveBeenCalledTimes(1)
      const arg = (share.mock.calls[0] as unknown as [{ text: string; url: string }])[0]
      expect(arg.text).toMatch(/^Půjdeš se mnou na mši svatou\? (Dnes|Zítra|V neděli \d+\. \d+\.) v 09:00, kostel 2 \(Praha 1\)\.$/)
      expect(arg.url).toBe('https://bohosluzby.dravec.org/kostel/2/?utm_source=pozvani')
    } finally {
      delete (navigator as { share?: unknown }).share
    }
  })
})

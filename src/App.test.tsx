// Persona journey: Marie is in an unfamiliar part of Prague on a Friday
// afternoon and wants the nearest mass she can still make. One primary
// journey, all its states (Standard: persona-journey test per journey).
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { IndexRow } from './domain/data'

// Friday 3 Jul 2026 17:00 Prague. Vitest fake timers pin "now".
const NOW = new Date('2026-07-03T15:00:00Z')

// Time assertions scope to the service list — the "kolem" select's 48 options
// put every "HH:MM" string into the DOM.
const seznam = () => within(screen.getByTestId('seznam'))

const INDEX: IndexRow[] = [
  ['1', 'kostel Nejsvětějšího Salvátora', 'Praha 1', 50.086, 14.417, 1, '50-14', 'https://www.farnostsalvator.cz'],
  ['2', 'kostel sv. Havla', 'Praha 1', 50.0855, 14.4229, 0, '50-14'],
  ['3', 'kostel sv. Tomáše', 'Brno', 49.1986, 16.6072, 0, '49-16'],
  ['7', 'kaple sv. Anny', 'Praha 1', 50.088, 14.42, 0, '50-14'],
]
const SHARD_50_14 = {
  '1': {
    u: '2026-06-01',
    p: 'Akademická farnost Praha',
    pa: 'Křižovnické nám. 4, Praha 1',
    c: [
      ['www', 'https://www.farnostsalvator.cz'],
      ['phone', '222 221 339'],
    ],
    s: [
      ['5', '18:00', 'česky', 0, 'mše sv.', ''],
      ['7', '14:00', 'česky', 0, '', ''], // registry rows often omit the type
      ['7', '20:00', 'česky', 0, 'mše sv.', 'studentská'],
    ],
    x: [
      ['2026-07-05', '15:00', 'česky', 0, 'pobožnost', 'první neděle'],
      ['2026-01-06', '18:00', 'česky', 0, 'mše sv.', 'Tři králové'], // past → hidden
    ],
  },
  '2': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [
      ['5', '19:00', 'česky', 0, 'růženec', ''],
      ['5', '19:30', 'Latine', 0, 'mše sv.', 'tridentská'],
      // the registry lists the same Sunday slot twice (real pattern: seasonal variants)
      ['7', '10:00', 'česky', 0, 'mše sv.', ''],
      ['7', '10:00', 'česky', 0, 'mše sv.', 'varianta'],
    ],
  },
  '7': {
    u: '2026-06-01',
    p: '',
    pa: '',
    c: [],
    s: [
      ['5', '20:00', 'česky', 0, 'mše sv.', 'kromě července a srpna'], // provably not in July
      ['5', '21:00', 'česky', 0, 'mše sv.', 'nepravidelně, dle ohlášení'], // unverifiable → loud note
    ],
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
    // fake clock ticks with real time → "za 1 h" can slip to "za 59 min" on slow CI
    expect(screen.getByText(/^za (1 h|59 min)$/)).toBeInTheDocument()
    expect(screen.getAllByText(/dnes/).length).toBeGreaterThan(0)
    // language chip only for the non-Czech service, normalized to Czech lowercase
    expect(screen.getByText('latinsky')).toBeInTheDocument()
    expect(screen.queryByText('Latine')).not.toBeInTheDocument()
    // barrier-free icon from the index (aria-labelled, inline — row height unchanged)
    expect(screen.getAllByRole('img', { name: 'bezbariérový přístup' }).length).toBeGreaterThan(0)
    // Brno (>30 km) is not in the list
    expect(screen.queryByText(/sv\. Tomáše/)).not.toBeInTheDocument()

    // verify-without-detail: every row links to the map, parish web when known
    const maps = screen.getAllByRole('link', { name: 'mapa' })
    expect(maps.length).toBeGreaterThan(1)
    expect(maps[0]).toHaveAttribute('href', expect.stringContaining('mapy.cz'))
    expect(screen.getByRole('link', { name: 'web' })).toHaveAttribute(
      'href',
      'https://www.farnostsalvator.cz',
    )
  })

  it('without permission: explains and offers the unified search fallback', async () => {
    stubGeolocation('denied')
    render(<App />)
    expect(await screen.findByText('Bez přístupu k poloze')).toBeInTheDocument()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // diacritics-insensitive: "brno" (lowercase, no diacritics) finds Brno
    await user.type(screen.getByLabelText('Kostel nebo obec'), 'brno')
    await user.click(await screen.findByRole('option', { name: /^Brno/ }))

    expect(await screen.findByText(/sv\. Tomáše/)).toBeInTheDocument()
    // the list header names the chosen city
    expect(screen.getByRole('button', { name: 'změnit' })).toBeInTheDocument()
  })

  it('"moje poloha": after a city pick, clears the override and returns to geolocation', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText(/Salvátora/)

    await user.click(screen.getByRole('button', { name: 'změnit' }))
    await user.type(screen.getByLabelText('Kostel nebo obec'), 'brno')
    await user.click(await screen.findByRole('option', { name: /^Brno/ }))
    expect(await screen.findByText(/sv\. Tomáše/)).toBeInTheDocument()
    // the pick is saved as the last-position override…
    expect(JSON.parse(localStorage.getItem('bohosluzby:lastOrigin')!)).toMatchObject({
      label: 'Brno',
    })

    // …and "moje poloha" is the way back: re-runs geolocation, drops the override
    expect(window.location.pathname).toBe('/mesto/brno/') // the pick was history-pushed
    await user.click(screen.getByRole('button', { name: 'moje poloha' }))
    expect(window.location.pathname).toBe('/') // "/" = my location
    expect(await screen.findByText(/Salvátora/)).toBeInTheDocument()
    expect(screen.getByText(/podle vaší polohy/)).toBeInTheDocument()
    // with a live geolocation origin the affordance is gone
    expect(screen.queryByRole('button', { name: 'moje poloha' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('bohosluzby:lastOrigin')!).label).toBeUndefined()
  })

  it('URL routing: ?den=nedele bookmark restores the Sunday ordo; day picks write the URL', async () => {
    stubGeolocation('granted')
    window.history.pushState(null, '', '/?den=nedele')
    render(<App />)
    // NOW is Friday 3 Jul → "neděle" is Sunday 5 Jul, restored from the URL
    expect(await screen.findByText('neděle 5. 7.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^neděle/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/^za \d/)).not.toBeInTheDocument() // planning view, no countdowns

    // switching the day rewrites the query param (replace — no history spam)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'zítra' }))
    expect(window.location.search).toBe('?den=zitra')
    await user.click(screen.getByRole('button', { name: 'hned' }))
    expect(window.location.search).toBe('')
    expect(await screen.findByText(/^za (1 h|59 min)$/)).toBeInTheDocument()
  })

  it('URL routing: opening a detail keeps ?den, zpět restores the day view', async () => {
    stubGeolocation('granted')
    window.history.pushState(null, '', '/?den=nedele')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText('neděle 5. 7.')

    await user.click(screen.getAllByText('kostel Nejsvětějšího Salvátora')[0]) // two Sunday masses
    expect(window.location.pathname + window.location.search).toBe('/kostel/1/?den=nedele')
    await user.click(await screen.findByRole('button', { name: '‹ zpět na seznam' }))
    expect(window.location.pathname + window.location.search).toBe('/?den=nedele')
    expect(await screen.findByText('neděle 5. 7.')).toBeInTheDocument()
  })

  it('unified search: finds a specific church by name and opens its detail (keyboard)', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText(/Salvátora/)

    // "změnit" opens the search without destroying the origin
    await user.click(screen.getByRole('button', { name: 'změnit' }))
    const input = screen.getByLabelText('Kostel nebo obec')
    await user.type(input, 'havla') // diacritics-insensitive church-name match
    expect(await screen.findByRole('option', { name: /sv\. Havla/ })).toBeInTheDocument()
    await user.keyboard('{Enter}') // top result via keyboard
    expect(window.location.pathname).toBe('/kostel/2/')
    expect(await screen.findByRole('heading', { name: 'kostel sv. Havla' })).toBeInTheDocument()
  })

  it('search panel: zpět (and Escape) return to the list with the origin intact', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText(/Salvátora/)

    await user.click(screen.getByRole('button', { name: 'změnit' }))
    expect(screen.queryByText(/Salvátora/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '‹ zpět na seznam' }))
    // the list is back instantly — no new geolocation prompt, same origin
    expect(await screen.findByText(/Salvátora/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'změnit' }))
    await user.keyboard('{Escape}')
    expect(await screen.findByText(/Salvátora/)).toBeInTheDocument()
  })

  it('opens a church detail: full weekly ordo, extras, parish, freshness', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    await user.click(await screen.findByText('kostel Nejsvětějšího Salvátora'))
    expect(window.location.pathname).toBe('/kostel/1/')

    // weekly schedule grouped by day, Sunday first (printed-ordo order)
    const ordo = await screen.findByLabelText('Pořad bohoslužeb')
    expect(ordo).toHaveTextContent('neděle')
    expect(ordo).toHaveTextContent('pátek')
    const dayHeads = within(ordo).getAllByRole('heading', { level: 4 })
    expect(dayHeads.map((h) => h.textContent)).toEqual(['neděle', 'pátek'])
    // Sunday's two masses sorted by time
    expect(ordo).toHaveTextContent(/14:00.*20:00/s)
    expect(within(ordo).getByText(/studentská/)).toBeInTheDocument()

    // one-off services in their own rubric section; past one-offs hidden
    const extra = screen.getByLabelText('Mimořádné bohoslužby')
    expect(extra).toHaveTextContent('5. 7. 2026')
    expect(extra).toHaveTextContent('pobožnost')
    expect(extra).not.toHaveTextContent('Tři králové')

    // parish + contacts
    const parish = screen.getByLabelText('Farnost')
    expect(parish).toHaveTextContent('Akademická farnost Praha')
    expect(parish).toHaveTextContent('Křižovnické nám. 4, Praha 1')
    expect(within(parish).getByRole('link', { name: 'farnostsalvator.cz' })).toHaveAttribute(
      'href',
      'https://www.farnostsalvator.cz',
    )
    expect(within(parish).getByRole('link', { name: '222 221 339' })).toHaveAttribute(
      'href',
      'tel:+420222221339',
    )

    // maps link + data freshness (honest about staleness)
    expect(screen.getByRole('link', { name: 'mapa' })).toHaveAttribute(
      'href',
      expect.stringContaining('mapy.cz'),
    )
    expect(screen.getByText(/naposledy ověřeno 1\. 6\. 2026/)).toBeInTheDocument()

    // back returns to the list
    await user.click(screen.getByRole('button', { name: '‹ zpět na seznam' }))
    expect(await screen.findByText('kostel sv. Havla')).toBeInTheDocument()
  })

  it('renders a church detail from a direct URL (share link)', async () => {
    stubGeolocation('denied')
    window.history.pushState(null, '', '/kostel/2/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'kostel sv. Havla' })).toBeInTheDocument()
    expect(await screen.findByText('19:30')).toBeInTheDocument()
    expect(screen.getByText('latinsky')).toBeInTheDocument()
  })

  it('unknown church id explains itself', async () => {
    stubGeolocation('denied')
    window.history.pushState(null, '', '/kostel/nope/')
    render(<App />)
    expect(await screen.findByText('Kostel nenalezen')).toBeInTheDocument()
  })

  it('detail: "do kalendáře" downloads a weekly VEVENT; "sdílet" copies the link', async () => {
    stubGeolocation('denied')
    window.history.pushState(null, '', '/kostel/1/')
    // jsdom ships a real navigator.clipboard; spy on it rather than replace it
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:ics')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      const icsButtons = await screen.findAllByRole('button', { name: 'do kalendáře' })
      await user.click(icsButtons[0])
      expect(click).toHaveBeenCalled()
      const blob = createObjectURL.mock.calls[0]![0]
      const ics = await blob.text()
      expect(ics).toContain('RRULE:FREQ=WEEKLY')
      expect(ics).toContain('DTSTART;TZID=Europe/Prague:')

      await user.click(screen.getByRole('button', { name: 'sdílet' }))
      expect(writeText).toHaveBeenCalledWith('http://localhost/kostel/1/')
      expect(await screen.findByText('odkaz zkopírován')).toBeInTheDocument()
    } finally {
      click.mockRestore()
      writeText.mockRestore()
    }
  })

  it('filters: "jen mše svaté" falls back to the church\'s next matching service', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    // Havel's earliest service today is the 19:00 rosary
    expect(await screen.findByText(/růženec/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'jen mše svaté' }))
    // …with the mass filter on, Havel shows its 19:30 mass instead of vanishing
    expect(screen.queryByText(/růženec/)).not.toBeInTheDocument()
    expect(seznam().getByText('19:30')).toBeInTheDocument()
    expect(screen.getByText(/sv\. Havla/)).toBeInTheDocument()
  })

  it('filters: language + barrier-free narrow the list; persisted in localStorage', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = render(<App />)
    await screen.findByText(/Salvátora/)

    await user.selectOptions(screen.getByLabelText('Jazyk bohoslužby'), 'latinsky')
    expect(screen.queryByText(/Salvátora/)).not.toBeInTheDocument()
    expect(screen.getByText(/sv\. Havla/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Jazyk bohoslužby'), '')
    await user.click(screen.getByRole('button', { name: 'bezbariérové' }))
    expect(screen.getByText(/Salvátora/)).toBeInTheDocument()
    expect(screen.queryByText(/sv\. Havla/)).not.toBeInTheDocument()

    // persisted: a fresh mount starts with the same filter
    expect(JSON.parse(localStorage.getItem('bohosluzby:filters')!)).toMatchObject({
      barrierFree: true,
    })
    unmount()
    render(<App />)
    await screen.findByText(/Salvátora/)
    expect(screen.queryByText(/sv\. Havla/)).not.toBeInTheDocument()
  })

  it('filters: an over-narrow filter explains itself and offers a reset', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText(/Salvátora/)

    await user.click(screen.getByRole('button', { name: 'řeckokatolické' })) // none nearby
    expect(screen.getByText(/neodpovídá žádná bohoslužba/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zrušit filtry' }))
    expect(await screen.findByText(/Salvátora/)).toBeInTheDocument()
  })

  it('kdy filter: bands write ?cas=, fall back to the next matching service, compose with ?den', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText(/Salvátora/)

    // večer: Salvátor's 18:00 stays
    await user.click(screen.getByRole('button', { name: 'večer' }))
    expect(window.location.search).toBe('?cas=vecer')
    expect(seznam().getByText('18:00')).toBeInTheDocument()

    // dopoledne is over on a Friday 17:00: the chip is muted and picking it
    // jumps honestly to zítra (URL + day chip follow) — never a lying "hned"
    const dopoledne = screen.getByRole('button', { name: 'dopoledne' })
    expect(dopoledne).toHaveClass('opacity-40')
    expect(dopoledne).toHaveAttribute('title', 'dnes už proběhlo — přepne na zítra')
    await user.click(dopoledne)
    expect(window.location.search).toBe('?cas=dopoledne&den=zitra')
    expect(screen.getByRole('button', { name: 'zítra' })).toHaveAttribute('aria-pressed', 'true')
    // Saturday has no 10–13 service nearby → an honest, explained empty state
    expect(screen.getByText(/neodpovídá žádná bohoslužba/)).toBeInTheDocument()

    // sticky like the other filters
    expect(localStorage.getItem('bohosluzby:cas')).toBe('dopoledne')

    // composes with the day: v neděli kolem 9:00 → only Havel's 10:00 (±90 min)
    await user.click(screen.getByRole('button', { name: /^neděle/ }))
    fireEvent.change(screen.getByLabelText('Kolem času'), { target: { value: '09:00' } })
    expect(window.location.search).toBe('?cas=09:00&den=nedele')
    expect(seznam().getAllByText('10:00').length).toBeGreaterThan(0)
    expect(seznam().queryByText('14:00')).not.toBeInTheDocument() // Salvátor Sunday, outside ±90

    // toggle off clears the param and the sticky value
    await user.click(screen.getByRole('button', { name: 'hned' }))
    fireEvent.change(screen.getByLabelText('Kolem času'), { target: { value: '' } })
    expect(window.location.search).toBe('')
    expect(localStorage.getItem('bohosluzby:cas')).toBeNull()
  })

  it('day picker: "neděle" shows the full Sunday ordo without countdowns', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText(/Salvátora/)

    // now = Friday → the picker offers hned · dnes · zítra · neděle · po …
    await user.click(screen.getByRole('button', { name: /^neděle/ }))

    // Salvátor's two Sunday masses, chronological, grouped under one day rubric
    expect(screen.getByText('neděle 5. 7.')).toBeInTheDocument()
    expect(seznam().getByText('14:00')).toBeInTheDocument()
    expect(seznam().getByText('20:00')).toBeInTheDocument()
    // the Sunday one-off pobožnost appears in its day
    expect(screen.getByText(/pobožnost/)).toBeInTheDocument()
    // Friday's services are not in the Sunday ordo
    expect(screen.queryByText(/růženec/)).not.toBeInTheDocument()
    // planning view: no "za X min" countdowns
    expect(screen.queryByText(/^za \d/)).not.toBeInTheDocument()

    // back to "hned" — the reachable-now ranking returns
    await user.click(screen.getByRole('button', { name: 'hned' }))
    expect(await screen.findByText(/^za (1 h|59 min)$/)).toBeInTheDocument()
  })

  it('rows with an empty service type render no dangling separator', async () => {
    // registry rows often omit the type — "Olomouc · 200 m · " looked broken
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText(/Salvátora/)
    await user.click(screen.getByRole('button', { name: /^neděle/ })) // 14:00 has no type
    expect(seznam().getByText('14:00')).toBeInTheDocument()
    const metas = document.querySelectorAll('ol .group p.text-sm')
    expect(metas.length).toBeGreaterThan(0)
    for (const m of metas) expect(m.textContent).not.toMatch(/·\s*$/)
  })

  it('feasts: Sunday 5 Jul (Cyril a Metoděj) is highlighted in the picker and named in the header', async () => {
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText(/Salvátora/)

    // picker chip carries the feast (tooltip + accessible name + gold tint)
    const sunday = screen.getByRole('button', { name: /neděle — sv\. Cyrila a Metoděje/ })
    expect(sunday).toHaveAttribute('title', 'sv. Cyrila a Metoděje')
    expect(sunday.style.color).toBe('var(--color-season-gold)')

    // no feast line while an ordinary day is selected (today is 3 Jul)
    expect(screen.queryByText('sv. Cyrila a Metoděje')).not.toBeInTheDocument()
    await user.click(sunday)
    expect(screen.getByText('sv. Cyrila a Metoděje')).toBeInTheDocument()
  })

  it('notes: July exceptions exclude the service; unverifiable notes stay and print loud', async () => {
    stubGeolocation('granted')
    render(<App />)
    await screen.findByText(/Salvátora/)

    // kaple sv. Anny: 20:00 "kromě července a srpna" must NOT appear on 3 July…
    expect(seznam().queryByText('20:00')).not.toBeInTheDocument()
    // …its 21:00 with an unparseable conditional note appears, note set as warning rubric
    expect(seznam().getByText('21:00')).toBeInTheDocument()
    const note = screen.getByText(/nepravidelně, dle ohlášení/)
    expect(note).toHaveClass('text-rubric')
    // parsed/descriptive notes stay quiet (Salvátor's Sunday studentská in the ordo)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: /^neděle/ }))
    expect(screen.getByText(/studentská/)).not.toHaveClass('text-rubric')
  })

  it('day picker: switching to a day ordo and back to "hned" leaves no phantom rows', async () => {
    // The ordo can contain two rows with the same (church, start) — sv. Havla's
    // duplicated Sunday 10:00. With non-unique React keys the next render left
    // stale rows from the previous view in the list (past masses on "hned").
    stubGeolocation('granted')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await screen.findByText(/Salvátora/)

    await user.click(screen.getByRole('button', { name: /^neděle/ }))
    expect(seznam().getAllByText('10:00')).toHaveLength(2) // both Sunday variants listed

    await user.click(screen.getByRole('button', { name: 'hned' }))
    // "hned" on Friday 17:00: Havel's best is today 19:00 — no Sunday 10:00 row may survive
    expect(seznam().queryByText('10:00')).not.toBeInTheDocument()
    // and the reachable-now list is intact (one row per church, countdown present)
    expect(screen.getByText(/^za (1 h|59 min)$/)).toBeInTheDocument()
  })

  it('falls back to the last known position when geolocation fails', async () => {
    stubGeolocation('denied')
    localStorage.setItem('bohosluzby:lastOrigin', JSON.stringify({ lat: 50.0875, lng: 14.4213 }))
    render(<App />)
    expect(await screen.findByText('kostel Nejsvětějšího Salvátora')).toBeInTheDocument()
    expect(screen.getByText(/poslední známá poloha/)).toBeInTheDocument()
    expect(screen.queryByText('Bez přístupu k poloze')).not.toBeInTheDocument()
  })

  it('remembers a granted position for the next visit', async () => {
    stubGeolocation('granted')
    render(<App />)
    await screen.findByText('kostel Nejsvětějšího Salvátora')
    expect(JSON.parse(localStorage.getItem('bohosluzby:lastOrigin')!)).toMatchObject({
      lat: 50.0875,
      lng: 14.4213,
    })
  })

  it('shows a quiet offline indicator in the footer', async () => {
    stubGeolocation('granted')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<App />)
    expect(await screen.findByText('offline — zobrazuji uložená data')).toBeInTheDocument()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('city landing (/mesto/praha/): list from the city centroid, no geolocation prompt', async () => {
    const getCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    })
    window.history.pushState(null, '', '/mesto/praha/')
    render(<App />)
    expect(await screen.findByText('kostel Nejsvětějšího Salvátora')).toBeInTheDocument()
    // list header names the city
    expect(screen.getByRole('button', { name: 'změnit' }).parentElement).toHaveTextContent(/^Praha ·/)
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(document.title).toContain('Bohoslužby Praha')
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
    expect(screen.getByLabelText('Kostel nebo obec')).toBeInTheDocument()
  })
})

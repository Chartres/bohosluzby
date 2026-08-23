// First-run intro guide: shown once, re-openable, forceable with ?intro=1.
// Driven through <App /> so the trigger + the introSeen flag are exercised end
// to end (the guide overlays before any data loads, so no async wait is needed).
import { vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: null }))
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import type { IndexRow } from './domain/data'

const INDEX: IndexRow[] = [['1', 'kostel sv. Havla', 'Praha 1', 50.086, 14.417, 0, '50-14']]

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url)
      const body = path.endsWith('/data/churches.json')
        ? INDEX
        : path.endsWith('/data/version.json')
          ? { generated: '2026-07-03', churches: INDEX.length }
          : null
      return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('x', { status: 404 })
    }),
  )
}

const INTRO_SEEN_KEY = 'bohosluzby:introSeen'
const dialog = () => screen.queryByRole('dialog')

beforeEach(() => {
  localStorage.clear()
  stubFetch()
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition: vi.fn() },
    configurable: true,
  })
  window.history.replaceState(null, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

describe('first-run intro guide', () => {
  it('shows on first run when the flag is absent', () => {
    render(<App />)
    expect(dialog()).toBeInTheDocument()
  })

  it('does not show when the flag is already set', () => {
    localStorage.setItem(INTRO_SEEN_KEY, '1')
    render(<App />)
    expect(dialog()).toBeNull()
  })

  it('skip closes it and sets the flag', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Přeskočit' }))
    expect(dialog()).toBeNull()
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('1')
  })

  it('?intro=1 forces it even when the flag is set', () => {
    localStorage.setItem(INTRO_SEEN_KEY, '1')
    window.history.replaceState(null, '', '/?intro=1')
    render(<App />)
    expect(dialog()).toBeInTheDocument()
  })

  it('the colour card names at least one liturgical season', () => {
    render(<App />)
    // page to the "Barva podle dne" card (now card 4/5: find-mass, chip, list/map, colour)
    fireEvent.click(screen.getByRole('button', { name: 'Další' }))
    fireEvent.click(screen.getByRole('button', { name: 'Další' }))
    fireEvent.click(screen.getByRole('button', { name: 'Další' }))
    expect(within(dialog()!).getByText(/mezidobí/)).toBeInTheDocument()
  })

  it('a card explains the coloured-vs-grey map chip', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Další' })) // card 2: the chip
    expect(within(dialog()!).getByText(/vyhovuje vašemu výběru/i)).toBeInTheDocument()
  })
})

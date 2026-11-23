// The app's wiring of the what's-new kit (src/platform/whats-new.ts): which release file,
// who counts as returning, and where the sheet never mounts (inside a frame, ?intro=1).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startWhatsNew, wasHereBefore } from './whatsNew'
import cs from '../whats-new.json'
import en from '../whats-new.en.json'

const setLang = (l: string) => Object.defineProperty(window.navigator, 'language', { value: l, configurable: true })

afterEach(() => {
  setLang('cs-CZ')
  document.body.innerHTML = ''
  document.getElementById('fw-wn-css')?.remove()
})

describe('wasHereBefore', () => {
  it('is the intro-seen flag: a returning reader closed the first-run guide', () => {
    expect(wasHereBefore(localStorage)).toBe(false)
    localStorage.setItem('bohosluzby:introSeen', '1')
    expect(wasHereBefore(localStorage)).toBe(true)
  })
  it('blocked storage: not returning', () => {
    const blocked = { getItem: () => { throw new Error('denied') } } as unknown as Storage
    expect(wasHereBefore(blocked)).toBe(false)
  })
})

describe('startWhatsNew', () => {
  // 1.6's only item (the roráty pill) waits for 28 Nov 2026, the day the pill appears
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-28T08:00:00+01:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('before the roráty pill is in the row: no sheet, and nothing recorded, so it comes on the day', () => {
    vi.setSystemTime(new Date('2026-11-23T20:00:00+01:00'))
    expect(startWhatsNew({ track: () => {}, returning: true })).toBe(false)
    expect(localStorage.getItem('fw:whats-new')).toBeNull()
  })

  it('a returning reader without fw:whats-new sees the Czech sheet once, and it is tracked', () => {
    const track = vi.fn()
    expect(startWhatsNew({ track, returning: true })).toBe(true)
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Co je nového')
    expect(document.querySelectorAll('.fw-wn li')).toHaveLength(cs.items.length)
    expect(document.querySelector('.fw-wn iframe')?.getAttribute('src')).toBe(cs.items[0].media)
    expect(document.querySelector('[data-whats-new-close]')?.textContent).toBe('Rozumím')
    expect(track).toHaveBeenCalledWith('whats_new_seen', { version: cs.version, items: cs.items.length })
  })

  it('English device: the English file and labels', () => {
    setLang('en-GB')
    startWhatsNew({ track: () => {}, returning: true })
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe("What's new")
    expect(document.querySelector('.fw-wn p')?.textContent).toBe(en.items[0].text)
    expect(document.querySelector('[data-whats-new-close]')?.textContent).toBe('Got it')
  })

  it('a first-ever visitor sees nothing', () => {
    expect(startWhatsNew({ track: () => {}, returning: false })).toBe(false)
    expect(document.querySelector('.fw-wn')).toBeNull()
  })

  it('never inside a frame (a parish site embedding the app)', () => {
    expect(startWhatsNew({ track: () => {}, returning: true, framed: true })).toBe(false)
    expect(document.querySelector('.fw-wn')).toBeNull()
    expect(localStorage.getItem('fw:whats-new')).toBeNull()
  })

  it('not on top of the forced intro guide (?intro=1)', () => {
    window.history.replaceState(null, '', '/?intro=1')
    expect(startWhatsNew({ track: () => {}, returning: true })).toBe(false)
  })

  it('both release files carry the same version', () => {
    expect(en.version).toBe(cs.version)
  })
})

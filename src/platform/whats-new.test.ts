// @vitest-environment jsdom
// The what's-new kit (docs/standards/whats-new.md). Products vendor whats-new.ts and this test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decide, isNewer, mountWhatsNew, WHATS_NEW_KEY, type WhatsNewRelease } from './whats-new'

const release: WhatsNewRelease = {
  version: '1.6.0',
  changelog: '/changelog/',
  items: [
    { id: 'a', text: 'Date links open the map on that day.', media: '/whats-new/1.6.0/a.webp', still: '/whats-new/1.6.0/a.png', alt: 'The map jumping to 1985', width: 390, height: 300 },
    { id: 'b', text: 'The correction log is in Czech too.', media: '/whats-new/1.6.0/b.mp4', still: '/whats-new/1.6.0/b.png', alt: 'Correction log in Czech' },
    { id: 'c', text: 'Copy link sends a shorter address.', alt: 'Copy link button' },
    { id: 'd', text: 'A fourth item never shows.', alt: 'x' },
  ],
}

function memoryStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

beforeEach(() => {
  document.body.innerHTML = ''
})
afterEach(() => vi.restoreAllMocks())

describe('decide', () => {
  it('first-ever visit: nothing shown, the version is remembered', () => {
    const s = memoryStorage()
    expect(decide(s, '1.6.0')).toBe('first-visit')
    expect(s.getItem(WHATS_NEW_KEY)).toBe('1.6.0')
  })
  it('no stored version but a returning reader (the product knows from its own storage): show', () => {
    const s = memoryStorage()
    expect(decide(s, '1.6.0', { returning: true })).toBe('show')
    expect(s.getItem(WHATS_NEW_KEY)).toBe('1.6.0')
    expect(decide(s, '1.6.0', { returning: true })).toBe('seen')
  })
  it('same version again: nothing shown', () => {
    expect(decide(memoryStorage({ [WHATS_NEW_KEY]: '1.6.0' }), '1.6.0')).toBe('seen')
  })
  it('a new version since the last open: show', () => {
    expect(decide(memoryStorage({ [WHATS_NEW_KEY]: '1.5.0' }), '1.6.0')).toBe('show')
  })
  it('a rollback to an older version shows nothing (only a newer version shows the sheet)', () => {
    expect(decide(memoryStorage({ [WHATS_NEW_KEY]: '1.6.0' }), '1.5.2')).toBe('seen')
    expect(isNewer('1.10.0', '1.9.3')).toBe(true)
    expect(isNewer('2.0.0', '2.0.0')).toBe(false)
    expect(isNewer('1.6.0-beta', '1.5.0')).toBe(true)
  })
  it('storage that throws (private mode) never shows and never crashes', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(decide(broken, '1.6.0')).toBe('seen')
  })
})

describe('mountWhatsNew', () => {
  const opts = (over = {}) => ({ release, storage: memoryStorage({ [WHATS_NEW_KEY]: '1.5.0' }), track: vi.fn(), reducedMotion: false, ...over })

  it('shows a dialog with at most three items, each one sentence with its animation, and an all-changes link', () => {
    const o = opts()
    const r = mountWhatsNew(o)
    expect(r.shown).toBe(true)
    const dlg = document.querySelector('[role="dialog"]')!
    expect(dlg.getAttribute('aria-modal')).toBe('true')
    expect(dlg.querySelectorAll('li')).toHaveLength(3)
    expect(dlg.textContent).toContain('Date links open the map on that day.')
    expect(dlg.textContent).not.toContain('fourth')
    const img = dlg.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/whats-new/1.6.0/a.webp')
    expect(img.getAttribute('alt')).toBe('The map jumping to 1985')
    expect(img.getAttribute('width')).toBe('390')
    const video = dlg.querySelector('video')!
    expect(video.muted).toBe(true)
    expect(video.hasAttribute('autoplay') && video.hasAttribute('loop') && video.hasAttribute('playsinline')).toBe(true)
    expect((dlg.querySelector('a') as HTMLAnchorElement).getAttribute('href')).toBe('/changelog/')
    expect(o.track).toHaveBeenCalledWith('whats_new_seen', { version: '1.6.0', items: 3 })
    expect(o.storage.getItem(WHATS_NEW_KEY)).toBe('1.6.0')
  })

  it('one tap closes it, records the dismissal, and focus starts on that button', () => {
    const o = opts()
    mountWhatsNew(o)
    const ok = document.querySelector('[data-whats-new-close]') as HTMLButtonElement
    expect(document.activeElement).toBe(ok)
    ok.click()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(o.track).toHaveBeenCalledWith('whats_new_dismissed', { version: '1.6.0', via: 'button' })
  })

  it('Escape and the backdrop close it too', () => {
    const o = opts()
    mountWhatsNew(o)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(o.track).toHaveBeenLastCalledWith('whats_new_dismissed', { version: '1.6.0', via: 'escape' })
  })

  it('reduced motion shows the still frame, never the animation', () => {
    mountWhatsNew(opts({ reducedMotion: true }))
    const dlg = document.querySelector('[role="dialog"]')!
    expect(dlg.querySelector('video')).toBeNull()
    expect([...dlg.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual(['/whats-new/1.6.0/a.png', '/whats-new/1.6.0/b.png'])
  })

  it('nothing on a first-ever visit, nothing twice for the same version', () => {
    const fresh = opts({ storage: memoryStorage() })
    expect(mountWhatsNew(fresh).shown).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(fresh.track).not.toHaveBeenCalled()
    const again = opts({ storage: memoryStorage({ [WHATS_NEW_KEY]: '1.6.0' }) })
    expect(mountWhatsNew(again).shown).toBe(false)
  })

  it('a release with no items shows nothing but still records the version', () => {
    const o = opts({ release: { version: '1.6.1', items: [] } })
    expect(mountWhatsNew(o).shown).toBe(false)
    expect(o.storage.getItem(WHATS_NEW_KEY)).toBe('1.6.1')
  })

  it('labels follow the product language', () => {
    mountWhatsNew(opts({ labels: { title: 'Co je nového', close: 'Rozumím', all: 'Všechny změny' } }))
    const dlg = document.querySelector('[role="dialog"]')!
    expect(dlg.textContent).toContain('Co je nového')
    expect(dlg.textContent).toContain('Všechny změny')
    expect(document.querySelector('[data-whats-new-close]')!.textContent).toBe('Rozumím')
  })

  it('text is set as text, never parsed as HTML', () => {
    mountWhatsNew(opts({ release: { version: '2.0.0', items: [{ id: 'x', text: '<img src=x onerror=alert(1)>', alt: 'x' }] } }))
    expect(document.querySelector('[role="dialog"] li img')).toBeNull()
  })

  it('blocked site data: reading window.localStorage throws, and nothing is shown', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(mountWhatsNew({ release, track: vi.fn() }).shown).toBe(false)
    spy.mockRestore()
  })

  it('a real modal: the page behind is inert while open, Tab stays inside, and both are undone on close', () => {
    const page = document.createElement('main')
    page.innerHTML = '<a href="#x">behind</a>'
    document.body.appendChild(page)
    mountWhatsNew(opts())
    expect(page.hasAttribute('inert')).toBe(true)
    const link = document.querySelector('.fw-wn a') as HTMLAnchorElement
    const ok = document.querySelector('[data-whats-new-close]') as HTMLButtonElement
    ok.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(link)
    link.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(ok)
    ok.click()
    expect(page.hasAttribute('inert')).toBe(false)
  })

  it('an unsafe changelog URL is dropped', () => {
    mountWhatsNew(opts({ release: { ...release, changelog: 'javascript:alert(1)' } }))
    expect(document.querySelector('.fw-wn a')).toBeNull()
  })

  it('Escape that something else already handled is left alone', () => {
    const o = opts()
    mountWhatsNew(o)
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    e.preventDefault()
    document.dispatchEvent(e)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('an .html animation plays in a sandboxed frame: no scripts, no same-origin, not a Tab stop', () => {
    const r: WhatsNewRelease = { version: '1.6.0', items: [{ id: 'h', text: 'Date links open that day.', media: '/whats-new/1.6.0/h.html', alt: 'The map moving to 1985', width: 390, height: 240 }] }
    mountWhatsNew(opts({ release: r }))
    const f = document.querySelector('[role="dialog"] iframe')!
    expect(f.getAttribute('src')).toBe('/whats-new/1.6.0/h.html')
    expect(f.getAttribute('sandbox')).toBe('') // the strictest sandbox: CSS animation only
    expect(f.getAttribute('title')).toBe('The map moving to 1985')
    expect(f.getAttribute('tabindex')).toBe('-1')
    expect((f as HTMLElement).style.aspectRatio).toBe('390 / 240')
  })

  it('an .html animation from another origin is never framed', () => {
    const r: WhatsNewRelease = { version: '1.6.0', items: [{ id: 'h', text: 'x.', media: 'https://example.org/h.html', alt: 'x' }] }
    mountWhatsNew(opts({ release: r }))
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.querySelector('[role="dialog"] img')).toBeNull()
    expect(document.querySelector('[role="dialog"] p')!.textContent).toBe('x.')
  })

  it('reduced motion: an .html animation keeps its frame (its own CSS stops the motion) unless a still is given', () => {
    const r: WhatsNewRelease = { version: '1.6.0', items: [
      { id: 'h', text: 'a.', media: '/w/h.html', alt: 'a' },
      { id: 'k', text: 'b.', media: '/w/k.html', still: '/w/k.png', alt: 'b' },
    ] }
    mountWhatsNew(opts({ release: r, reducedMotion: true }))
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
    expect(document.querySelector('[data-id="k"] img')!.getAttribute('src')).toBe('/w/k.png')
  })

  it('the video carries the muted attribute too (iOS autoplay checks it)', () => {
    mountWhatsNew(opts())
    expect(document.querySelector('video')!.hasAttribute('muted')).toBe(true)
  })
})

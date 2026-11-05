// What's new: a light sheet on the first open after a version change (docs/standards/whats-new.md).
// Framework-free and dependency-free; products vendor this file and whats-new.test.ts, the way
// they vendor flywheel-client.ts. Shown once per version, never on a first-ever visit, three
// items at most, one tap to close. Reduced motion shows each item's still frame. An .html
// animation (CSS keyframes, a few KB) plays in a sandboxed frame and stops itself under
// prefers-reduced-motion (scripts/check-whats-new.mjs checks the file).
//
//   import release from '../whats-new.json'
//   import { mountWhatsNew } from './platform/whats-new'
//   import { track } from './platform/flywheel-client'
//   mountWhatsNew({ release, track })          // after the first paint

export type WhatsNewItem = {
  id: string
  /** one sentence, in the product's own voice */
  text: string
  /** looping animation: .html (preferred: CSS only, sandboxed frame), .webp / .gif (img) or .mp4 / .webm (muted video) */
  media?: string
  /** still frame for reduced motion (png/webp) */
  still?: string
  alt: string
  width?: number
  height?: number
}
export type WhatsNewRelease = { version: string; date?: string; items: WhatsNewItem[]; changelog?: string }
export type Labels = { title: string; close: string; all: string }
type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void }
type Track = (event: 'whats_new_seen' | 'whats_new_dismissed', props: Record<string, unknown>) => void

export const WHATS_NEW_KEY = 'fw:whats-new'
export const MAX_ITEMS = 3
const DEFAULT_LABELS: Labels = { title: "What's new", close: 'Got it', all: 'All changes' }

/** a > b, comparing dotted numbers (1.10.0 > 1.9.3); a pre-release suffix is ignored. */
export function isNewer(a: string, b: string): boolean {
  const n = (v: string) => v.split(/[.+-]/).map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x))
  const [x, y] = [n(a), n(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  }
  return false
}

/**
 * first-visit: remember the version, show nothing. show: a newer version since the last open.
 * Showing records the version, so the sheet appears once even if the reader never taps.
 */
export function decide(storage: StorageLike, version: string, { returning = false } = {}): 'first-visit' | 'show' | 'seen' {
  try {
    const last = storage.getItem(WHATS_NEW_KEY)
    if (last === version) return 'seen'
    storage.setItem(WHATS_NEW_KEY, version)
    // no stored version: a new reader, unless the product knows from its own storage that
    // this person used the app before the sheet existed (the first release that ships it)
    if (last === null) return returning ? 'show' : 'first-visit'
    return isNewer(version, last) ? 'show' : 'seen' // a rollback shows nothing
  } catch {
    return 'seen' // storage blocked: never nag
  }
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null // throws when site data is blocked
  } catch {
    return null
  }
}

const safeHref = (u: string) => /^(https?:\/\/|\/(?!\/))/i.test(u)
const FOCUSABLE = 'a[href],button:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])'

const isVideo = (src: string) => /\.(mp4|webm)(\?|$)/i.test(src)
const isHtml = (src: string) => /\.html?(\?|#|$)/i.test(src)
const sameSite = (src: string) => /^\/(?!\/)/.test(src)

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  if (text !== undefined) e.textContent = text
  return e
}

function mediaFor(item: WhatsNewItem, reducedMotion: boolean): HTMLElement | null {
  const size: Record<string, string> = {}
  if (item.width) size.width = String(item.width)
  if (item.height) size.height = String(item.height)
  // an .html animation stops itself under reduced motion, so it stays unless a still is given
  if (item.media && isHtml(item.media) && !(reducedMotion && item.still)) {
    if (!sameSite(item.media)) return null // never frame another origin
    const f = el('iframe', { src: item.media, sandbox: '', title: item.alt, tabindex: '-1', loading: 'lazy', ...size })
    f.style.aspectRatio = `${item.width ?? 390} / ${item.height ?? 240}`
    return f
  }
  const src = reducedMotion ? item.still : item.media ?? item.still
  if (!src) return null
  if (!reducedMotion && isVideo(src)) {
    const v = el('video', { src, autoplay: '', loop: '', muted: '', playsinline: '', 'aria-label': item.alt, ...size })
    v.muted = true
    return v
  }
  return el('img', { src, alt: item.alt, decoding: 'async', ...size })
}

const CSS = `
.fw-wn-backdrop{position:fixed;inset:0;background:rgb(0 0 0/.35);display:flex;align-items:flex-end;justify-content:center;z-index:2147483000}
.fw-wn{background:var(--paper,#fff);color:var(--ink,#1c1a17);width:min(420px,100%);max-height:88dvh;overflow:auto;border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -4px 24px rgb(0 0 0/.15);font:inherit}
.fw-wn h2{margin:0 0 8px;font-size:1.2rem}
.fw-wn ol{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.fw-wn iframe{display:block;width:100%;height:auto;border:1px solid rgb(0 0 0/.12);border-radius:10px;background:transparent}
.fw-wn img,.fw-wn video{display:block;width:100%;height:auto;max-height:42dvh;object-fit:cover;object-position:top;border-radius:10px;border:1px solid rgb(0 0 0/.12);background:rgb(0 0 0/.05)}
.fw-wn p{margin:6px 0 0;line-height:1.4}
.fw-wn footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}
.fw-wn a{min-height:44px;display:inline-flex;align-items:center}
.fw-wn button{min-height:44px;min-width:44px;padding:0 20px;border-radius:22px;border:0;background:var(--accent,#1f4e4a);color:#fff;font:inherit;cursor:pointer}
@media (min-width:640px){.fw-wn-backdrop{align-items:center}.fw-wn{border-radius:16px}}`

export function mountWhatsNew({
  release,
  storage = defaultStorage() as StorageLike,
  track = () => {},
  reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  labels = DEFAULT_LABELS,
  returning = false,
  root = typeof document !== 'undefined' ? document.body : (null as unknown as HTMLElement),
}: {
  release: WhatsNewRelease
  storage?: StorageLike | null
  track?: Track
  reducedMotion?: boolean
  labels?: Labels
  /** true when the product's own storage shows an earlier visit (see decide) */
  returning?: boolean
  root?: HTMLElement
}): { shown: boolean; close: () => void } {
  const noop = { shown: false, close: () => {} }
  if (!storage || !root) return noop
  if (decide(storage, release.version, { returning }) !== 'show') return noop
  const items = release.items.slice(0, MAX_ITEMS)
  if (!items.length) return noop

  if (!document.getElementById('fw-wn-css')) document.head.appendChild(el('style', { id: 'fw-wn-css' }, CSS))
  const backdrop = el('div', { class: 'fw-wn-backdrop' })
  const sheet = el('div', { class: 'fw-wn', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fw-wn-title' })
  sheet.appendChild(el('h2', { id: 'fw-wn-title' }, labels.title))
  const list = el('ol')
  for (const item of items) {
    const li = el('li', { 'data-id': item.id })
    const m = mediaFor(item, reducedMotion)
    if (m) li.appendChild(m)
    li.appendChild(el('p', {}, item.text))
    list.appendChild(li)
  }
  sheet.appendChild(list)
  const footer = el('footer')
  const button = el('button', { type: 'button', 'data-whats-new-close': '' }, labels.close)
  if (release.changelog && safeHref(release.changelog)) {
    const all = el('a', { href: release.changelog }, labels.all)
    all.addEventListener('click', () => close('changelog'))
    footer.appendChild(all)
  } else footer.appendChild(el('span'))
  footer.appendChild(button)
  sheet.appendChild(footer)
  backdrop.appendChild(sheet)

  const previous = document.activeElement as HTMLElement | null
  // a real modal: everything else in root goes inert while the sheet is open
  const madeInert = [...root.children].filter((c) => c !== backdrop && !c.hasAttribute('inert'))
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close('escape')
    } else if (e.key === 'Tab') {
      const f = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!f.length) return
      const i = f.indexOf(document.activeElement as HTMLElement)
      const next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : i === -1 || i === f.length - 1 ? 0 : i + 1
      e.preventDefault()
      f[next].focus()
    }
  }
  let open = true
  function close(via: string) {
    if (!open) return
    open = false
    document.removeEventListener('keydown', onKey)
    for (const c of madeInert) c.removeAttribute('inert')
    backdrop.remove()
    track('whats_new_dismissed', { version: release.version, via })
    if (previous?.isConnected) previous.focus?.()
  }
  button.addEventListener('click', () => close('button'))
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close('backdrop')
  })
  document.addEventListener('keydown', onKey)
  root.appendChild(backdrop)
  for (const c of madeInert) c.setAttribute('inert', '')
  button.focus()
  track('whats_new_seen', { version: release.version, items: items.length })
  return { shown: true, close: () => close('api') }
}

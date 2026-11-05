// What's new sheet (flywheel docs/standards/whats-new.md): this app's wiring of the vendored kit.
// whats-new.json (Czech) and whats-new.en.json carry the release; the session that ships the next
// user-facing change bumps `version` in both and rewrites the items.
import cs from '../whats-new.json'
import en from '../whats-new.en.json'
import { lang } from './i18n'
import { mountWhatsNew, type WhatsNewRelease } from './platform/whats-new'

type Track = (event: 'whats_new_seen' | 'whats_new_dismissed', props: Record<string, unknown>) => void

const LABELS = {
  cs: { title: 'Co je nového', close: 'Rozumím', all: 'Všechny změny' },
  en: { title: "What's new", close: 'Got it', all: 'All changes' },
}

/** An earlier visit, from the app's own storage: the first-run guide was closed. Read before render. */
export function wasHereBefore(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    // localStorage itself throws when site data is blocked, so it is read inside the try
    return (storage ?? localStorage).getItem('bohosluzby:introSeen') !== null
  } catch {
    return false
  }
}

function isFramed(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true // cross-origin parent
  }
}

/** Mounts the sheet when it is due; true if it is showing. Never inside a frame or over ?intro=1. */
export function startWhatsNew({ track, returning, framed = isFramed() }: { track: Track; returning: boolean; framed?: boolean }): boolean {
  if (typeof window === 'undefined' || framed) return false
  if (new URLSearchParams(window.location.search).get('intro') === '1') return false
  const l = lang()
  const release = (l === 'cs' ? cs : en) as WhatsNewRelease
  return mountWhatsNew({ release, track, returning, labels: LABELS[l] }).shown
}

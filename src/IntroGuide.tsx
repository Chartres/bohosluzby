// First-run walkthrough — a short, skippable, shown-once guide, re-openable
// later from the footer. Reverent missal styling (hairlines, rubric red,
// Fraunces title, no shadows, no emoji — docs/DESIGN-BRIEF.md). Plain React, no
// tour library. Trigger + the introSeen flag live in App; this is just the view.
import { useEffect, useRef, useState } from 'react'
import { t, type Key } from './i18n'

const CARDS = ['intro_card1', 'intro_card2', 'intro_card3', 'intro_card4'] as const

export function IntroGuide({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const last = i === CARDS.length - 1

  // Focus-trap the modal: focus lands inside on mount, Tab cycles within, Escape
  // closes. Focus returns to whatever was focused before on unmount.
  useEffect(() => {
    const node = ref.current
    const prev = document.activeElement as HTMLElement | null
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>('button') ?? [])
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const f = focusables()
      if (f.length === 0) return
      const first = f[0]
      const lastEl = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  const key = CARDS[i]
  const linkCls = 'underline decoration-hairline underline-offset-2 hover:text-ink'

  return (
    <>
      <button
        type="button"
        aria-label={t('intro_dismiss_aria')}
        className="fixed inset-0 z-[1290] bg-ink/20"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal
        aria-labelledby="intro-title"
        className="fixed top-1/2 left-1/2 z-[1300] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-hairline bg-paper px-6 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="rubric">{t('intro_rubric')}</p>
          <button type="button" className={`rubric ${linkCls}`} onClick={onClose}>
            {t('intro_skip')}
          </button>
        </div>
        <h2 id="intro-title" className="font-display mt-3 text-xl leading-tight font-bold">
          {t(`${key}_title` as Key)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-faded">{t(`${key}_body` as Key)}</p>
        <div className="mt-5 flex items-center justify-between border-t border-hairline pt-3">
          <p className="text-xs tabular-nums text-ink-faded">
            {i + 1} / {CARDS.length}
          </p>
          <button
            type="button"
            className={`rubric ${linkCls}`}
            onClick={() => (last ? onClose() : setI(i + 1))}
          >
            {last ? t('intro_done') : t('intro_next')}
          </button>
        </div>
      </div>
    </>
  )
}

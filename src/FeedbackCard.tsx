import { useState } from 'react'
import { feedback } from './analytics'

// Flywheel feedback widget (autoskola pattern, missal dress). User-initiated →
// always sends; collapsed to one quiet line so the footer stays a footer.
type Ellis = 'very' | 'somewhat' | 'not'

const ELLIS_LABELS: Record<Ellis, string> = {
  very: 'Hodně by mi chyběla',
  somewhat: 'Trochu by mi chyběla',
  not: 'Nechyběla by mi',
}

export function FeedbackCard({ context = 'footer' }: { context?: string }) {
  const [open, setOpen] = useState(false)
  const [ellis, setEllis] = useState<Ellis | null>(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  const canSend = !!ellis || text.trim().length > 0

  function submit() {
    if (!canSend) return
    feedback({
      sean_ellis: ellis ?? undefined,
      text: text.trim() ? `[${context}] ${text.trim()}` : undefined,
    })
    setSent(true)
  }

  if (sent) {
    return <p className="py-1 text-sm text-ink-faded">Díky, zpětnou vazbu jsme dostali.</p>
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="py-1 text-sm text-ink-faded underline decoration-hairline underline-offset-2 hover:text-ink"
      >
        Našli jste chybu v rozpisu? Napište nám
      </button>
    )
  }
  return (
    <div className="py-1">
      <p className="text-sm text-ink-faded">
        Co chybí? Co nesedí? Píšete přímo autorovi.
      </p>
      <p className="rubric mt-3">Kdyby tahle aplikace zítra zmizela…</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {(['very', 'somewhat', 'not'] as const).map((key) => {
          const active = ellis === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setEllis(active ? null : key)}
              className={`-my-1 flex min-h-11 items-center px-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                active
                  ? 'text-ink underline decoration-2 underline-offset-4'
                  : 'text-ink-faded hover:text-ink'
              }`}
              style={active ? { textDecorationColor: 'var(--season)' } : undefined}
            >
              {ELLIS_LABELS[key]}
            </button>
          )
        })}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Napište cokoli (volitelné)…"
        aria-label="Zpětná vazba"
        className="mt-3 w-full rounded-sm border border-hairline bg-white/40 p-2 text-base text-ink placeholder:text-ink-faded"
      />
      <div className="mt-2 flex justify-end gap-4">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 px-1 text-sm text-ink-faded underline decoration-hairline underline-offset-2 hover:text-ink"
        >
          Zavřít
        </button>
        <button
          type="button"
          disabled={!canSend}
          onClick={submit}
          className="min-h-11 rounded-sm border border-ink px-4 text-sm font-semibold disabled:opacity-40"
        >
          Odeslat
        </button>
      </div>
    </div>
  )
}

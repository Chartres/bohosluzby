// The after-Mass witness card (docs/PILGRIM-WITNESS-PLAN.md). Missal dress:
// Fraunces name, hairlines, rubric red, ≥44px targets. NO stars, NO emoji, NO
// shadows, positive-only chips. One tap "Ano" is already the witness; the chips,
// language, and suggest-a-tag are optional.
import { useState } from 'react'
import { WITNESS_CHIPS, type MassFeedback, type Occurrence } from './domain/feedback'
import { suggestTag } from './lib/feedbackStore'
import { t } from './i18n'

export interface CardMass extends Occurrence {
  churchId: string
  massKey: string
  churchName: string
  type: string
}

export function AfterMassCard({
  entry,
  onSubmit,
  onDismiss,
  onNeverAsk,
}: {
  entry: CardMass
  /** Persist a submission (called on "Ano" with no chips, again on "Uložit"). */
  onSubmit: (s: MassFeedback) => void
  onDismiss: () => void
  onNeverAsk: () => void
}) {
  const [phase, setPhase] = useState<'ask' | 'chips' | 'done'>('ask')
  const [chips, setChips] = useState<string[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestText, setSuggestText] = useState('')

  const submit = (over: Partial<MassFeedback> = {}) =>
    onSubmit({
      churchId: entry.churchId,
      massKey: entry.massKey,
      chips,
      weekday: entry.weekday,
      time: entry.time,
      rite: entry.rite,
      lang: entry.lang,
      massDate: entry.massDate,
      ...over,
    })

  const onYes = () => {
    submit({ chips: [] }) // attending is itself the witness
    setPhase('chips')
  }
  const onSave = () => {
    submit()
    if (suggestText.trim()) suggestTag(suggestText)
    setPhase('done')
  }
  const toggleChip = (id: string) =>
    setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  // Calm, legible pills: real padding, rounded, a season-accent selected state,
  // ≥44px touch. Breathing room comes from the container gap. No shadows.
  const chipCls = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-sm transition-colors ${
      active ? 'text-ink' : 'border-hairline text-ink-faded hover:border-ink/40 hover:text-ink'
    }`
  const chipStyle = (active: boolean) =>
    active
      ? {
          borderColor: 'var(--season)',
          backgroundColor: 'color-mix(in srgb, var(--season) 10%, transparent)',
        }
      : undefined

  return (
    <section
      aria-label={t('fb_card_aria')}
      data-fb-church-id={entry.churchId}
      className="mt-3 rounded-sm border border-hairline p-4"
    >
      {phase === 'done' ? (
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-semibold text-rubric" role="status">
            {t('fb_saved')}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 px-1 text-sm text-ink-faded underline decoration-hairline underline-offset-2 hover:text-ink"
          >
            {t('close')}
          </button>
        </div>
      ) : (
        <>
          <p className="rubric">{t('fb_attended_q')}</p>
          <p className="mt-1 font-display text-lg leading-snug font-semibold" data-testid="fb-mass-name">
            {entry.churchName}
          </p>
          <p className="mt-0.5 text-sm text-ink-faded">
            {entry.type}
            {' · '}
            {entry.time}
          </p>

          {phase === 'ask' ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={onYes}
                className="min-h-11 rounded-sm border border-ink px-4 text-sm font-semibold"
              >
                {t('fb_yes')}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="min-h-11 px-1 text-sm text-ink-faded underline decoration-hairline underline-offset-2 hover:text-ink"
              >
                {t('fb_not_now')}
              </button>
              <button
                type="button"
                onClick={onNeverAsk}
                className="rubric min-h-11 px-1 underline decoration-hairline underline-offset-2 hover:text-ink"
              >
                {t('fb_never')}
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <p className="rubric">{t('fb_chips_intro')}</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {WITNESS_CHIPS.map((c) => {
                  const active = chips.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleChip(c.id)}
                      className={chipCls(active)}
                      style={chipStyle(active)}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>

              {suggestOpen ? (
                <div className="mt-4">
                  <label className="rubric block" htmlFor="fb-suggest">
                    {t('fb_suggest_link')}
                  </label>
                  <input
                    id="fb-suggest"
                    value={suggestText}
                    onChange={(e) => setSuggestText(e.target.value)}
                    placeholder={t('fb_suggest_placeholder')}
                    className="mt-2 min-h-11 w-full rounded-sm border border-hairline bg-white/40 px-3 text-base text-ink placeholder:text-ink-faded"
                  />
                  <p className="mt-1 text-xs text-ink-faded">{t('fb_suggest_note')}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSuggestOpen(true)}
                  className="mt-4 block min-h-11 text-sm text-ink-faded underline decoration-hairline underline-offset-2 hover:text-ink"
                >
                  {t('fb_suggest_link')}
                </button>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onSave}
                  className="min-h-11 rounded-sm border border-ink px-4 text-sm font-semibold"
                >
                  {t('fb_save')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

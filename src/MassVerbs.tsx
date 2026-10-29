// A mass's own verbs — připomenout · do kalendáře · pozvat — one quiet line of
// icon + word. The grammar across the app (Pavol 2026-10-29): the TIME is the
// mass (tap it and this line unfolds under the row), the NAME is the church,
// and trasa/web belong to the church. Same line in the list, the church ordo,
// the 1.–2. 11. block and the detail header (for the mass you came for).
import { useState } from 'react'
import type { Church, ExtraService, Service } from './domain/data'
import { inviteFor } from './domain/invite'
import { logError, track } from './analytics'
import { isNative } from './lib/native'
import { addToCalendar, scheduleMassReminder, REMINDER_LEAD_MIN } from './lib/native-actions'
import { lang, reminderCalendarMsg, reminderScheduledMsg, t } from './i18n'

// 1.6px line icons in currentColor, drawn small beside their word — the word
// stays the label.
const ICON = {
  remind: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
  invite: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM22 7l-10 6L2 7',
} as const

function Icon({ name }: { name: keyof typeof ICON }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON[name]} />
    </svg>
  )
}

export function MassVerbs({
  church,
  service,
  hero = false,
  className = '',
}: {
  church: Church
  service: Service | ExtraService
  /** over the photo: paper text with the hero's halo */
  hero?: boolean
  className?: string
}) {
  const [msg, setMsg] = useState<string | null>(null)
  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 3500)
  }

  const onRemind = async () => {
    const r = await scheduleMassReminder(church, service)
    track('key_action', { action: 'reminder', church: church.id, result: r })
    flash(
      r === 'scheduled'
        ? reminderScheduledMsg(REMINDER_LEAD_MIN)
        : r === 'calendar'
          ? reminderCalendarMsg(REMINDER_LEAD_MIN)
          : r === 'denied'
            ? t('remind_denied')
            : r === 'failed'
              ? t('remind_failed')
              : t('remind_none'),
    )
  }

  const onCalendar = () => {
    addToCalendar(church, service)
      .then((ok) => (ok ? track('key_action', { action: 'ics', church: church.id }) : flash(t('remind_none'))))
      .catch((err) => logError(err, { where: 'calendar', id: church.id }))
  }

  // Mechanic C (docs/SIGNATURE.md): one person invites another, in their own
  // messenger. Prefilled with the next date this service really runs.
  const onInvite = async () => {
    const inv = inviteFor(church, service, new Date(), lang())
    if (!inv) return flash(t('remind_none'))
    const sent = () => track('key_action', { action: 'invite', church: church.id })
    if (isNative) {
      try {
        const { Share } = await import('@capacitor/share')
        await Share.share({ text: inv.text, url: inv.url })
        sent()
      } catch {
        // the person closed the share sheet
      }
      return
    }
    if (navigator.share) {
      try {
        await navigator.share({ text: inv.text, url: inv.url })
        return sent()
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return // closed the sheet
        // refused (NotAllowedError, unsupported data) → copy instead
      }
    }
    try {
      await navigator.clipboard.writeText(`${inv.text}\n${inv.url}`)
      flash(t('invite_copied'))
      sent()
    } catch {
      flash(t('remind_failed'))
    }
  }

  // -my-3 py-3: 44px hit areas without spreading the line
  const verb = `-my-3 inline-flex items-center gap-1.5 py-3 ${
    hero ? 'text-paper hover:underline' : 'text-ink-faded hover:text-ink'
  }`
  return (
    <div className={className}>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <button type="button" className={verb} onClick={onRemind}>
          <Icon name="remind" />
          {t('remind')}
        </button>
        <button type="button" className={verb} onClick={onCalendar}>
          <Icon name="calendar" />
          {t('add_calendar')}
        </button>
        <button type="button" className={verb} onClick={onInvite}>
          <Icon name="invite" />
          {t('invite')}
        </button>
      </p>
      {/* the result is VISIBLE (one persistent aria-live region) — a reminder
          the user can't see happened reads as a broken button */}
      <p
        className={msg ? `mt-1 text-xs font-semibold ${hero ? 'text-paper' : 'text-rubric'}` : 'sr-only'}
        role="status"
        aria-live="polite"
      >
        {msg ?? ''}
      </p>
    </div>
  )
}

import { isNative } from './native'
import type { Church, ExtraService, Service } from '../domain/data'
import { buildICS } from '../domain/ics'
import { nextReminderAt, pragueToday } from '../domain/occurrences'
import { parseNote } from '../domain/notes'

/** How long before a service the reminder fires. */
export const REMINDER_LEAD_MIN = 30

type AnyService = Service | ExtraService

const specOf = (s: AnyService) =>
  'days' in s ? { days: s.days, time: s.time } : { date: s.date, time: s.time }

const icsName = (church: Church, s: AnyService) =>
  `bohosluzby-${church.id}-${s.time.replace(':', '')}.ics`

/** Stable positive 31-bit id for a service's reminder (LocalNotifications needs an int). */
function reminderId(church: Church, s: AnyService): number {
  const key = `${church.id}-${'days' in s ? s.days : s.date}-${s.time}`
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 1) % 2_000_000_000
}

/**
 * Add a service to the device calendar. Native: write the .ics to a cache file
 * and hand it to the system share sheet (iOS offers "Add to Calendar"). Web:
 * download the blob (unchanged behaviour). Light haptic on native.
 */
export async function addToCalendar(church: Church, service: AnyService): Promise<void> {
  const ics = buildICS(church, service, new Date())
  if (!ics) return
  const filename = icsName(church, service)

  if (isNative) {
    await tapFeedback()
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const written = await Filesystem.writeFile({
      path: filename,
      data: ics,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    await Share.share({ title: church.name, url: written.uri })
    return
  }

  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type ReminderResult = 'scheduled' | 'denied' | 'no-upcoming' | 'unsupported' | 'failed'

/**
 * When to fire the reminder: REMINDER_LEAD_MIN before the next occurrence the
 * service's note actually allows. A mass noted "kromě července a srpna" skips
 * July/August and lands on the next running date (up to a year out), never
 * scheduling a reminder for a mass that provably doesn't happen.
 */
export function reminderTimeFor(service: AnyService, now: Date): Date | null {
  const rule = parseNote(service.note)
  return nextReminderAt(specOf(service), now, REMINDER_LEAD_MIN, 366, (start) => {
    const w = pragueToday(start)
    return rule.runsOn(w.y, w.m, w.d)
  })
}

/**
 * Schedule a local notification REMINDER_LEAD_MIN before the next occurrence of
 * this service. Native only (web returns 'unsupported' — the button is hidden
 * there). The occurrence maths is tested in domain/occurrences (nextReminderAt).
 */
export async function scheduleMassReminder(
  church: Church,
  service: AnyService,
): Promise<ReminderResult> {
  if (!isNative) return 'unsupported'
  const at = reminderTimeFor(service, new Date())
  if (!at) return 'no-upcoming'

  const { LocalNotifications } = await import('@capacitor/local-notifications')
  let perm = await LocalNotifications.checkPermissions()
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') return 'denied'

  await tapFeedback()
  const type = service.type || 'bohoslužba'
  const id = reminderId(church, service)
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: `${type.charAt(0).toUpperCase()}${type.slice(1)} za ${REMINDER_LEAD_MIN} min`,
          body: `${church.name} — ${service.time}`,
          schedule: { at },
        },
      ],
    })
    // don't just trust the resolved promise — 'scheduled' is a UI promise to the
    // user, so confirm the OS actually holds the pending notification
    const pending = await LocalNotifications.getPending()
    return pending.notifications.some((n) => n.id === id) ? 'scheduled' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Light impact on native taps; silent no-op on web. */
export async function tapFeedback(): Promise<void> {
  if (!isNative) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    /* haptics unavailable — ignore */
  }
}

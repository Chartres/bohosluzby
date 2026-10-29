import { isNative } from './native'
import { reminderTitle, t } from '../i18n'
import type { Church, ExtraService, Service } from '../domain/data'
import { buildICS, specOf } from '../domain/ics'
import { nextReminderAt } from '../domain/occurrences'
import { runsAt } from '../domain/notes'
import { expectAttendance } from './feedbackLedger'

/** How long before a service the reminder fires. */
export const REMINDER_LEAD_MIN = 30

type AnyService = Service | ExtraService

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
 * Resolves false when the service has no occurrence to export.
 */
export async function addToCalendar(church: Church, service: AnyService): Promise<boolean> {
  const ics = buildICS(church, service, new Date())
  if (!ics) return false
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
    return true
  }

  download(ics, filename)
  return true
}

function download(ics: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Defer revoke so the browser has time to start the download before the
  // object URL is freed (synchronous revoke breaks Firefox and Safari).
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export type ReminderResult = 'scheduled' | 'calendar' | 'denied' | 'no-upcoming' | 'unsupported' | 'failed'

/**
 * When to fire the reminder: REMINDER_LEAD_MIN before the next occurrence the
 * service's note actually allows. A mass noted "kromě července a srpna" skips
 * July/August and lands on the next running date (up to a year out), never
 * scheduling a reminder for a mass that provably doesn't happen.
 */
export function reminderTimeFor(service: AnyService, now: Date): Date | null {
  return nextReminderAt(specOf(service), now, REMINDER_LEAD_MIN, 366, (start) => runsAt(service.note, start))
}

/**
 * Schedule a local notification REMINDER_LEAD_MIN before the next occurrence of
 * this service. The web can't schedule one, so there it downloads a one-off
 * calendar event for that occurrence carrying an alert REMINDER_LEAD_MIN before
 * ('calendar'). The occurrence maths is tested in domain/occurrences (nextReminderAt).
 */
export async function scheduleMassReminder(
  church: Church,
  service: AnyService,
): Promise<ReminderResult> {
  const at = reminderTimeFor(service, new Date())
  if (!at) return 'no-upcoming'
  if (!isNative) {
    const ics = buildICS(church, service, new Date(), { once: true, alarmMin: REMINDER_LEAD_MIN })
    if (!ics) return 'no-upcoming'
    download(ics, icsName(church, service).replace('.ics', '-pripominka.ics'))
    return 'calendar'
  }

  const { LocalNotifications } = await import('@capacitor/local-notifications')
  let perm = await LocalNotifications.checkPermissions()
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') return 'denied'

  await tapFeedback()
  const type = service.type || t('service_fallback')
  const id = reminderId(church, service)
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: reminderTitle(type, REMINDER_LEAD_MIN),
          body: `${church.name} — ${service.time}`,
          schedule: { at },
        },
      ],
    })
    // don't just trust the resolved promise — 'scheduled' is a UI promise to the
    // user, so confirm the OS actually holds the pending notification
    const pending = await LocalNotifications.getPending()
    if (!pending.notifications.some((n) => n.id === id)) return 'failed'
    // seed the after-Mass ledger: `at` is REMINDER_LEAD_MIN before the start
    expectAttendance(church, service, new Date(at.getTime() + REMINDER_LEAD_MIN * 60_000), type)
    return 'scheduled'
  } catch {
    return 'failed'
  }
}

/** Light impact on native taps; silent no-op on web. */
async function tapFeedback(): Promise<void> {
  if (!isNative) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    /* haptics unavailable — ignore */
  }
}

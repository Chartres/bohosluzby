import { isNative } from './native'
import type { Church, ExtraService, Service } from '../domain/data'
import { buildICS } from '../domain/ics'
import { nextReminderAt } from '../domain/occurrences'

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

export type ReminderResult = 'scheduled' | 'denied' | 'no-upcoming' | 'unsupported'

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
  const at = nextReminderAt(specOf(service), new Date(), REMINDER_LEAD_MIN)
  if (!at) return 'no-upcoming'

  const { LocalNotifications } = await import('@capacitor/local-notifications')
  let perm = await LocalNotifications.checkPermissions()
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') return 'denied'

  await tapFeedback()
  const type = service.type || 'bohoslužba'
  await LocalNotifications.schedule({
    notifications: [
      {
        id: reminderId(church, service),
        title: `${type.charAt(0).toUpperCase()}${type.slice(1)} za ${REMINDER_LEAD_MIN} min`,
        body: `${church.name} — ${service.time}`,
        schedule: { at },
      },
    ],
  })
  return 'scheduled'
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

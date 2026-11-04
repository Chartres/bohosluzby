// Mass reminders on Android are inexact (the manifest strips SCHEDULE_EXACT_ALARM),
// so they must at least be allowed to fire while the phone dozes — otherwise a
// reminder 30 min before Mass can be held until after it has started.
import { describe, expect, it, vi } from 'vitest'

const schedule = vi.fn(async () => ({ notifications: [] }))
vi.mock('./native', () => ({ isNative: true, platform: 'android' }))
vi.mock('./feedbackLedger', () => ({ expectAttendance: vi.fn() }))
vi.mock('@capacitor/haptics', () => ({ Haptics: { impact: vi.fn(async () => {}) }, ImpactStyle: { Light: 'LIGHT' } }))
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(async () => ({ display: 'granted' })),
    requestPermissions: vi.fn(async () => ({ display: 'granted' })),
    schedule,
    getPending: vi.fn(async () => ({ notifications: (schedule.mock.calls.at(-1) as unknown as [{ notifications: { id: number }[] }])[0].notifications })),
  },
}))

import { scheduleMassReminder } from './native-actions'

describe('scheduleMassReminder on Android', () => {
  it('schedules an alarm that may fire while the device is idle (inexact, no exact-alarm permission)', async () => {
    const church = { id: '1', name: 'kostel 1', city: 'Praha', lat: 50, lng: 14, barrierFree: false, cell: '50-14' }
    const service = { days: '1234567', time: '23:59', lang: 'česky', greek: false, type: 'mše sv.', note: '' }
    const r = await scheduleMassReminder(church, service)
    expect(r).toBe('scheduled')
    const arg = (schedule.mock.calls[0] as unknown as [{ notifications: { schedule: { at: Date; allowWhileIdle?: boolean } }[] }])[0]
    expect(arg.notifications[0].schedule.allowWhileIdle).toBe(true)
  })
})

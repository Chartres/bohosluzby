// The review's catch (2026-10-30): a dated row — a list row, the header, the
// 1.–2. 11. block — must act on ITS date. Passing the weekly service let
// pozvat/připomenout pick the next run from now: a 2 Nov row invited "Dnes".
import { describe, expect, it } from 'vitest'
import { onDate } from './MassVerbs'
import { inviteFor } from './domain/invite'
import { buildICS } from './domain/ics'
import type { Church, Service } from './domain/data'

const church: Church = { id: '7', name: 'kostel sv. Jakuba', city: 'Brno', lat: 49.2, lng: 16.6, barrierFree: false, cell: '49-16' }
const daily: Service = { days: '1234567', time: '18:00', lang: 'česky', greek: false, type: 'mše sv.', note: '' }
const now = new Date('2026-10-29T09:00:00Z') // Thu 10:00 Prague
const allSouls = new Date('2026-11-02T17:00:00Z') // Mon 18:00 Prague

describe('onDate', () => {
  it('turns a weekly service into that day’s one-off', () => {
    const d = onDate(daily, allSouls)
    expect(d).toMatchObject({ date: '2026-11-02', time: '18:00', type: 'mše sv.' })
    expect('days' in d).toBe(false)
  })
  it('pozvat names the tapped date, not today', () => {
    const inv = inviteFor(church, onDate(daily, allSouls), now, 'cs')!
    expect(inv.text).not.toMatch(/Dnes|Zítra/)
    expect(inv.text).toMatch(/2\. 11\./)
  })
  it('do kalendáře exports that one event', () => {
    const ics = buildICS(church, onDate(daily, allSouls), now)!
    expect(ics).toContain('DTSTART;TZID=Europe/Prague:20261102T180000')
    expect(ics).not.toContain('RRULE:FREQ=WEEKLY')
  })
})

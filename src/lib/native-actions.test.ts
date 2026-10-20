import { describe, expect, it } from 'vitest'
import { reminderTimeFor } from './native-actions'
import { pragueToday } from '../domain/occurrences'
import type { Service } from '../domain/data'

const friday = (note: string): Service => ({
  days: '5', // Friday
  time: '18:00',
  lang: 'česky',
  greek: false,
  type: 'mše sv.',
  note,
})

describe('reminderTimeFor — note-aware', () => {
  it('a July "kromě července a srpna" Friday mass reminds in September', () => {
    const now = new Date('2026-07-10T08:00:00Z') // Friday, 10 July 2026 (Prague)
    const at = reminderTimeFor(friday('kromě července a srpna'), now)
    expect(at).not.toBeNull()
    expect(pragueToday(at!).m).toBe(9) // September, not July/August
  })
  it('no note → the very next Friday', () => {
    const now = new Date('2026-07-10T08:00:00Z')
    const at = reminderTimeFor(friday(''), now)
    expect(at).not.toBeNull()
    expect(pragueToday(at!).m).toBe(7) // still July
  })
})

describe('addToCalendar (sweep F2)', () => {
  it('reports false when there is nothing to export, so the tap can say so', async () => {
    const { addToCalendar } = await import('./native-actions')
    const church = { id: '42', name: 'kostel', city: 'Praha', lat: 50, lng: 14, barrierFree: false, cell: '50-14' }
    const past = { date: '2020-01-06', time: '18:00', lang: 'česky', greek: false, type: 'mše sv.', note: '' }
    await expect(addToCalendar(church, past)).resolves.toBe(false)
  })
})

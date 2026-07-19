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

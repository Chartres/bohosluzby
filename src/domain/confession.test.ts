// Tier-1 confession mining out of Mass notes. The real registry examples below
// carry a confession time inside a Mass row's free text; precision over
// coverage means an unstated time yields null, never a guess.
import { describe, expect, it } from 'vitest'
import { parseConfessionFromNote } from './confession'

describe('parseConfessionFromNote', () => {
  it('extracts an explicit time with a "." separator', () => {
    expect(parseConfessionFromNote('od 17.00 svátost smíření', '18:00', '5')).toEqual({
      days: '5',
      time: '17:00',
      note: 'od 17.00 svátost smíření',
    })
  })

  it('attributes the time to the confession segment, not a sibling Mass', () => {
    const note = 'od 17:15 adorace s možností svátosti smíření, od 18.00 mše svatá'
    expect(parseConfessionFromNote(note, '18:00', '3')).toEqual({
      days: '3',
      time: '17:15',
      note,
    })
  })

  it('pads a single-digit hour', () => {
    expect(parseConfessionFromNote('od 8.00 svátost smíření', '09:00', '7')?.time).toBe('08:00')
  })

  it('returns null when confession is mentioned without its own time', () => {
    expect(parseConfessionFromNote('mše svatá s možností svátosti smíření', '18:00', '5')).toBeNull()
  })

  it('drops a time equal to the Mass start (confession AT Mass, not a window)', () => {
    expect(parseConfessionFromNote('od 18.00 svátost smíření', '18:00', '5')).toBeNull()
  })

  it('marks it relative only when the note literally says so', () => {
    expect(parseConfessionFromNote('svátost smíření přede mší svatou', '18:00', '5')?.time).toBe(
      'před mší',
    )
    expect(parseConfessionFromNote('svátost smíření po mši', '18:00', '5')?.time).toBe('po mši')
  })

  it('returns null when the note does not mention confession', () => {
    expect(parseConfessionFromNote('od 17.00 adorace', '18:00', '5')).toBeNull()
    expect(parseConfessionFromNote('', '18:00', '5')).toBeNull()
  })
})

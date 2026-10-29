import { describe, expect, it } from 'vitest'
import { creditLine, creditName } from './photoCredit'

describe('creditName — the author only, one short line', () => {
  it('keeps plain names', () => {
    expect(creditName('Jan Novák')).toBe('Jan Novák')
    expect(creditName('J. Novák')).toBe('J. Novák')
    expect(creditName('Aktron')).toBe('Aktron')
  })
  it('drops wiki markup and asides in brackets', () => {
    expect(creditName('ŠJů ( cs:ŠJů )')).toBe('ŠJů')
    expect(creditName('Pavel Hrdlička (Czech Wikipedia user Packa )')).toBe('Pavel Hrdlička')
    expect(creditName('Valentin F.R. (en pause) from Nouvelle Austrasie, France')).toBe('Valentin F.R.')
  })
  it('pulls the name out of a note', () => {
    expect(
      creditName('This Photo was taken by Miha Peče . Feel free to use my photos, but please mention me as the author.'),
    ).toBe('Miha Peče')
  })
  it('cuts a long name at a word', () => {
    const n = creditName('Kancelář pro fotografickou dokumentaci památek Olomouckého kraje')
    expect(n.length).toBeLessThanOrEqual(33)
    expect(n.endsWith('…')).toBe(true)
  })
  it('creditLine joins name, licence, source', () => {
    expect(creditLine('Miha Peče', 'CC BY-SA 4.0')).toBe('Miha Peče · CC BY-SA 4.0 · Wikimedia Commons')
  })
})

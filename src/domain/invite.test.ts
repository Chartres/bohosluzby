// Mechanic C (docs/SIGNATURE.md): invite one person to one Mass, in your own
// messenger. The text names the next date the service really runs (its note
// respected), so the invitation is never to a Mass that doesn't happen.
import { inviteFor } from './invite'

const CHURCH = { id: '42', name: 'kostel sv. Jakuba', city: 'Brno' }
const svc = (days: string, time: string, type = '', note = '') => ({ days, time, type, note })
// Tue 27 Oct 2026, 10:00 Prague (UTC+1 after the DST change on 25 Oct)
const NOW = new Date('2026-10-27T09:00:00Z')

describe('inviteFor', () => {
  it('names the next Sunday Mass by date and time, with the church and a tagged link', () => {
    const inv = inviteFor(CHURCH, svc('7', '9:00'), NOW, 'cs')!
    expect(inv.text).toBe('Půjdeš se mnou na mši svatou? V neděli 1. 11. v 9:00, kostel sv. Jakuba (Brno).')
    expect(inv.url).toBe('https://bohosluzby.dravec.org/kostel/42/?utm_source=pozvani')
  })

  it('says dnes / zítra for the next two days', () => {
    expect(inviteFor(CHURCH, svc('2', '18:00'), NOW, 'cs')!.text).toContain('Dnes v 18:00')
    expect(inviteFor(CHURCH, svc('3', '7:00'), NOW, 'cs')!.text).toContain('Zítra v 7:00')
  })

  it('skips today when the time has passed', () => {
    expect(inviteFor(CHURCH, svc('2', '08:00'), NOW, 'cs')!.text).toContain('V úterý 3. 11. v 08:00')
  })

  it('skips dates the note provably excludes', () => {
    // 1 Nov is the 1st Sunday of November; "2. neděle v měsíci" lands on 8 Nov
    expect(inviteFor(CHURCH, svc('7', '9:00', '', '2. neděle v měsíci'), NOW, 'cs')!.text).toContain('V neděli 8. 11.')
  })

  it('uses the Czech preposition forms (ve středu, ve čtvrtek)', () => {
    const later = new Date('2026-10-26T09:00:00Z') // Monday
    expect(inviteFor(CHURCH, svc('3', '9:00'), later, 'cs')!.text).toContain('Ve středu 28. 10.')
    expect(inviteFor(CHURCH, svc('4', '9:00'), later, 'cs')!.text).toContain('Ve čtvrtek 29. 10.')
  })

  it('a one-off uses its own date', () => {
    const inv = inviteFor(CHURCH, { date: '2026-11-02', time: '18:00', type: 'mše sv.', note: 'za zemřelé' }, NOW, 'cs')!
    expect(inv.text).toContain('V pondělí 2. 11. v 18:00')
  })

  it('names a non-Mass service by its type', () => {
    expect(inviteFor(CHURCH, svc('7', '15:00', 'pobožnost'), NOW, 'cs')!.text).toBe(
      'Půjdeš se mnou? Pobožnost v neděli 1. 11. v 15:00, kostel sv. Jakuba (Brno).',
    )
  })

  it('does not repeat a city the church name already carries', () => {
    const inv = inviteFor({ ...CHURCH, name: 'kostel sv. Jakuba, Brno' }, svc('7', '9:00'), NOW, 'cs')!
    expect(inv.text).toContain('kostel sv. Jakuba, Brno.')
  })

  it('says "ve" where Czech does (ve 4, ve 12, ve 14, ve 20 …)', () => {
    expect(inviteFor(CHURCH, svc('7', '14:00', 'pobožnost'), NOW, 'cs')!.text).toContain('ve 14:00')
    expect(inviteFor(CHURCH, svc('7', '12:00'), NOW, 'cs')!.text).toContain('ve 12:00')
    expect(inviteFor(CHURCH, svc('7', '18:30'), NOW, 'cs')!.text).toContain('v 18:30')
  })

  it('English keeps today/tomorrow lower-case after a service name', () => {
    expect(inviteFor(CHURCH, svc('2', '18:00', 'adorace'), NOW, 'en')!.text).toBe(
      'Will you come with me? Adorace today at 18:00, kostel sv. Jakuba (Brno).',
    )
  })

  it('English', () => {
    expect(inviteFor(CHURCH, svc('7', '9:00'), NOW, 'en')!.text).toBe(
      'Will you come to Mass with me? Sunday 1 Nov at 9:00, kostel sv. Jakuba (Brno).',
    )
  })

  it('null when nothing runs within a year (past one-off)', () => {
    expect(inviteFor(CHURCH, { date: '2026-01-06', time: '9:00', type: '', note: '' }, NOW, 'cs')).toBeNull()
  })
})

// The app's "roráty" view (Pavol, 22 Nov 2026: option B, the pill in the day row). The same
// rules as the /advent/ pages (season.ts): a registry row counts when it says roráty and Advent,
// not on a Sunday nor on 8 Dec; a parish notice counts as given, also on a weekly Mass it
// confirms (data/corrections.mjs marks those as `r`).
import { rorateLabel, rorateWindow } from './roraty'
import type { ChurchServices, ExtraService, Service } from './data'
import type { Upcoming } from './ranking'

const church = { id: '1', name: 'k', city: 'Praha', lat: 0, lng: 0, barrierFree: false, cell: '50-14' }
const weekly = (days: string, time: string, type: string, note = ''): Service => ({ days, time, lang: 'česky', greek: false, type, note })
const extra = (date: string, time: string, type: string, note = ''): ExtraService => ({ date, time, lang: 'česky', greek: false, type, note })
const at = (iso: string, hhmm: string) => new Date(`${iso}T${hhmm}:00+01:00`)
const up = (service: Service | ExtraService, iso: string, hhmm: string): Upcoming => ({ church, distanceKm: 1, start: at(iso, hhmm), service })
const svc = (rorate?: ChurchServices['rorate']): ChurchServices => ({ updated: '', parish: '', parishAddress: '', contacts: [], regular: [], extra: [], confession: [], ...(rorate ? { rorate } : {}) })

describe('rorateWindow', () => {
  it('from the Saturday before the 1st Sunday of Advent to Christmas Eve', () => {
    expect(rorateWindow(at('2026-11-27', '12:00'))).toBe(false)
    expect(rorateWindow(at('2026-11-28', '12:00'))).toBe(true)
    expect(rorateWindow(at('2026-12-24', '12:00'))).toBe(true)
    expect(rorateWindow(at('2026-12-25', '08:00'))).toBe(false)
  })
})

describe('rorateLabel', () => {
  it('a registry row that says roráty in Advent, on a weekday', () => {
    expect(rorateLabel(up(weekly('12345', '06:15', 'rorátní mše sv.', 'v adventu'), '2026-11-30', '06:15'), svc())).toBe('v adventu')
    expect(rorateLabel(up(weekly('7', '07:00', 'mše sv.', 'v adventu rorátní'), '2026-11-29', '07:00'), svc())).toBeNull() // Sunday
    expect(rorateLabel(up(weekly('2', '06:15', 'rorátní mše sv.', 'v adventu'), '2026-12-08', '06:15'), svc())).toBeNull() // 8 Dec
    expect(rorateLabel(up(weekly('1', '07:00', 'rorátní mše sv.', ''), '2026-11-30', '07:00'), svc())).toBeNull() // never says Advent
    expect(rorateLabel(up(weekly('1', '06:00', 'rorátní mše sv.', 'v adventu 2019'), '2026-11-30', '06:00'), svc())).toBeNull() // a past Advent
    expect(rorateLabel(up(weekly('1', '07:00', 'mše sv.', ''), '2026-11-30', '07:00'), svc())).toBeNull()
  })

  it('a notice row counts as given, 8 Dec included', () => {
    expect(rorateLabel(up(extra('2026-12-08', '07:00', 'mše sv.', 'roráty'), '2026-12-08', '07:00'), svc())).toBe('roráty')
  })

  it('a weekly Mass a notice confirms as roráty (Stará Bělá 6:45)', () => {
    const s = svc([{ date: '2026-11-30', time: '06:45', note: 'roráty' }])
    expect(rorateLabel(up(weekly('1234', '06:45', 'mše sv.'), '2026-11-30', '06:45'), s)).toBe('roráty')
    expect(rorateLabel(up(weekly('1234', '06:45', 'mše sv.'), '2026-12-01', '06:45'), s)).toBeNull()
  })
})

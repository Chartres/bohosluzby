// Seasonal pills as data (Pavol, 23 Nov 2026): public/data/views.json reaches the apps over
// the air like the Mass times; the app only knows how to read it (src/domain/views.ts).
// The roráty tests run against the real file, so a data edit that breaks them fails CI.
import FILE from '../../public/data/views.json'
import { activeViews, parseViews, viewDays, viewLabel, type ViewSpec } from './views'
import type { ChurchServices, ExtraService, Service } from './data'
import type { Upcoming } from './ranking'

const VIEWS = parseViews(FILE)
const roraty = VIEWS.find((v) => v.id === 'roraty')!

const church = { id: '1', name: 'k', city: 'Praha', lat: 0, lng: 0, barrierFree: false, cell: '50-14' }
const weekly = (days: string, time: string, type: string, note = ''): Service => ({ days, time, lang: 'česky', greek: false, type, note })
const extra = (date: string, time: string, type: string, note = ''): ExtraService => ({ date, time, lang: 'česky', greek: false, type, note })
const at = (iso: string, hhmm: string) => new Date(`${iso}T${hhmm}:00+01:00`)
const up = (service: Service | ExtraService, iso: string, hhmm: string): Upcoming => ({ church, distanceKm: 1, start: at(iso, hhmm), service })
const svc = (marks?: ChurchServices['marks']): ChurchServices => ({ updated: '', parish: '', parishAddress: '', contacts: [], regular: [], extra: [], confession: [], ...(marks ? { marks } : {}) })

describe('views.json (the data)', () => {
  it('every entry is valid: CI fails before a broken pill ships', () => {
    expect(VIEWS.map((v) => v.id)).toEqual((FILE.views as unknown as ViewSpec[]).map((v) => v.id))
  })
})

describe('parseViews', () => {
  const ok = FILE.views[0]
  it('drops entries it cannot read, keeps the rest', () => {
    const bad = [
      { ...ok, id: 'Bad Id' },
      { ...ok, id: 'x1', show: { from: '2026-12-01' } },
      { ...ok, id: 'x2', days: { next: 0 } },
      { ...ok, id: 'x3', match: {} },
      { ...ok, id: 'x4', label: {} },
      { ...ok, id: 'svatky' }, // reserved: the Dušičky pill and the day keys
      { ...ok, id: 'x5', match: { text: ['(?<=x)'] } }, // plain text only: fine as text, never a pattern
    ]
    expect(parseViews({ views: [...bad, ok] }).map((v) => v.id)).toEqual(['x5', 'roraty'])
    expect(parseViews(null)).toEqual([])
    expect(parseViews({ views: 'nope' })).toEqual([])
  })
})

describe('roráty (from views.json)', () => {
  it('shows from Saturday 28 Nov to 24 Dec', () => {
    expect(activeViews(VIEWS, at('2026-11-27', '12:00')).map((v) => v.id)).toEqual([])
    expect(activeViews(VIEWS, at('2026-11-28', '12:00')).map((v) => v.id)).toEqual(['roraty'])
    expect(activeViews(VIEWS, at('2026-12-24', '12:00')).map((v) => v.id)).toEqual(['roraty'])
    expect(activeViews(VIEWS, at('2026-12-25', '08:00'))).toEqual([])
  })

  it('lists the next 7 days', () => {
    expect(viewDays(roraty, at('2026-11-30', '06:00'))).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('a registry row that says roráty in Advent, on a weekday', () => {
    expect(viewLabel(roraty, up(weekly('12345', '06:15', 'rorátní mše sv.', 'v adventu'), '2026-11-30', '06:15'), svc())).toBe('v adventu')
    expect(viewLabel(roraty, up(weekly('7', '07:00', 'mše sv.', 'v adventu rorátní'), '2026-11-29', '07:00'), svc())).toBeNull()
    expect(viewLabel(roraty, up(weekly('2', '06:15', 'rorátní mše sv.', 'v adventu'), '2026-12-08', '06:15'), svc())).toBeNull()
    expect(viewLabel(roraty, up(weekly('1', '07:00', 'rorátní mše sv.', ''), '2026-11-30', '07:00'), svc())).toBeNull()
    expect(viewLabel(roraty, up(weekly('1', '06:00', 'rorátní mše sv.', 'v adventu 2019'), '2026-11-30', '06:00'), svc())).toBeNull()
    expect(viewLabel(roraty, up(weekly('1', '07:00', 'mše sv.', ''), '2026-11-30', '07:00'), svc())).toBeNull()
  })

  it('a notice row counts as given, 8 Dec included', () => {
    expect(viewLabel(roraty, up(extra('2026-12-08', '07:00', 'mše sv.', 'roráty'), '2026-12-08', '07:00'), svc())).toBe('roráty')
  })

  it('a weekly Mass a notice marks as roráty (Stará Bělá 6:45)', () => {
    const s = svc([{ date: '2026-11-30', time: '6:45', note: 'roráty' }])
    expect(viewLabel(roraty, up(weekly('1234', '06:45', 'mše sv.'), '2026-11-30', '06:45'), s)).toBe('roráty')
    expect(viewLabel(roraty, up(weekly('1234', '06:45', 'mše sv.'), '2026-12-01', '06:45'), s)).toBeNull()
  })
})

describe('a dated view (the shape Christmas will use)', () => {
  const vanoce = parseViews({
    views: [
      {
        id: 'vanoce',
        label: { cs: 'Vánoce' },
        aria: { cs: 'Půlnoční a vánoční mše' },
        show: { from: '2026-12-20', to: '2026-12-26' },
        days: { dates: [{ date: '2026-12-24', from: '15:00' }, { date: '2026-12-25' }, { date: '2026-12-26' }] },
        match: { any: true },
      },
    ],
  })[0]

  it('lists only its dates that are still ahead, as day offsets', () => {
    expect(viewDays(vanoce, at('2026-12-23', '12:00'))).toEqual([1, 2, 3])
    expect(viewDays(vanoce, at('2026-12-25', '12:00'))).toEqual([0, 1])
  })

  it('on 24 Dec only from 15:00; any service matches', () => {
    expect(viewLabel(vanoce, up(weekly('4', '07:00', 'mše sv.'), '2026-12-24', '07:00'), svc())).toBeNull()
    expect(viewLabel(vanoce, up(extra('2026-12-24', '24:00', 'mše sv.', 'půlnoční'), '2026-12-24', '23:59'), svc())).toBe('půlnoční')
    expect(viewLabel(vanoce, up(weekly('5', '09:00', 'mše sv.'), '2026-12-25', '09:00'), svc())).toBe('')
    expect(viewLabel(vanoce, up(weekly('5', '09:00', 'mše sv.'), '2026-12-27', '09:00'), svc())).toBeNull()
  })
})

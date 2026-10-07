// embed/<id>.json — what a parish website's widget fetches (web deploy only).
// Small, static, cacheable; carries only what the widget shows.
import { embedData } from './embedData'

const CHURCH = { id: '1', name: 'kostel sv. Havla', city: 'Praha 1', lat: 50, lng: 14 }
const ENTRY = {
  u: '2026-06-01',
  p: '',
  pa: '',
  c: [],
  s: [
    ['7', '09:00', 'Latine', 0, 'mše sv.', ''],
    ['24', '08:30 - 11:30', 'česky', 0, 'svátost smíření', ''],
    ['5', '18:00', 'česky', 1, '', 'kromě července'],
  ] as [string, string, string, 0 | 1, string, string][],
  x: [
    ['2026-07-05', '15:00', 'česky', 0, 'pobožnost', ''],
    ['2026-01-06', '18:00', 'česky', 0, 'mše sv.', ''],
  ] as [string, string, string, 0 | 1, string, string][],
}

it('keeps the weekly services (confession windows out), normalized', () => {
  const d = embedData({ church: CHURCH, entry: ENTRY, today: '2026-07-03' })
  expect(d.s.map((r) => r.slice(0, 5))).toEqual([
    ['7', '09:00', 'latinsky', 'mše sv.', ''],
    ['5', '18:00', 'česky', 'bohoslužba (řeckokatolická)', 'kromě července'],
  ])
})

it('keeps only upcoming one-offs, and names the page and source date', () => {
  const d = embedData({ church: CHURCH, entry: ENTRY, today: '2026-07-03' })
  expect(d.x).toEqual([['2026-07-05', '15:00', 'česky', 'pobožnost', '']])
  expect(d).toMatchObject({ v: 1, id: '1', name: 'kostel sv. Havla', url: 'https://bohosluzby.dravec.org/kostel/1/', updated: '2026-06-01' })
})

it('stays small', () => {
  expect(JSON.stringify(embedData({ church: CHURCH, entry: ENTRY, today: '2026-07-03' })).length).toBeLessThan(700)
})

it('a note-limited service carries a run mask from the build date, computed by the app’s note parser', () => {
  // 3 Jul 2026 (Friday) build: "kromě července" Fridays don't run in July; "pouze v adventu" never in July
  const d = embedData({
    church: CHURCH,
    entry: {
      ...ENTRY,
      s: [
        ['5', '18:00', 'česky', 0, 'mše sv.', 'kromě července'],
        ['7', '06:30', 'česky', 0, 'rorátní mše sv.', 'pouze v adventu'],
        ['7', '09:00', 'česky', 0, 'mše sv.', ''],
      ],
    },
    today: '2026-07-03',
  })
  expect(d.from).toBe('2026-07-03')
  const [fri, rorate, plain] = d.s
  expect(fri[5]).toHaveLength(60)
  expect(fri[5]![0]).toBe('0') // Fri 3 Jul — July excluded
  expect(fri[5]![35]).toBe('1') // Fri 7 Aug runs
  expect(rorate[5]).toBe('0'.repeat(60))
  expect(plain[5]).toBeUndefined() // no note → the weekday rule is enough
})

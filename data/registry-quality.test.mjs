import { qualityReport, toCsv, toMarkdown } from './registry-quality.mjs'

const INDEX = [
  ['1', 'kostel A', 'Praha', 50, 14],
  ['2', 'kostel B', 'Brno', 49, 16],
  ['3', 'kostel "C"', 'Brno', 49, 16],
]
const SHARDS = {
  '1': { u: '2026-06-01', p: 'Farnost A', s: [['7', '09:00', 'česky', 0, 'mše sv.', '']] },
  '2': {
    u: '2016-09-06',
    p: 'Farnost B',
    s: [
      ['7', '10:00', 'česky', 0, 'mše sv.', ''],
      ['7', '10:00', 'česky', 0, 'mše sv.', 'varianta'],
      ['5', '18:00', 'česky', 0, 'mše sv.', 'nepravidelně'],
    ],
  },
  '3': { u: '2024-01-10', p: 'Farnost B', s: [['7', '08:00', 'česky', 0, 'mše sv.', '']] },
}
const NOW = new Date('2026-10-07')

test('counts stale entries by the app’s 18-month rule, oldest first, grouped by parish', () => {
  const r = qualityReport(INDEX, SHARDS, NOW)
  expect(r.stale.map((s) => s.id)).toEqual(['2', '3'])
  expect(r.parishes).toEqual([{ parish: 'Farnost B', churches: 2 }])
  expect(r.cutoff).toBe('2025-04-07')
})

test('finds duplicate slots and vague notes', () => {
  const r = qualityReport(INDEX, SHARDS, NOW)
  expect(r.duplicates).toEqual([{ id: '2', name: 'kostel B', city: 'Brno', slot: '7 10:00 mše sv.' }])
  expect(r.vague).toHaveLength(1)
})

test('markdown states counts and shares; csv quotes registry text', () => {
  const r = qualityReport(INDEX, SHARDS, NOW)
  const md = toMarkdown(r, 5, '2026-10-07')
  expect(md).toContain('| Pořad neaktualizovaný déle než 18 měsíců (před 2025-04-07) | 2 | 67 % |')
  expect(md).toContain('| Nefunkční web farnosti (3 pokusy, DNS nebo 404) | 5 | — |')
  const csv = toCsv(r)
  expect(csv.split('\n')[0]).toBe('id,kostel,obec,farnost,posledni_aktualizace,odkaz')
  expect(csv).toContain('"kostel ""C"""')
})

import { decodeShard } from './data'

it('decodeShard keeps one-off confessions out of extra', () => {
  const shard = {
    '1': { u: '2026-06-01', s: [], x: [['2026-07-04', '16:00', 'česky', 0, 'svátost smíření', '']] },
  } as unknown as Parameters<typeof decodeShard>[0]
  expect(decodeShard(shard).get('1')!.extra).toEqual([])
})

import { describe, expect, it } from 'vitest'
import { gridCluster } from './cluster'

describe('gridCluster', () => {
  it('groups points sharing a grid cell, keeps loners as singletons', () => {
    const clusters = gridCluster(
      [
        { x: 10, y: 10, item: 'a' },
        { x: 20, y: 30, item: 'b' }, // same 64px cell as a
        { x: 200, y: 200, item: 'c' }, // far away
      ],
      64,
    )
    expect(clusters).toHaveLength(2)
    const pair = clusters.find((c) => c.items.length === 2)!
    expect(pair.items.sort()).toEqual(['a', 'b'])
    expect(pair.x).toBe(15) // centroid
    expect(pair.y).toBe(20)
    expect(clusters.find((c) => c.items.length === 1)!.items).toEqual(['c'])
  })

  it('cell boundaries split: 63 vs 64 land in different cells', () => {
    const clusters = gridCluster(
      [
        { x: 63, y: 0, item: 'a' },
        { x: 64, y: 0, item: 'b' },
      ],
      64,
    )
    expect(clusters).toHaveLength(2)
  })

  it('handles negative projected coordinates (west/north of origin)', () => {
    const clusters = gridCluster(
      [
        { x: -10, y: -10, item: 'a' },
        { x: -20, y: -30, item: 'b' },
        { x: 10, y: 10, item: 'c' }, // other side of the origin — different cell
      ],
      64,
    )
    expect(clusters).toHaveLength(2)
    expect(clusters.find((c) => c.items.length === 2)!.items.sort()).toEqual(['a', 'b'])
  })

  it('empty input → empty output', () => {
    expect(gridCluster([], 64)).toEqual([])
  })
})

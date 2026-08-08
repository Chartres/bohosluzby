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

describe('gridCluster pan-invariance (regression: chips drifted on pan)', () => {
  // The map bug: clustering ran over the viewport subset, so a cell at the
  // edge gained/lost members as you panned and its centroid shifted. The fix
  // feeds ALL churches every render; this pins the property the fix relies on —
  // a point's bucket and centroid depend ONLY on the points in its own cell,
  // never on far points elsewhere.
  it('a distant point never perturbs another cell\'s bucket or centroid', () => {
    const near = [
      { x: 10, y: 10, item: 'a' },
      { x: 20, y: 20, item: 'b' },
    ]
    const withFar = [...near, { x: 5000, y: 5000, item: 'far' }]
    const cellPx = 64
    const a = gridCluster(near, cellPx).find((c) => c.items.includes('a'))!
    const b = gridCluster(withFar, cellPx).find((c) => c.items.includes('a'))!
    expect(b.items.sort()).toEqual(a.items.sort())
    expect(b.x).toBe(a.x)
    expect(b.y).toBe(a.y)
  })
})

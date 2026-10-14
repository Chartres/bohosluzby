// Grid clustering for map markers: bucket projected pixel points into square
// cells; a bucket of one renders as a marker, more as a count cluster at the
// bucket's centroid. O(n) per map move — plenty for 3 991 churches.
// ponytail: no leaflet.markercluster — its default look fights the design
// brief and a grid is ~20 lines; swap in the plugin if spiderfying is ever needed.

export interface Point<T> {
  x: number
  y: number
  item: T
}

export interface Cluster<T> {
  x: number
  y: number
  items: T[]
}

export function gridCluster<T>(points: Point<T>[], cellPx: number): Cluster<T>[] {
  const buckets = new Map<string, Cluster<T>>()
  for (const p of points) {
    const key = `${Math.floor(p.x / cellPx)}:${Math.floor(p.y / cellPx)}`
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { x: 0, y: 0, items: [] }))
    b.x += p.x
    b.y += p.y
    b.items.push(p.item)
  }
  for (const b of buckets.values()) {
    b.x /= b.items.length
    b.y /= b.items.length
  }
  return [...buckets.values()]
}

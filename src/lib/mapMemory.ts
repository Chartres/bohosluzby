// The map's last view, kept in memory for the life of the page. Opening a
// church unmounts the map; without this the way back rebuilt it centred on the
// origin and lost where you had panned (friends' feedback, 2026-10-21). A new
// origin (fresh GPS fix, another city) is a fresh start: the view is keyed on it.
// Memory only, not storage: a cold start should open on where you are now.

type LatLng = { lat: number; lng: number }

interface MapMemory {
  origin: string
  center: [number, number]
  zoom: number
  /** church whose popover to reopen on return: set by "otevřít", cleared once reopened */
  reopen: string | null
}

let mem: MapMemory | null = null
const key = (o: LatLng) => `${o.lat},${o.lng}`

export function recallView(origin: LatLng): Readonly<MapMemory> | null {
  return mem && mem.origin === key(origin) ? mem : null
}

/** Remember the view; `reopen` undefined keeps the church already remembered. */
export function rememberView(origin: LatLng, center: [number, number], zoom: number, reopen?: string): void {
  const same = recallView(origin)
  mem = { origin: key(origin), center, zoom, reopen: reopen ?? same?.reopen ?? null }
}

export function clearReopen(): void {
  if (mem) mem.reopen = null
}

export function resetMapMemory(): void {
  mem = null
}

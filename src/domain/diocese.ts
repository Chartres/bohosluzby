// The diocese of a church, read from its registry id: bohosluzby.cirkev.cz
// numbers each diocese's churches from its own prefix (ids of 5–8 digits:
// 1 Praha, 2 Litoměřice; longer ids: 3 Hradec Králové … 8 Brno). Checked
// against the towns in each block (Plzeň, Cheb → 6; Třinec, Havířov → 5…).
// The /dusicky/ hub groups its towns by it — the Schematismus's own order.
// Import-free: scripts/prerender.mjs runs it via type stripping.

export interface Diocese {
  key: string
  name: string
  /** Where it is, for someone who doesn't know church geography. */
  area: string
}

// Bohemia west to east, then Moravia — the order the ČBK lists them in
export const DIOCESES: Diocese[] = [
  { key: '1', name: 'Arcidiecéze pražská', area: 'Praha a většina středních Čech' },
  { key: '2', name: 'Diecéze litoměřická', area: 'severní Čechy: Ústecko, Liberecko, Mladoboleslavsko' },
  { key: '3', name: 'Diecéze královéhradecká', area: 'východní Čechy: Královéhradecko, Pardubicko, Havlíčkobrodsko' },
  { key: '4', name: 'Diecéze českobudějovická', area: 'jižní Čechy a Pelhřimovsko' },
  { key: '6', name: 'Diecéze plzeňská', area: 'západní Čechy: Plzeňsko, Karlovarsko' },
  { key: '8', name: 'Diecéze brněnská', area: 'jižní Morava a většina Vysočiny' },
  { key: '7', name: 'Arcidiecéze olomoucká', area: 'střední Morava a Zlínsko' },
  { key: '5', name: 'Diecéze ostravsko-opavská', area: 'Moravskoslezsko a Jesenicko' },
]

/** The diocese key of one church id, or '' when the id doesn't follow the scheme. */
export function dioceseKey(id: string): string {
  const k = id[0] ?? ''
  return DIOCESES.some((d) => d.key === k) ? k : ''
}

/** A town's diocese: the one most of its churches belong to. */
export function dioceseOfTown(churchIds: string[]): string {
  const n = new Map<string, number>()
  for (const id of churchIds) {
    const k = dioceseKey(id)
    if (k) n.set(k, (n.get(k) ?? 0) + 1)
  }
  let best = ''
  for (const [k, c] of n) if (!best || c > n.get(best)!) best = k
  return best
}

// Registry-data rules shared by the app and the Node prerender
// (scripts/prerender.mjs runs .ts via type stripping, which needs import-free
// modules or explicit .ts specifiers — so these live here with no imports).

/** Registry language values are inconsistent endonyms ("Latine", "po polsku",
 * "deutsch"…); normalize to Czech lowercase adverbs so chips and filters read
 * like one voice. Applied once at shard decode. */
const LANG_MAP: Record<string, string> = {
  '': 'česky',
  'česky': 'česky',
  'čeština': 'česky',
  latine: 'latinsky',
  latina: 'latinsky',
  'latinsky (trident)': 'latinsky (tridentská)',
  english: 'anglicky',
  italiana: 'italsky',
  'en español': 'španělsky',
  'en français': 'francouzsky',
  filipino: 'filipínsky',
  magyarul: 'maďarsky',
  'po polsku': 'polsky',
  'viet nam': 'vietnamsky',
  deutsch: 'německy',
}

export function normalizeLang(raw: string): string {
  const key = raw.trim().toLowerCase()
  return LANG_MAP[key] ?? key
}

// ponytail: registry type is free text; confession comes as "svátost smíření"
// (case varies). Trim + case-insensitive exact match keeps note-mentions of
// confession — which live in a Mass row's note, not its type — untouched.
export const isConfession = (type: string): boolean => /^svátost smíření$/i.test(type.trim())

/** Registry entry older than 18 months → the schedule is a verify-before-you-go
 * warning, not a promise (shared by the list rows, the detail and the
 * prerendered church pages). */
export function isStale(iso: string, now = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return false
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - 18)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) < cutoff
}

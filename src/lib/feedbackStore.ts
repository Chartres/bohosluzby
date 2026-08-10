// The write/read seam for pilgrim-witness feedback. v1 is localStorage-only so
// the whole UX is testable locally; the shapes match the planned Supabase table.
// docs/PILGRIM-WITNESS-PLAN.md: one row per device per Mass, thresholded reads.

import { WITNESS_CHIPS, type Aggregate, type MassFeedback } from '../domain/feedback'

// A tag appears on the detail page only after this many independent witnesses.
// Prod value is 3 (a single device publishes nothing). Local prototype uses 1
// so the owner sees their own submissions while toying.
// TODO(prod): set CORROBORATION_MIN = 3
export const CORROBORATION_MIN = 1

const STORE_KEY = 'bohosluzby:massFeedback'
const SUGGEST_KEY = 'bohosluzby:tagSuggestions'

interface StoredSubmission {
  churchId: string
  massKey: string
  chips: string[]
  lang: string | null
}

function read(): StoredSubmission[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? (list as StoredSubmission[]) : []
  } catch {
    return []
  }
}

function write(list: StoredSubmission[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list))
  } catch {
    /* private mode */
  }
}

/** Persist one Mass submission. One row per device per massKey (upsert). */
export function submitFeedback(submission: MassFeedback): void {
  // TODO(prod): POST to Supabase Edge Function submit-feedback (Turnstile token +
  // per-device rate limit + DB upsert), instead of writing localStorage.
  const list = read()
  const row: StoredSubmission = {
    churchId: submission.churchId,
    massKey: submission.massKey,
    chips: submission.chips,
    lang: submission.lang,
  }
  const i = list.findIndex((s) => s.massKey === submission.massKey)
  if (i >= 0) list[i] = row
  else list.push(row)
  write(list)
}

/** Per-Mass rollup for one church: witness counts + chips at/over the threshold. */
export function aggregateFor(churchId: string): Map<string, Aggregate> {
  const byKey = new Map<string, { witnesses: number; counts: Map<string, number> }>()
  for (const s of read()) {
    if (s.churchId !== churchId) continue
    const a = byKey.get(s.massKey) ?? { witnesses: 0, counts: new Map<string, number>() }
    a.witnesses += 1
    for (const id of s.chips) a.counts.set(id, (a.counts.get(id) ?? 0) + 1)
    byKey.set(s.massKey, a)
  }
  const out = new Map<string, Aggregate>()
  for (const [massKey, a] of byKey) {
    const chips = WITNESS_CHIPS.filter((c) => (a.counts.get(c.id) ?? 0) >= CORROBORATION_MIN).map(
      (c) => ({ id: c.id, count: a.counts.get(c.id)! }),
    )
    out.set(massKey, { massKey, witnesses: a.witnesses, chips })
  }
  return out
}

/** A suggested tag — stored privately, never published. */
export function suggestTag(text: string): void {
  // TODO(prod): route to Pavol (private channel) to grow the vocabulary.
  const t = text.trim()
  if (!t) return
  try {
    const raw = localStorage.getItem(SUGGEST_KEY)
    const list = raw ? (JSON.parse(raw) as unknown[]) : []
    ;(list as { text: string; at: string }[]).push({ text: t, at: new Date().toISOString() })
    localStorage.setItem(SUGGEST_KEY, JSON.stringify(list))
  } catch {
    /* private mode */
  }
}

// The write/read seam for pilgrim-witness feedback. Backed by Supabase table
// public.mass_feedback (one row per device per Mass, RLS anon insert/update/select);
// a localStorage mirror keeps the answered/dedup state and lets the whole UX work
// offline. docs/PILGRIM-WITNESS-PLAN.md: positive-only chips, thresholded reads.

import { WITNESS_CHIPS, type Aggregate, type MassFeedback } from '../domain/feedback'
import { supabase } from './supabase'
import { resolveIds } from '../platform/flywheel-client'

// A tag appears on the detail page only after this many independent witnesses.
// Prod value is 3 (a single device publishes nothing). Local prototype uses 1
// so the owner sees their own submissions while toying.
// TODO(prod): set CORROBORATION_MIN = 3
export const CORROBORATION_MIN = 1

const STORE_KEY = 'bohosluzby:massFeedback'
const SUGGEST_KEY = 'bohosluzby:tagSuggestions'

/** One witness row, in the shape aggregation reads (matches the DB columns). */
interface Row {
  churchId: string
  massKey: string
  deviceId: string
  chips: string[]
}

function deviceId(): string {
  return resolveIds().visitor_id
}

function read(): Row[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? (list as Row[]) : []
  } catch {
    return []
  }
}

function write(list: Row[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list))
  } catch {
    /* private mode */
  }
}

// In-memory rollup cache, filled by loadAggregates(), read synchronously by
// aggregateFor(). Empty until a load resolves for that church.
const cache = new Map<string, Map<string, Aggregate>>()

/** Fold witness rows into per-church, per-Mass aggregates over the threshold. */
function aggregate(rows: Row[]): Map<string, Map<string, Aggregate>> {
  // churchId → massKey → { distinct devices, per-chip counts }
  const acc = new Map<string, Map<string, { devices: Set<string>; counts: Map<string, number> }>>()
  for (const r of rows) {
    const byMass = acc.get(r.churchId) ?? new Map()
    const a = byMass.get(r.massKey) ?? { devices: new Set<string>(), counts: new Map<string, number>() }
    a.devices.add(r.deviceId)
    for (const id of r.chips) a.counts.set(id, (a.counts.get(id) ?? 0) + 1)
    byMass.set(r.massKey, a)
    acc.set(r.churchId, byMass)
  }
  const out = new Map<string, Map<string, Aggregate>>()
  for (const [churchId, byMass] of acc) {
    const m = new Map<string, Aggregate>()
    for (const [massKey, a] of byMass) {
      const chips = WITNESS_CHIPS.filter((c) => (a.counts.get(c.id) ?? 0) >= CORROBORATION_MIN).map(
        (c) => ({ id: c.id, count: a.counts.get(c.id)! }),
      )
      m.set(massKey, { massKey, witnesses: a.devices.size, chips })
    }
    out.set(churchId, m)
  }
  return out
}

/** Fetch visible witness rows for the given churches and refresh the cache.
 * Supabase when configured; localStorage mirror otherwise (offline / tests). */
export async function loadAggregates(churchIds: string[]): Promise<void> {
  const ids = [...new Set(churchIds)].filter(Boolean)
  if (ids.length === 0) return
  let rows: Row[]
  if (supabase) {
    const { data, error } = await supabase
      .from('mass_feedback')
      .select('church_id,mass_key,device_id,chips')
      .eq('status', 'visible')
      .in('church_id', ids)
    if (error) return // leave the cache as-is; the UI just shows no line
    rows = (data ?? []).map((d) => ({
      churchId: d.church_id as string,
      massKey: d.mass_key as string,
      deviceId: d.device_id as string,
      chips: (d.chips as string[] | null) ?? [],
    }))
  } else {
    rows = read().filter((r) => ids.includes(r.churchId))
  }
  const rolled = aggregate(rows)
  // Set every requested church (default empty) so aggregateFor never returns stale data.
  for (const id of ids) cache.set(id, rolled.get(id) ?? new Map())
}

/** Persist one Mass submission. One row per device per massKey (upsert).
 * Writes the localStorage mirror always; Supabase too when configured. */
export function submitFeedback(submission: MassFeedback): void {
  const device = deviceId()
  const row: Row = {
    churchId: submission.churchId,
    massKey: submission.massKey,
    deviceId: device,
    chips: submission.chips,
  }
  const list = read()
  const i = list.findIndex((s) => s.churchId === row.churchId && s.massKey === row.massKey)
  if (i >= 0) list[i] = row
  else list.push(row)
  write(list)

  if (supabase) {
    supabase
      .from('mass_feedback')
      .upsert(
        {
          app: 'bohosluzby',
          church_id: row.churchId,
          mass_key: row.massKey,
          device_id: row.deviceId,
          chips: row.chips,
          status: 'visible',
        },
        { onConflict: 'church_id,mass_key,device_id' },
      )
      .then(
        () => void loadAggregates([row.churchId]), // refresh the church after a submit
        () => {},
      )
  } else {
    void loadAggregates([row.churchId])
  }
}

/** Per-Mass rollup for one church, read synchronously from the cache
 * (empty until loadAggregates([churchId]) resolves). */
export function aggregateFor(churchId: string): Map<string, Aggregate> {
  return cache.get(churchId) ?? new Map()
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

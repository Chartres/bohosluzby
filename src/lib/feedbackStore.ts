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

/** Two directness tiers for one church: the per-Mass slot aggregates (specific)
 * and one church-wide aggregate folding every Mass (ambient). */
export interface ChurchAggregate {
  slots: Map<string, Aggregate>
  church: Aggregate
}

// In-memory rollup cache, filled by loadAggregates(), read synchronously by
// aggregateFor(). Empty until a load resolves for that church.
const cache = new Map<string, ChurchAggregate>()

interface Tally {
  devices: Set<string>
  counts: Map<string, number>
}
const emptyTally = (): Tally => ({ devices: new Set<string>(), counts: new Map<string, number>() })
const bump = (a: Tally, r: Row) => {
  a.devices.add(r.deviceId)
  for (const id of r.chips) a.counts.set(id, (a.counts.get(id) ?? 0) + 1)
}

/** A Tally → Aggregate: chips over the corroboration floor, ordered by frequency
 * (most-mentioned first; ties keep the locked display order for stability). */
function roll(key: string, a: Tally): Aggregate {
  const order = new Map(WITNESS_CHIPS.map((c, i) => [c.id, i]))
  const chips = WITNESS_CHIPS.map((c) => c.id)
    .filter((id) => (a.counts.get(id) ?? 0) >= CORROBORATION_MIN)
    .map((id) => ({ id, count: a.counts.get(id)! }))
    .sort((x, y) => y.count - x.count || order.get(x.id)! - order.get(y.id)!)
  return { massKey: key, witnesses: a.devices.size, chips }
}

/** Fold witness rows into two tiers per church: slot (group by mass_key) and
 * church (group by church_id, every Mass together). */
function aggregate(rows: Row[]): Map<string, ChurchAggregate> {
  const bySlot = new Map<string, Map<string, Tally>>() // churchId → massKey → tally
  const byChurch = new Map<string, Tally>() // churchId → tally (all masses)
  for (const r of rows) {
    const slots = bySlot.get(r.churchId) ?? new Map<string, Tally>()
    const slot = slots.get(r.massKey) ?? emptyTally()
    bump(slot, r)
    slots.set(r.massKey, slot)
    bySlot.set(r.churchId, slots)

    const ch = byChurch.get(r.churchId) ?? emptyTally()
    bump(ch, r)
    byChurch.set(r.churchId, ch)
  }
  const out = new Map<string, ChurchAggregate>()
  for (const [churchId, slots] of bySlot) {
    const m = new Map<string, Aggregate>()
    for (const [massKey, t] of slots) m.set(massKey, roll(massKey, t))
    out.set(churchId, { slots: m, church: roll(churchId, byChurch.get(churchId)!) })
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
  for (const id of ids) cache.set(id, rolled.get(id) ?? emptyChurchAggregate(id))
}

const emptyChurchAggregate = (churchId: string): ChurchAggregate => ({
  slots: new Map<string, Aggregate>(),
  church: { massKey: churchId, witnesses: 0, chips: [] },
})

/** Persist one Mass submission. One row per device per massKey.
 * Writes the localStorage mirror always (offline/dedup); when Supabase is
 * configured the write goes through the submit-feedback Edge Function — the only
 * anon-writable path (direct table INSERT/UPDATE is revoked). */
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
    supabase.functions
      .invoke('submit-feedback', {
        body: {
          church_id: submission.churchId,
          mass_key: submission.massKey,
          device_id: device,
          chips: submission.chips,
          weekday: submission.weekday,
          mass_time: submission.time,
          rite: submission.rite,
          lang: submission.lang,
          mass_date: submission.massDate,
        },
      })
      .then(
        () => void loadAggregates([row.churchId]), // refresh the church after a submit
        () => {},
      )
  } else {
    void loadAggregates([row.churchId])
  }
}

/** Both directness tiers for one church, read synchronously from the cache
 * (empty until loadAggregates([churchId]) resolves). */
export function aggregateFor(churchId: string): ChurchAggregate {
  return cache.get(churchId) ?? emptyChurchAggregate(churchId)
}

/** Rank a church's chips by corroboration × distinctiveness and keep the top
 * `max`. Distinctiveness down-weights a tag that is common across all currently
 * loaded churches, so "rodinná atmosféra" everywhere counts for less than a tag
 * that marks this church out: weight = count / (1 + prevalence), where prevalence
 * is the number of loaded churches whose church-wide tier carries the tag. With
 * fewer than two churches to compare there is no notion of "common everywhere",
 * so we fall back to raw count (already frequency-ordered). Pure over its inputs
 * so the ranking is unit-testable; rankChurchTags() feeds it from the cache. */
export function rankDistinctive(
  target: { id: string; count: number }[],
  corpus: { id: string }[][],
  max = 3,
): { id: string; count: number }[] {
  if (corpus.length < 2) return target.slice(0, max)
  const prevalence = new Map<string, number>()
  for (const chips of corpus) for (const c of chips) prevalence.set(c.id, (prevalence.get(c.id) ?? 0) + 1)
  const order = new Map(WITNESS_CHIPS.map((c, i) => [c.id, i]))
  const weight = (c: { id: string; count: number }) => c.count / (1 + (prevalence.get(c.id) ?? 0))
  return [...target]
    .sort((a, b) => weight(b) - weight(a) || b.count - a.count || order.get(a.id)! - order.get(b.id)!)
    .slice(0, max)
}

/** The church-level block's tags: the church-wide tier ranked by distinctiveness
 * against every loaded church, capped at `max` (default 3, the inflation cap). */
export function rankChurchTags(churchId: string, max = 3): { id: string; count: number }[] {
  const target = aggregateFor(churchId).church.chips
  const corpus = [...cache.values()].map((c) => c.church.chips).filter((chips) => chips.length > 0)
  return rankDistinctive(target, corpus, max)
}

/** A specific Mass's tags worth calling out because they diverge from the
 * church-level block: chips attested at this slot that the church block does not
 * already surface (its ranked top tags). Captures both "this Mass's top tag
 * differs" and "a tag strong here but not church-wide". Empty = say nothing. */
export function divergentChips(
  slot: Aggregate | undefined,
  churchTopIds: Iterable<string>,
  max = 2,
): { id: string; count: number }[] {
  if (!slot) return []
  const top = new Set(churchTopIds)
  return slot.chips.filter((c) => !top.has(c.id)).slice(0, max)
}

const hasAll = (a: Aggregate | undefined, tags: string[]): boolean =>
  !!a && tags.every((tg) => a.chips.some((c) => c.id === tg))

/** Does this church carry ALL the given witness tags — at the given Mass's slot
 * tier, or church-wide (any Mass) when `massKey` is null? Both tiers are already
 * thresholded, so a tag present means it cleared the floor. Empty tags = match. */
export function churchHasTags(churchId: string, massKey: string | null, tags: string[]): boolean {
  if (tags.length === 0) return true
  const { slots, church } = aggregateFor(churchId)
  if (hasAll(church, tags)) return true
  if (massKey) return hasAll(slots.get(massKey), tags)
  for (const a of slots.values()) if (hasAll(a, tags)) return true
  return false
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

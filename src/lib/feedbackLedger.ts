// Local ledger of masses this device is expected to have attended (reminder-set
// or viewed near Mass time). Seeds the after-Mass card. localStorage only —
// docs/PILGRIM-WITNESS-PLAN.md keeps the cohort on-device, no location check.

import type { Occurrence } from '../domain/feedback'
import { readList, writeJson } from './storage'

/** How long after a Mass starts before we ask "were you there?". */
export const DUE_AFTER_MIN = 60

export interface LedgerEntry extends Occurrence {
  churchId: string
  massKey: string
  /** ISO start of the specific occurrence. */
  startISO: string
  churchName: string
  type: string
  answered?: boolean
}

const LEDGER_KEY = 'bohosluzby:massLedger'
const NEVER_ASK_KEY = 'bohosluzby:massNeverAsk'
/** Answered entries older than this are dropped on every write. */
const PRUNE_AFTER_MS = 7 * 86_400_000

const read = (): LedgerEntry[] => readList<LedgerEntry>(LEDGER_KEY)

function write(list: LedgerEntry[]): void {
  // Prune answered entries older than PRUNE_AFTER_MS to bound ledger growth.
  const cutoff = Date.now() - PRUNE_AFTER_MS
  writeJson(
    LEDGER_KEY,
    list.filter((e) => !e.answered || new Date(e.startISO).getTime() > cutoff),
  )
}

/** Record one expected attendance. One entry per massKey — a mass already in the
 * ledger (answered or not) is left as-is. */
export function recordExpectedAttendance(entry: Omit<LedgerEntry, 'answered'>): void {
  const list = read()
  if (list.some((e) => e.massKey === entry.massKey)) return
  list.push({ ...entry })
  write(list)
}

export function isNeverAsk(): boolean {
  try {
    return localStorage.getItem(NEVER_ASK_KEY) === '1'
  } catch {
    return false
  }
}

export function neverAsk(): void {
  try {
    localStorage.setItem(NEVER_ASK_KEY, '1')
  } catch {
    /* private mode */
  }
}

/** Entries whose Mass started ≥DUE_AFTER_MIN ago, not yet answered, with the
 * global "Neptat se" off. Soonest-first. The caller shows one at a time. */
export function dueCards(now: Date): LedgerEntry[] {
  if (isNeverAsk()) return []
  const cutoff = now.getTime() - DUE_AFTER_MIN * 60_000
  return read()
    .filter((e) => !e.answered && new Date(e.startISO).getTime() <= cutoff)
    .sort((a, b) => a.startISO.localeCompare(b.startISO))
}

export function markAnswered(massKey: string): void {
  const list = read()
  let changed = false
  for (const e of list) {
    if (e.massKey === massKey && !e.answered) {
      e.answered = true
      changed = true
    }
  }
  if (changed) write(list)
}

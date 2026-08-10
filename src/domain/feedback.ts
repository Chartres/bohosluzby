// Pilgrim-witness vocabulary + the stable key that groups submissions and
// aggregates by Mass. docs/PILGRIM-WITNESS-PLAN.md: positive-only witness chips,
// no scale, no opposite — a wall with no way to say anything unkind.

import { pragueToday } from './occurrences'

export interface Chip {
  /** Stable ascii id (stored, aggregated). */
  id: string
  /** Canonical Czech label. Like service types and feast names, the witness
   * vocabulary is domain data and is not translated (see i18n.ts). */
  label: string
}

// LOCKED launch set (7 positive witness chips). Array order is display order.
export const WITNESS_CHIPS: readonly Chip[] = [
  { id: 'hluboky_prozitek', label: 'hluboký prožitek' },
  { id: 'dotklo_se_me_kazani', label: 'dotklo se mě kázání' },
  { id: 'krasny_zpev', label: 'krásný zpěv' },
  { id: 'vrele_prijeti', label: 'vřelé přijetí' },
  { id: 'vstricne_k_detem', label: 'vstřícné k dětem' },
  { id: 'rodinna_atmosfera', label: 'rodinná atmosféra' },
  { id: 'dustojna_atmosfera', label: 'důstojná atmosféra' },
] as const

/** The one factual chip (single-select). Values double as stored ids. */
export const LANG_OPTIONS = ['česky', 'latinsky', 'anglicky', 'jinak'] as const
export type LangOption = (typeof LANG_OPTIONS)[number]

export const chipLabel = (id: string): string =>
  WITNESS_CHIPS.find((c) => c.id === id)?.label ?? id

/** One device's contribution for one Mass. */
export interface MassFeedback {
  churchId: string
  massKey: string
  /** Selected witness chip ids (may be empty — attending is itself the witness). */
  chips: string[]
  lang: LangOption | null
}

/** Thresholded per-Mass rollup for the detail display. */
export interface Aggregate {
  massKey: string
  /** How many pilgrims attested this Mass ("potvrdilo N poutníků"). */
  witnesses: number
  /** Chips at or above CORROBORATION_MIN, in display order. */
  chips: { id: string; count: number }[]
}

/** Minimal Mass shape massKey needs — a regular service (weekday set) or a
 * one-off "extra" (ISO date). */
export type MassRef = { time: string; days?: string; date?: string }

export const slotKey = (churchId: string, weekday: number, time: string): string =>
  `${churchId}|w${weekday}|${time}`

export const oneOffKey = (churchId: string, date: string, time: string): string =>
  `${churchId}|d${date}|${time}`

/** ISO weekday (1=Mon…7=Sun) of an instant on the Prague wall clock. */
function pragueIsoWeekday(when: Date): number {
  const { y, m, d } = pragueToday(when)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow === 0 ? 7 : dow
}

/**
 * Stable grouping key for a Mass. Regular masses group by weekday+time slot (so
 * every Sunday 09:00 is one profile); one-off "extra" masses key on their ISO
 * date. `attendedDate` supplies the weekday for regular masses.
 */
export function massKey(churchId: string, service: MassRef, attendedDate: Date): string {
  if (service.date) return oneOffKey(churchId, service.date, service.time)
  return slotKey(churchId, pragueIsoWeekday(attendedDate), service.time)
}

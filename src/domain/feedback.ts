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

export const chipLabel = (id: string): string =>
  WITNESS_CHIPS.find((c) => c.id === id)?.label ?? id

/** Liturgical rite of a Mass — Byzantine (Greek-Catholic), Latin (usus antiquior
 * or explicitly Latin), or the ordinary form. Different rites at the same slot
 * are different Masses, so the key must separate them. */
export type Rite = 'byz' | 'lat' | 'ord'

/** The write-path descriptor of one attended occurrence — the columns the
 * submit-feedback Edge Function stores alongside the chips. */
export interface Occurrence {
  /** ISO weekday 1=Mon…7=Sun (Prague wall clock). */
  weekday: number
  /** "HH:MM" Prague wall clock (the `mass_time` column). */
  time: string
  rite: Rite
  /** Normalized Czech language adverb ("česky", "latinsky"…). */
  lang: string
  /** ISO date the Mass was attended ("YYYY-MM-DD" Prague, the `mass_date` column). */
  massDate: string
}

/** One device's contribution for one Mass. */
export interface MassFeedback extends Occurrence {
  churchId: string
  massKey: string
  /** Selected witness chip ids (may be empty — attending is itself the witness). */
  chips: string[]
}

/** Thresholded per-Mass rollup for the detail display. */
export interface Aggregate {
  massKey: string
  /** How many pilgrims attested this Mass ("potvrdilo N poutníků"). */
  witnesses: number
  /** Chips at or above CORROBORATION_MIN, ordered by frequency (most first). */
  chips: { id: string; count: number }[]
}

/** Minimal Mass shape the key + occurrence need — a regular service (weekday
 * set) or a one-off "extra" (ISO date), carrying the rite/language signals. */
export type MassRef = { time: string; lang: string; greek: boolean; days?: string; date?: string }

/** Byzantine if Greek-Catholic; Latin if the language is Latin (incl. the
 * tridentská variant); ordinary form otherwise. */
export const riteOf = (s: { greek: boolean; lang: string }): Rite =>
  s.greek ? 'byz' : /^latin/i.test(s.lang) || s.lang === 'Latine' ? 'lat' : 'ord'

export const slotKey = (
  churchId: string,
  weekday: number,
  time: string,
  rite: Rite,
  lang: string,
): string => `${churchId}|w${weekday}|${time}|${rite}|${lang}`

export const oneOffKey = (
  churchId: string,
  date: string,
  time: string,
  rite: Rite,
  lang: string,
): string => `${churchId}|d${date}|${time}|${rite}|${lang}`

/** ISO weekday (1=Mon…7=Sun) of an instant on the Prague wall clock. */
function pragueIsoWeekday(when: Date): number {
  const { y, m, d } = pragueToday(when)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow === 0 ? 7 : dow
}

/** ISO date ("YYYY-MM-DD") of an instant on the Prague wall clock. */
function pragueIsoDate(when: Date): string {
  const { y, m, d } = pragueToday(when)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Stable grouping key for a Mass. Regular masses group by weekday+time+rite+lang
 * slot (so every Sunday 09:00 ordinary-form Czech is one profile, and a Latin
 * Mass at the same hour stays separate); one-off "extra" masses key on their ISO
 * date. `attendedDate` supplies the weekday for regular masses.
 */
export function massKey(churchId: string, service: MassRef, attendedDate: Date): string {
  const rite = riteOf(service)
  if (service.date) return oneOffKey(churchId, service.date, service.time, rite, service.lang)
  return slotKey(churchId, pragueIsoWeekday(attendedDate), service.time, rite, service.lang)
}

/** The write-path occurrence fields for a Mass attended on `attendedDate`. */
export function occurrenceOf(service: MassRef, attendedDate: Date): Occurrence {
  return {
    weekday: service.date ? pragueIsoWeekday(new Date(`${service.date}T${service.time}`)) : pragueIsoWeekday(attendedDate),
    time: service.time,
    rite: riteOf(service),
    lang: service.lang,
    massDate: service.date ?? pragueIsoDate(attendedDate),
  }
}

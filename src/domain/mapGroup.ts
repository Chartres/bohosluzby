// What a group of nearby churches shows on the map (Pavol, 2026-11-01): the
// same time chip a single church gets, drawn as a stack with a church-count
// badge, so "several churches here" never reads like "several Masses in this
// church" (that one stays the chip's "+N" superscript).
//
// The chip's colour follows the map legend: season accent when at least one
// church in the group matches the choice now; grey when they only match on
// another day; nothing (a faded dot) when none has anything.

import { pragueMinutes } from './occurrences'

/** A church's next matching service, as the map already computes it. */
export interface MemberNext {
  start: Date
  /** "hned" found it on a later day (grey chip, weekday prefix). */
  otherDay: boolean
  /** Not a Mass (růženec, adorace…): outlined chip. */
  nonMass: boolean
}

export type GroupPick =
  | { kind: 'none' }
  | { kind: 'chip'; index: number; otherDay: boolean; nonMass: boolean }

const KOLEM = /^(\d{2}):(\d{2})$/

/** Circular minutes between a service and "kolem HH:MM"; null when cas isn't a time. */
function distanceToCas(start: Date, cas: string | null): number | null {
  const m = cas ? KOLEM.exec(cas) : null
  if (!m) return null
  const d = Math.abs(pragueMinutes(start) - (+m[1] * 60 + +m[2]))
  return Math.min(d, 1440 - d)
}

/**
 * Which member's time the group chip shows. Today's matches beat other days;
 * a Mass beats a non-Mass service; then the time nearest to "kolem HH:MM"
 * (that is what "kolem" asks for), else the earliest. `hideOtherDay` drops
 * the grey candidates entirely (the legend toggle).
 */
export function pickGroupChip(
  members: readonly (MemberNext | undefined)[],
  cas: string | null,
  hideOtherDay = false,
): GroupPick {
  let best = -1
  const rank = (n: MemberNext) => [
    n.otherDay ? 1 : 0,
    n.nonMass ? 1 : 0,
    distanceToCas(n.start, cas) ?? 0,
    n.start.getTime(),
  ]
  const better = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
    return false
  }
  members.forEach((n, i) => {
    if (!n || (hideOtherDay && n.otherDay)) return
    if (best < 0 || better(rank(n), rank(members[best]!))) best = i
  })
  if (best < 0) return { kind: 'none' }
  const n = members[best]!
  return { kind: 'chip', index: best, otherDay: n.otherDay, nonMass: n.nonMass }
}

/** Zoom from which the map stops grouping churches by area and only stacks
 * the ones whose chips would sit on top of each other. */
export const CLOSE_ZOOM = 15

/** Grid cell in screen px: a finger-width at city scale; from CLOSE_ZOOM up,
 * only about a chip's height, so neighbours on one street get their own chips. */
export const clusterCellPx = (zoom: number): number => (zoom >= CLOSE_ZOOM ? 32 : 64)

/** Deepest zoom a tap on a group zooms to; at or beyond it a tap lists the churches. */
export const GROUP_MAX_ZOOM = 18

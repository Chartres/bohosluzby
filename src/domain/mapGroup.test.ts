import { describe, expect, it } from 'vitest'
import { clusterCellPx, CLOSE_ZOOM, pickGroupChip, type MemberNext } from './mapGroup'

// Sunday 1 Nov 2026, Prague = UTC+1
const at = (hhmm: string, day = '2026-11-01') => new Date(`${day}T${hhmm}:00+01:00`)
const m = (hhmm: string, extra: Partial<MemberNext> = {}): MemberNext => ({
  start: at(hhmm),
  otherDay: false,
  nonMass: false,
  ...extra,
})

describe('pickGroupChip', () => {
  it('no member has anything → none (the group draws as a faded dot)', () => {
    expect(pickGroupChip([undefined, undefined], '16:00')).toEqual({ kind: 'none' })
  })

  it('kolem 16:00: shows the time nearest to 16:00, not the earliest', () => {
    const p = pickGroupChip([m('15:00'), undefined, m('16:30'), m('16:00')], '16:00')
    expect(p).toEqual({ kind: 'chip', index: 3, otherDay: false, nonMass: false })
  })

  it('without a kolem time, the earliest wins', () => {
    expect(pickGroupChip([m('17:00'), m('08:30')], null)).toMatchObject({ index: 1 })
    expect(pickGroupChip([m('17:00'), m('08:30')], 'vecer')).toMatchObject({ index: 1 })
  })

  it('a match today beats a closer time on another day (gold over grey)', () => {
    const p = pickGroupChip(
      [{ start: at('16:00', '2026-11-04'), otherDay: true, nonMass: false }, m('17:30')],
      '16:00',
    )
    expect(p).toEqual({ kind: 'chip', index: 1, otherDay: false, nonMass: false })
  })

  it('only other days → a grey group chip', () => {
    const p = pickGroupChip([{ start: at('16:30', '2026-11-04'), otherDay: true, nonMass: false }, undefined], '16:00')
    expect(p).toEqual({ kind: 'chip', index: 0, otherDay: true, nonMass: false })
  })

  it('a Mass beats a non-Mass service at a nearer time', () => {
    expect(pickGroupChip([m('16:00', { nonMass: true }), m('17:00')], '16:00')).toMatchObject({ index: 1, nonMass: false })
  })

  it('hideOtherDay drops grey candidates: other-day-only groups disappear', () => {
    const grey = { start: at('16:30', '2026-11-04'), otherDay: true, nonMass: false }
    expect(pickGroupChip([grey], '16:00', true)).toEqual({ kind: 'none' })
    expect(pickGroupChip([grey, m('18:00')], '16:00', true)).toMatchObject({ index: 1 })
  })

  it('kolem distance is circular across midnight', () => {
    expect(pickGroupChip([m('21:00'), m('00:30')], '23:30')).toMatchObject({ index: 1 })
  })
})

describe('clusterCellPx', () => {
  it('groups by area below CLOSE_ZOOM, only near-overlaps from it', () => {
    expect(clusterCellPx(13)).toBe(64)
    expect(clusterCellPx(CLOSE_ZOOM - 1)).toBe(64)
    expect(clusterCellPx(CLOSE_ZOOM)).toBeLessThan(40)
    expect(clusterCellPx(18)).toBe(clusterCellPx(CLOSE_ZOOM))
  })
})

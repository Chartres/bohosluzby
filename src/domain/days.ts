// Day-picker choices and the ?den= query param — pure, no React.
// 'now' = soonest you can make; 0–6 (7 on Sundays) = that day's full ordo.
import type { DayChoice } from './ranking'
import { pragueToday } from './occurrences'
import { liturgicalDay, type LiturgicalDay } from './liturgical'
import { lang, t } from '../i18n'

const WEEKDAY_SHORT_CS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'] // Date.getUTCDay order
const WEEKDAY_SHORT_EN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
/** Read per call, not a constant — a test flipping navigator.language must see it on the next render. */
const weekdayShort = (dow: number): string => (lang() === 'cs' ? WEEKDAY_SHORT_CS : WEEKDAY_SHORT_EN)[dow]

/** The liturgical day for a day-picker choice ('now' = today). */
export function litForChoice(now: Date, day: DayChoice): LiturgicalDay {
  const today = pragueToday(now)
  const t = new Date(Date.UTC(today.y, today.m - 1, today.d) + (day === 'now' ? 0 : day) * 86_400_000)
  return liturgicalDay(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Picker options for the next week: hned · dnes · zítra · short weekday names
 * (Sunday spelled out — "kdy je v neděli mše?" is the planning question).
 * Feast days carry their name + color for the quiet picker highlight. */
export function dayOptions(now: Date): { key: DayChoice; label: string; lit: LiturgicalDay }[] {
  const today = pragueToday(now)
  const base = Date.UTC(today.y, today.m - 1, today.d)
  const out: { key: DayChoice; label: string; lit: LiturgicalDay }[] = [
    { key: 'now', label: t('day_now'), lit: litForChoice(now, 'now') },
    { key: 0, label: t('day_today'), lit: litForChoice(now, 0) },
    { key: 1, label: t('day_tomorrow'), lit: litForChoice(now, 1) },
  ]
  for (let off = 2; off <= 6; off++) {
    const dow = new Date(base + off * 86_400_000).getUTCDay()
    out.push({ key: off, label: dow === 0 ? t('day_sunday_full') : weekdayShort(dow), lit: litForChoice(now, off) })
  }
  // ON a Sunday the 0..6 window holds no future neděle — but Sunday evening IS
  // when next week gets planned. Offer next Sunday explicitly (audit finding).
  if (new Date(base).getUTCDay() === 0) {
    out.push({ key: 7, label: t('day_sunday_full'), lit: litForChoice(now, 7) })
  }
  return out
}

// ---- ?den= — the selected day as a bookmarkable query param -----------------

const DAY_SLUGS = ['nedele', 'pondeli', 'utery', 'streda', 'ctvrtek', 'patek', 'sobota'] // Date.getUTCDay order

/** ?den= value for a picker choice ('now' = no param, 0/1 = dnes/zítra,
 * farther days by weekday name so a bookmark means "next neděle", any week). */
export function dayToParam(now: Date, day: DayChoice): string | null {
  if (day === 'now') return null
  if (day === 0) return 'dnes'
  if (day === 1) return 'zitra'
  const today = pragueToday(now)
  const dow = new Date(Date.UTC(today.y, today.m - 1, today.d) + day * 86_400_000).getUTCDay()
  return DAY_SLUGS[dow]
}

/** Decode ?den= back to a picker choice; unknown/absent → 'now'. */
export function dayFromParam(now: Date, param: string | null): DayChoice {
  if (param === 'dnes') return 0
  if (param === 'zitra') return 1
  const dow = DAY_SLUGS.indexOf(param ?? '')
  if (dow === -1) return 'now'
  const today = pragueToday(now)
  const base = Date.UTC(today.y, today.m - 1, today.d)
  for (let off = 0; off <= 6; off++) {
    if (new Date(base + off * 86_400_000).getUTCDay() === dow) return off
  }
  return 'now' // unreachable — every weekday occurs within 7 days
}

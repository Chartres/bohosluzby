// embed/<id>.json — the data a parish website's widget fetches (public/embed.js,
// evolve pick #5). Prerendered for the web deploy only, beside the church pages.
// Small and static on purpose: views are served from cache and never logged;
// only a click through arrives, as a page_view with utm_source=embed.
// Node imports this via type stripping: explicit .ts specifiers, types only.
import { isConfession, normalizeLang } from './registry.ts'
import { parseNote } from './notes.ts'
import { churchUrl } from './site.ts'
import type { PageChurch, RawEntry } from './churchPage.ts'

/** [days | date, "HH:MM", lang, type, note, mask?] — `mask` (weekly rows with a
 * note only): MASK_DAYS chars from `from`, '1' where the app's note parser says
 * the service runs that day. The widget can't parse notes; it reads the mask. */
type Row = [string, string, string, string, string, string?]

const MASK_DAYS = 60 // > the monthly registry refresh, so a deploy always renews it in time
const DAY_MS = 86_400_000

function runMask(days: string, note: string, from: string): string {
  const rule = parseNote(note)
  const start = Date.parse(`${from}T00:00:00Z`)
  let out = ''
  for (let i = 0; i < MASK_DAYS; i++) {
    const d = new Date(start + i * DAY_MS)
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
    const runs = days.includes(String(iso)) && rule.runsOn(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    out += runs ? '1' : '0'
  }
  return out
}

export interface EmbedData {
  v: 1
  id: string
  name: string
  city: string
  url: string
  /** registry "aktualizace" date */
  updated: string
  /** first day of the run masks (the build date) */
  from: string
  s: Row[]
  x: Row[]
}

const typeOf = (type: string, greek: 0 | 1) =>
  (type.trim() || 'bohoslužba') + (greek === 1 ? ' (řeckokatolická)' : '')

export function embedData(input: { church: PageChurch; entry: RawEntry | undefined; today: string }): EmbedData {
  const { church, entry, today } = input
  return {
    v: 1,
    id: church.id,
    name: church.name,
    city: church.city,
    url: churchUrl(church.id),
    updated: entry?.u ?? '',
    from: today,
    s: (entry?.s ?? [])
      .filter((r) => !isConfession(r[4]))
      .map(([days, time, lang, greek, type, note]): Row => {
        const row: Row = [days, time, normalizeLang(lang), typeOf(type, greek), note.trim()]
        if (note.trim()) row.push(runMask(days, note, today))
        return row
      }),
    x: (entry?.x ?? [])
      .filter((r) => r[0] >= today && !isConfession(r[4]))
      .map(([date, time, lang, greek, type, note]) => [date, time, normalizeLang(lang), typeOf(type, greek), note.trim()]),
  }
}

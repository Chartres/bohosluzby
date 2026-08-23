// Tier-1 confession mining. ~6 churches type "svátost smíření" as its own
// service row (split out in data.ts); ~37 more only mention confession inside a
// Mass note ("od 17.00 svátost smíření", "od 17:15 adorace s možností svátosti
// smíření, od 18.00 mše svatá"). Pull an explicit confession TIME out of such
// notes so the detail page's confession section covers them too.
//
// Precision over coverage: a wrong confession time is worse than none, so we
// extract only an explicit clock time (or a literal "před/po mši"), never an
// invented one. When a note mentions confession without its own time we return
// null rather than guess.

const MENTIONS = /svátost\S* smíření|zpově[dď]|příležitost ke svátosti/i
// "od 17.00" | "17:15" | "od 8.00" — clock time with "." or ":" separator,
// not embedded in a longer number ("17.000").
const TIME = /(?:^|[^\d.:])(?:od\s+)?(\d{1,2})[.:](\d{2})(?![\d.:])/

export interface ParsedConfession {
  days: string // ISO weekday digits, carried from the Mass row it came from
  time: string // "HH:MM", or the literal "před mší" / "po mši"
  note: string // the original Mass note, for context in the confession section
}

/** Extract a confession time from a Mass note, or null when there is none to
 * extract. `massTime` is the Mass row's own start; `days` its weekday code. */
export function parseConfessionFromNote(
  note: string,
  massTime: string,
  days: string,
): ParsedConfession | null {
  if (!note || !MENTIONS.test(note)) return null

  // Attribute the time to the confession, not a sibling Mass: pick the
  // comma/semicolon segment that actually mentions confession.
  const seg = note.split(/[,;]/).find((s) => MENTIONS.test(s)) ?? note

  const m = TIME.exec(seg)
  if (m) {
    const h = Number(m[1])
    if (h <= 23) {
      const time = `${String(h).padStart(2, '0')}:${m[2]}`
      // A time equal to the Mass start is confession happening AT Mass, not a
      // distinct window — drop it rather than mint a duplicate-looking row.
      if (time !== massTime) return { days, time, note: note.trim() }
    }
  }

  // No own time: mark it relative to the Mass only when the note literally says so.
  if (/přede?\s+mší/i.test(seg)) return { days, time: 'před mší', note: note.trim() }
  if (/po\s+mši/i.test(seg)) return { days, time: 'po mši', note: note.trim() }
  return null
}

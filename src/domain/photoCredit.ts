// The photo credit line on the church detail: author · licence · Wikimedia
// Commons. CC licences need the author's name, the licence and the source —
// not the free-text note some authors put in their Commons "Artist" field
// ("This Photo was taken by Miha Peče . Feel free to use my photos, but…").
// So: the name only, one short line.

const MAX = 32

/** "This Photo was taken by Miha Peče . Feel free…" → "Miha Peče". */
export function creditName(credit: string): string {
  let s = credit.trim()
  const by = /\btaken by\s+(.+?)\s*[.,;]/i.exec(s)
  if (by) s = by[1]
  s = s.split(' (')[0].trim() // "ŠJů ( cs:ŠJů )", "Valentin F.R. (en pause)…"
  // a sentence break after a real word ends the name ("… Novák. Feel free …");
  // initials ("J. Novák", "F.R.") don't break
  const sentence = /^(.*?\p{Ll}{3})\.\s/u.exec(s)
  if (sentence) s = sentence[1]
  if (s.length > MAX) s = `${s.slice(0, MAX).replace(/\s+\S*$/, '')}…`
  return s
}

export function creditLine(credit: string, license: string): string {
  return [creditName(credit), license, 'Wikimedia Commons'].filter(Boolean).join(' · ')
}

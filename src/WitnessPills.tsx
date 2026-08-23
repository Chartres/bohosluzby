// Read-only witness pills: the AfterMassCard chip look (rounded, hairline, season
// tint) but smaller and non-interactive, each an icon + label. One shape serves
// two renderers — a React component for the detail page and an HTML-string
// builder for the DOM-built map popover — so the pill markup lives in one place.
import { chipLabel } from './domain/feedback'
import { WitnessIcon, witnessIconMarkup } from './domain/witnessIcons'

/** The one flag check: the TestFlight prototype build (VITE_WITNESS_PREVIEW=1)
 * shows a per-tag count on each pill; production stays qualitative (no numbers,
 * strongest tag rendered slightly stronger). */
export const witnessShowCounts = (): boolean => import.meta.env.VITE_WITNESS_PREVIEW === '1'

/** Label with the prototype-only per-tag count appended ("krásný zpěv · 3"). */
const pillLabel = (c: { id: string; count: number }, counts: boolean): string =>
  counts ? `${chipLabel(c.id)} · ${c.count}` : chipLabel(c.id)

/** Production emphasises the single strongest (first, frequency-ranked) tag;
 * the prototype leans on the visible count instead, so no extra weight there. */
const strongAt = (i: number, counts: boolean): boolean => !counts && i === 0

export function WitnessPills({ chips }: { chips: { id: string; count: number }[] }) {
  const counts = witnessShowCounts()
  return (
    <span className="witness-pills">
      {chips.map((c, i) => (
        <span key={c.id} className={`witness-pill${strongAt(i, counts) ? ' witness-pill--strong' : ''}`}>
          <WitnessIcon id={c.id} />
          <span>{pillLabel(c, counts)}</span>
        </span>
      ))}
    </span>
  )
}

/** The same pills as an HTML string for the leaflet popover (no React there). */
export function witnessPillsHtml(chips: { id: string; count: number }[]): string {
  const counts = witnessShowCounts()
  return chips
    .map(
      (c, i) =>
        `<span class="witness-pill${strongAt(i, counts) ? ' witness-pill--strong' : ''}">${witnessIconMarkup(c.id)}<span>${pillLabel(c, counts)}</span></span>`,
    )
    .join('')
}

// Thin-line missal glyphs, one per witness chip. Monochrome (currentColor),
// 24×24 viewBox, ~1.5 stroke, no fill — they inherit the pill's ink and sit
// beside the label. NO emoji: a printed-ordo book would draw these in one pen
// weight, so we do too. One source of truth (WITNESS_ICON_PATHS) feeds both the
// React pill (detail) and the DOM-built map popover via witnessIconMarkup().

// Inner SVG markup per chip id. Single path where the shape allows; a few use a
// head circle + strokes. Kept visually consistent: same viewBox, same weight.
export const WITNESS_ICON_PATHS: Record<string, string> = {
  // flame — a lit candle's tongue with an inner curl
  hluboky_prozitek:
    '<path d="M12 3c2.5 3.5 4 5.5 4 8a4 4 0 0 1-8 0c0-1.5.6-2.8 1.6-4 .2 1 .8 1.7 1.6 2 0-2.2.2-4 .8-6z"/>',
  // open book — centre spine and two page curves
  dotklo_se_me_kazani:
    '<path d="M12 6.5v13"/><path d="M12 6.5C10 5.2 6.5 4.5 4 5.2v12.3c2.5-.7 6 0 8 1.3"/><path d="M12 6.5c2-1.3 5.5-2 8-1.3v12.3c-2.5-.7-6 0-8 1.3"/>',
  // music note — two beamed eighths
  krasny_zpev:
    '<path d="M9 16V5l10-2.2V14"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="14" r="2"/>',
  // open door — right frame, top bar and a leaf swung ajar with a knob
  vrele_prijeti:
    '<path d="M4 21h16"/><path d="M17 21V4h-3"/><path d="M6 21V6l8-2v17"/><path d="M11 12.5v2"/>',
  // small child — a stick figure, head and open arms
  vstricne_k_detem:
    '<circle cx="12" cy="6" r="2.5"/><path d="M12 8.5v7"/><path d="M8 12h8"/><path d="M12 15.5l-3 5"/><path d="M12 15.5l3 5"/>',
  // house — roof and walls
  rodinna_atmosfera: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/>',
  // arch — a rounded portal on its base line
  dustojna_atmosfera: '<path d="M5 21V11a7 7 0 0 1 14 0v10"/><path d="M3 21h18"/>',
}

const SVG_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'

/** Full <svg> string for the DOM-built map popover (no React there). */
export function witnessIconMarkup(id: string): string {
  const inner = WITNESS_ICON_PATHS[id]
  if (!inner) return ''
  return `<svg class="witness-pill-ico" ${SVG_ATTRS} aria-hidden="true">${inner}</svg>`
}

/** The same glyph as a React node for the detail-page pills. */
export function WitnessIcon({ id }: { id: string }) {
  const inner = WITNESS_ICON_PATHS[id]
  if (!inner) return null
  return (
    <svg
      className="witness-pill-ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

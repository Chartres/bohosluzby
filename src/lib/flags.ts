// Build flags. Kept tiny and dependency-free so every surface can import it.
//
// WITNESS_ENABLED gates the entire pilgrim-witness / "Ohlasy poutníků" feature
// (after-Mass card, the witness filter, the list/map/detail witness marks and
// pills, aggregate loading). It is OFF in the public App Store build (Canon 220
// — the feature is not yet blessed) and ON everywhere it needs to be tried:
//   - `npm run dev` and Vitest (jsdom) → import.meta.env.DEV is true.
//   - TestFlight / prototype builds → they already pass VITE_WITNESS_PREVIEW=1.
//   - The Playwright e2e build → VITE_WITNESS_ENABLED=1 turns the feature on
//     WITHOUT force-showing the demo after-Mass card (that force-show is
//     VITE_WITNESS_PREVIEW's job and would break specs that don't expect it).
// A public `vite build` passes no flag and has DEV === false, so witness is
// absent by construction — nothing renders or runs.
export const WITNESS_ENABLED =
  import.meta.env.DEV ||
  import.meta.env.VITE_WITNESS_PREVIEW === '1' ||
  import.meta.env.VITE_WITNESS_ENABLED === '1'

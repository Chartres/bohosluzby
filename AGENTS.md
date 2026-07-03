# AGENTS.md — Bohoslužby

The build/test/release contract for this repo. An agent (or the overnight ralph loop) should be
able to read only this file and ship correctly. Keep every command copy-pasteable and current.
Taste rules that apply to every flywheel product live in the hub: `flywheel/docs/standards/taste.md`.
This repo's visual contract lives in `docs/DESIGN-BRIEF.md` — binding, read it before touching UI.

> One-liner: "Mše svatá poblíž, právě teď" — mobile-first PWA finding the nearest Czech
> Catholic services from your location.
> Stack/template: Vite + React 19 + TS PWA (autoskola-kviz clone)  ·  Track: community  ·
> Portfolio record: `flywheel/data/products/bohosluzby.json`

## Build
```bash
npm ci
npm run build
```

## Test (TDD required; persona-journey test per primary journey)
```bash
npm run typecheck
npm test              # Vitest (domain logic + RTL)
npx playwright test   # e2e journeys (Chromium); run locally, not in CI
```
Gate: typecheck · test · build must pass (CI: `.github/workflows/ci.yml` runs these three on
push + PR). Block only on these. Playwright is a local pre-push check — the persona journeys
write committed screenshots to `e2e/shots/` for visual review (Standard: persona testing is visual).

## Data
`node data/extract.mjs` — scrapes bohosluzby.cirkev.cz (≤3 req/s, resumable via gitignored
`data/cache/`) and writes `public/data/churches.json` + `public/data/services/<cell>.json`.
The output is committed; re-run to refresh. `node data/extract.mjs transform` rebuilds the
JSON from cache offline.

## Run / verify a change in the real app
`npm run dev` → http://localhost:5173. Primary journey to eyeball: allow location (or pick a
city) → "Nejbližší bohoslužby" list — time until, church name, distance, language chip,
seasonal accent. The accent color must match the current liturgical season.

## Release (the finish line — produces a storefront link)
- **Web** → GitHub Pages at `bohosluzby.dravec.org`. The `deploy` job in
  `.github/workflows/ci.yml` is stamped but gated `if: false` — stage 2 flips it after
  Pavol's visual review of `e2e/shots/` (then: enable Pages on the repo, add the DNS CNAME).
  Build reads platform env `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` from repo
  secrets; the app works fully without them.
Adoption is read from web KPIs — no extra telemetry needed.

## Analytics (Common Platform)
Vendored client: `src/platform/flywheel-client.ts` (`app: 'bohosluzby'`). Fire the shared
taxonomy (`page_view`, `signup_*`, `conversion`, `key_action`, `feedback_given`, `error`). The aha
moment — the list of nearby services renders from a real location — fires `conversion`; set
`activation_event: "conversion"` in the portfolio record and the conversion rate flows into the
console with no extra wiring.

## Done means
Green CI · released (URL) · portfolio record updated (stage/gate/links) · storefront link live ·
(outward promotion only after Pavol's sign-off).

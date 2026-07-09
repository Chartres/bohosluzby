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
npm run build   # tsc + vite build + scripts/prerender.mjs (city pages, sitemap, 404.html)
```
`prerender.mjs` imports `src/domain/cities.ts` directly — node ≥22.6 with type stripping
(the script is invoked with `--experimental-strip-types`; a no-op on node ≥23).

## Test (TDD required; persona-journey test per primary journey)
```bash
npm run typecheck
npm test              # Vitest (domain logic + RTL journeys)
npx playwright test   # e2e journeys (Chromium); run locally, not in CI
```
Gate: typecheck · test · build must pass (CI: `.github/workflows/ci.yml` runs these three on
push + PR). Block only on these. Playwright is a local pre-push check — the persona journeys
write committed screenshots to `e2e/shots/` for visual review (Standard: persona testing is
visual — LOOK at the shots after any UI change).

Personas + journeys live in `docs/PERSONAS.md` — the scripts behind `e2e/personas.spec.ts`
plus the seasonal manual passes (Triduum, Christmas, feast workdays, first week of July).
New features must name the persona journey they serve before they get built.
Sandboxes with a system Chromium: `PW_CHROMIUM=/path/to/chromium npx playwright test`.

## Data
`node data/extract.mjs` — scrapes bohosluzby.cirkev.cz (≤3 req/s, resumable via gitignored
`data/cache/`) and writes `public/data/churches.json` + `public/data/services/<cell>.json`
(3,991 churches / 21 shards / 1.3 MB, all precached by the service worker). The output is
committed; re-run to refresh. `node data/extract.mjs transform` rebuilds the JSON from cache
offline. Language values are normalized to Czech lowercase at decode (`normalizeLang`).

## Run / verify a change in the real app
`npm run dev` → http://localhost:5173. Journeys to eyeball:
1. allow location (or pick a city) → "Nejbližší bohoslužby" — time until, distance, chips,
   seasonal accent (must match the current liturgical season).
2. day picker (hned/dnes/zítra/neděle) → the day's full ordo, chronological.
3. filters (jen mše svaté · bezbariérové · řeckokatolické · jazyk) and kdy — sticky in
   localStorage for 12h, then reset (opening the app later should mean "right now").
4. row → `/kostel/<id>/` detail — weekly ordo, extras, parish/contacts, mapa/navigace/sdílet,
   "do kalendáře" (ICS with RRULE), freshness line ("naposledy ověřeno …").
5. `/mesto/praha/` — city landing without a geolocation prompt.
6. offline (devtools) — footer indicator, list still renders; last known position reused.

## Release (the finish line — produces a storefront link)
- **Web** → GitHub Pages at https://bohosluzby.dravec.org. The `deploy` job in
  `.github/workflows/ci.yml` uploads `dist/` and deploys on every main push (Pages
  build_type=workflow, cname set via API; DNS CNAME managed outside this repo).
  Build reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` from repo secrets
  (set; shared flywheel-core project); the app works fully without them.
Adoption is read from web KPIs — no extra telemetry needed.

## Analytics (Common Platform)
Vendored client: `src/platform/flywheel-client.ts` (`app: 'bohosluzby'`). Fires the shared
taxonomy: `page_view` on load, `key_action` (filter/day/ics/share/city_selected),
`feedback_given` (footer FeedbackCard, Sean Ellis), `error`. The aha moment — **opening a
church detail from the hero list** ("found a service") — fires `conversion`; the portfolio
record's `activation_event: "conversion"` makes the rate flow into the console with no extra
wiring.

## Done means
Green CI · released (URL) · portfolio record updated (stage/gate/links) · storefront link live ·
(outward promotion only after Pavol's sign-off).

# Roadmap — Kam na mši

**Start here** if you are picking this product up (cloud session or the Mac mini). Read in
this order:
1. `AGENTS.md`: how to build, test and release.
2. This file: where things stand and what comes next.
3. `BACKLOG.md`: the itemised queue.
4. `docs/EVOLVE.md`: why. Signals, ideas, and Pavol's picks.
5. `docs/OWNER-TASKS.md`: what only Pavol can do.

Update the **Now** section at the end of every session; it is the handoff.

## Now — as of 2026-10-30 (Pavol's decision page, hand-back `docs/review/2026-10-30.json`)

- `/dusicky/` hub: an SVG map with a dot per town page, the towns grouped by diocese, a
  "Najdi obec" filter, and an opt-in "Podle mé polohy" sort (#76, live).
- Title feasts for ambiguous church names now come from the parish's own source: 32 of 150,
  the rest show nothing. The remaining 118 can be re-checked (data/patron-sources.json says
  why each is open; ~25 parish sites block automated reads).
- iOS: builds 81–88 of 1.4 are on App Store Connect, all from CI. Nothing submitted (the
  hand-back lists them).

## Now — as of 2026-10-28 (deep round, flywheel `docs/program/2026-10-27-deep-round.md`)

- **All Saints / Dušičky (1–2 Nov 2026) pages are live** (#63): `/dusicky/` + 30 city
  lists, a feast section and schema.org Events on every church page, static HTML with
  their own `page_view` (route `feast`). They roll to 2027 on the next rebuild after 2 Nov
  (the 3 Nov refresh). Walk P8 on 1–2 Nov.
- **Submitted**: IndexNow, all 4,054 sitemap URLs to Seznam and Bing (27 Oct, flywheel
  launch-log). Google Search Console and Seznam Webmaster still need Pavol's login.
- **Signature** (`docs/SIGNATURE.md`, #64): titular feast (pouť) on church pages and
  "pozvat" on service rows — web only. **No TestFlight yet**: visual change, Pavol's look
  at the detail shot first (flywheel `docs/review/2026-10-28/bohosluzby/`).
- Competition: `docs/research/competition-2026-10.md`. City pages carry ItemList JSON-LD (#65).
- Next: `/vanoce/` on the feast engine before 15 Dec; "tento týden slaví" (poutě nearby).

## Before — as of 2026-10-24

- **Stage**: soft-launch.
  - The kill criterion (≥50 weekly visitors by 2026-09-03) is **missed and overdue**.
  - Recommendation in EVOLVE.md: ITERATE to 2026-12-31, with the search channel as the
    channel attempt. Pavol decides (open).
- **Web**: live, current with `main`. That covers everything in CHANGELOG "Unreleased".
- **Friends' feedback round (from 2026-10-21)**: Pavol shared the app with a group of
  friends. First batch shipped on web: the popover shows the church's whole day (option 2B),
  the map keeps its view across a church visit (1A), and the home-indicator swipe no longer
  pans the map. Collect further reports here, or in BACKLOG.
- **iOS**: 1.3 is approved (its train is closed). **1.4 build 81** went to TestFlight on
  2026-10-24 from the hosted Mac (run 40124266787). It carries the friends'-feedback map
  fixes. Pavol tests it; Submit for Review stays his.
  - **Hosted-Mac releases work end to end**: Xcode 26.3, signed with the existing
    certificate KL8QSY327N, about 2 minutes. Every user-facing merge to `main` gets a `beta`
    run (AGENTS.md Release). In the Flywheel Standard as `ios-app.md` §11a′ (flywheel #71).
  - Open owner item: revoke certificate NXW2P6X576, minted by a CI run before the fix
    (`docs/OWNER-TASKS.md`).
- **Android**: built and signed in CI (`release-android.yml`), not yet on Play.
  - Owner steps 1–6 in `docs/OWNER-TASKS.md`.
  - A new personal Play account needs a closed test with 12 testers for 14 days before
    production.
- **Outward drafts awaiting Pavol**:
  - ČBK data-quality email (Gmail draft; `docs/registry-quality.md` + CSV);
  - the embed offer to 3 parishes;
  - sitemap submission to Google Search Console and Seznam.
- **Measurement**: page_view now carries platform and referrer (since 2026-10-07). The
  first clean native/web split and channel mix appear from mid-October.

## Next — October–November 2026

| When | What | Kill / success test |
|---|---|---|
| this week | Ship the iOS build; Android closed test starts | iOS 15–16 users render; Play closed test with 12 testers |
| this week | Sitemaps submitted; ČBK email sent | Search Console impressions on `/kostel/*` ≥100/week by **2026-11-18**, else long-tail search is not our channel |
| October | Embed on 3 parish websites | `utm_source=embed` visits |
| by 15 Nov | **Christmas pages** (`/vanoce/` + per-city půlnoční lists), filled by the 15 Dec refresh plus one around 20 Dec | 21–27 Dec week ≥100 visitors, else the gate resolves to MAINTAIN |
| next native build | Rating prompt after the 3rd conversion; Siri / App Actions shortcut | ratings count; shortcut invocations |
| ~2026-11-07 | Monthly `/flywheel:evolve` run: score this run's picks first | — |
| 2026-12-31 | Gate (if ITERATE is chosen) | ≥50 weekly visitors (bots excluded) |

## Later
- **Witness chips as private thanks to parishes.** Needs the giver's loop ("předáno farnosti
  v říjnu"); design in EVOLVE.md. Replaces phase 2 of WITNESS-RELEASE-PLAN.
- **Travel mode**: masses at the destination and arrival time.
- **Zpověď poblíž**: a confession-window list, for Advent and Lent.
- **Next-mass widget / Live Activity**, after native usage is measurable.
- **Open mass-times feed for AI assistants**, only with ČBK's agreement on redistribution.

## Working conventions (both environments)
- Branch per change.
  - Cloud sessions use their assigned branch; the mini uses `claude/<topic>`.
  - PR to `main`, merge on green CI. Never push to `main` directly.
- Tests first; `npm run typecheck && npm test` must pass. Web changes:
  `PRERENDER_CHURCHES=1 npm run build && node scripts/check-prerender.mjs`.
- After every user-facing merge to `main`, also send a TestFlight build: Release iOS, lane
  `beta` on `main` (hosted Mac). Don't run it alongside a mini upload. See AGENTS.md Release.
- Never Submit for Review or release to a store without Pavol's go. Outward messages
  (email, posts, parish contact) stop at a draft.
- Every session updates **Now** above, CHANGELOG "Unreleased", and BACKLOG.

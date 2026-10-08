# Roadmap — Kam na mši

**Start here** if you are picking this product up (cloud session or the Mac mini). Read in
this order:
1. `AGENTS.md`: how to build, test and release.
2. This file: where things stand and what comes next.
3. `BACKLOG.md`: the itemised queue.
4. `docs/EVOLVE.md`: why. Signals, ideas, and Pavol's picks.
5. `docs/OWNER-TASKS.md`: what only Pavol can do.

Update the **Now** section at the end of every session; it is the handoff.

## Now — as of 2026-10-08

- **Stage**: soft-launch.
  - The kill criterion (≥50 weekly visitors by 2026-09-03) is **missed and overdue**.
  - Recommendation in EVOLVE.md: ITERATE to 2026-12-31, with the search channel as the
    channel attempt. Pavol decides (open).
- **Web**: live, current with `main`. That covers everything in CHANGELOG "Unreleased".
- **iOS**: 1.2 in the store (last confirmed live 2026-08-23, still to re-confirm).
  - The next build carries the blank-app fix for iOS 15–16.3. Until it ships, those users
    see nothing.
  - **In flight (2026-10-08)**: release run on the Mac mini (Pavol's session there):
    - version 1.3 if 1.2 is live, otherwise stay on 1.2;
    - release notes in `ios/App/fastlane/metadata/cs/release_notes.txt`;
    - work on branch `claude/ios-release-<version>`.
    It uploads to TestFlight and does not submit. Pavol tests on his phone, then taps
    Submit for Review.
  - **Hosted-Mac releases**: `.github/workflows/release-ios.yml` passes its gate on
    `macos-15`.
    - All 5 secrets are set (2026-10-08). The first lane-`build` run passed the gate, the
      secrets check and the keychain import. It stopped at the first App Store Connect call:
      an Apple agreement is missing or has expired (an owner task in `docs/OWNER-TASKS.md`).
      That blocks the mini too.
    - Next: once Pavol accepts the agreement, re-run lane `build`. When it's green, add the
      pattern to the Flywheel Standard (`ios-app.md` §11a′, drafted on the flywheel branch).
      After that, lane `beta` or `release` for real uploads, never alongside a mini upload.
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
- Never Submit for Review or release to a store without Pavol's go. Outward messages
  (email, posts, parish contact) stop at a draft.
- Every session updates **Now** above, CHANGELOG "Unreleased", and BACKLOG.

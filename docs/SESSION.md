# Session summary — Kam na mši

One page, rewritten (not appended) at every hand-back and before the context runs out.
Start every package by reading AGENTS.md, docs/ROADMAP.md, this file and the latest hand-back
in docs/review/. The rule is in AGENTS.md › Working with the orchestrator. Last rewrite: 23 Nov 2026.

## What the product is now
- Web: bohosluzby.dravec.org, deployed from main. Data reaches the apps over the air: since
  #114 the build stamps `version.json` from git, so a corrections merge alone updates the apps.
- iOS: 1.5 live since 8 Nov. **1.6 is on TestFlight (build 95, 23 Nov)**: the roráty pill,
  quiet row icons (#117), and What's new that waits for the pill (#118). Submit for Review is Pavol's.
- Seasonal pills are data (`public/data/views.json`, #115). Roráty shows 28 Nov – 24 Dec.
- Android: release path ready; the Play Console steps are Pavol's.

## Open threads
- **Roráty pass** (docs/RORATY-PASS.md): day 1 (22 Nov, #111) and the re-read of the 20 error
  sites (23 Nov, #119, 3 rows) are live. Day 2 runs 26 Nov (scheduled); 28 Nov: final batch,
  live check at 390 px, hand-back. 1 Dec: re-check sv. Vít.
- **Christmas pass prep** (#120, docs/VANOCE-PASS.md): checker, site list, known bot walls, and
  two fixes. `/vanoce/` lists confirmed notices; the app reads a dated `24:00` as midnight.
  **The 24:00 fix needs a native build before Christmas.**
  The Vánoce pill is a draft (`data/views-drafts/vanoce.json`). Shots went to Pavol on 23 Nov;
  it goes live only on his OK. The půlnoční shows as "24:00" on 24 Dec (default, 23 Nov); Pavol may pick "00:00 zítra".
- **Design proposals** (branch `design-proposals`, prototype only, `?navrh=1..9`): Pavol likes
  the stained-glass band (`src/domain/glass.ts` palette is tested). Bolder ones (6 photo hero,
  7 window light, 8 candlelit roráty) are with him. Nothing builds before his pick.
- Hub follow-up: the what's-new kit gained `from` dates (#118); port it to flywheel.

## Pavol's rules in force here
- Follow the orchestrator's packages; risky steps need his word (AGENTS.md, 7–8 Nov 2026).
- Every user-facing change merged to main also goes to TestFlight. A visual change needs his
  OK on after-shots before the store build (24 Oct, 14 Oct 2026).
- Submit for Review, Play Console, emails, posts, contacting parishes, secrets and Supabase
  SQL are his. The wording for corrected rows is his call.
- Data passes: a 2026 source for every row, an independent review, and bot walls respected.
- 23 Nov: What's new names a feature only once it is in the app. Prefer real photos to drawn
  graphics; procedural visuals are fine. Be more ambitious in design proposals.

## Last three packages
1. **Overnight 23–24 Nov:** the re-read of the error sites (#119) and the Christmas prep (#120).
2. **1.6** (23 Nov, #115–#118): the roráty pill as data, row icons, and What's new dated to the
   pill. TestFlight builds 93–95.
3. **Roráty day 1** (22 Nov, #111, #114): 21 records, the confirmed-notice logic, and the OTA
   version stamp.

## Next
- 26 and 28 Nov: roráty day 2 and the final batch, then the hand-back. 1 Dec: sv. Vít.
- Before 19 Dec: Pavol's OK on the Vánoce pill, and a build with the 24:00 fix submitted.
- 13 and 15 Dec: read the nomination numbers. 14–23 Dec: the Christmas pass (docs/VANOCE-PASS.md).

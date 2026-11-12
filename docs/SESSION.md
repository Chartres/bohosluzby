# Session summary — Kam na mši

One page, rewritten (not appended) at every hand-back and before the context runs out.
Start every package by reading AGENTS.md, docs/ROADMAP.md, this file and the latest hand-back
in docs/review/. The rule is in AGENTS.md › Working with the orchestrator. Last rewrite: 8 Nov 2026.

## What the product is now
- Web: bohosluzby.dravec.org, deployed from main, with the Dušičky and city pages. Data reaches
  the apps over the air.
- iOS: 1.4 live since 30 Oct. **1.5 build 92 was submitted for review by Pavol on 8 Nov.**
  It has the new listing, screenshots and Czech as a listed language (#101).
- Android: the release path is ready (#97, #98). The Play Console steps are Pavol's
  (docs/ANDROID-RELEASE.md).

## Open threads
- **Roráty and Christmas pages are live** (12 Nov, Pavol's option A): `/advent/`, `/vanoce/`,
  181 towns each, Markdown twins, in the sitemap. #94's code went in with it. The roráty pass
  (22–28 Nov, docs/RORATY-PASS.md) and the Christmas pass (14–23 Dec) now merge into `main`.
  In-app link and the Dušičky-hub link still open (visual: shots first).
- **Advent nomination**: Pavol submits it by 12 Nov (docs/store/nomination-advent-2026.md).
  Measurement plan in docs/review/2026-11-07-store-1.5.json (read on 13 and 15 Dec).
- **App Store header and search-results assets** (new slots, iOS 27+): generate them and
  add them with the next iOS version (Pavol, 8 Nov). Pavol OKs them before upload.
- After 1.5 is live: check that the iTunes lookup (id 6792305024, country cz) lists CS.
- ČBK registry list (docs/registry-quality-hlaseni.md): written, not sent. Sending it is Pavol's call.

## Pavol's rules in force here
- Follow the orchestrator's packages; risky steps need his word (AGENTS.md, 7–8 Nov 2026).
- Every user-facing change merged to main also goes to TestFlight. A visual change needs his
  OK on after-shots before the store build (24 Oct, 14 Oct 2026).
- Submit for Review, Play Console, emails, posts, contacting parishes, secrets and Supabase
  SQL are his. The wording for corrected rows is his call.
- Data passes: a 2026 source for every row, an independent review, and bot walls respected.
- 5 Nov: the map popover names a non-Mass service's type ("20:00 adorace").
- 7 Nov: the store screenshots include a church photo.

## Last three packages
1. **Store 1.5 bundle + Czech in the App Store** (6–8 Nov, #101): cs/en .lproj, 1.5 listing,
   screenshots, nomination text. Build 92 uploaded; Pavol submitted it.
2. **Salvátor popover** (5–6 Nov, #100): "Dnes ještě: 20:00 adorace". Live; it went to TestFlight as build 91.
3. **Roráty step 1** (5 Nov, #94 branch): range records, a batch checker, the pass checklist, a
   dry run on 5 parishes, and the Christmas pages switched off.

## Next
- The header and search-results assets, for Pavol's OK.
- 22–28 Nov: the roráty pass, then ship #94 on 28 Nov with the links.
- 13 and 15 Dec: read the nomination numbers. 14–23 Dec: the Christmas pass.

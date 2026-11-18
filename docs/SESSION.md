# Session summary — Kam na mši

One page, rewritten (not appended) at every hand-back and before the context runs out.
Start every package by reading AGENTS.md, docs/ROADMAP.md, this file and the latest hand-back
in docs/review/. The rule is in AGENTS.md › Working with the orchestrator. Last rewrite: 9 Nov 2026.

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
- **App Store header and search-results assets** (new slots, iOS 27+): in
  store-assets/ios/creative/ (#105, Pavol OK'd 9 Nov). Pavol uploads them by hand with the next
  iOS version: version → Product Page Information → Header and Search Results.
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
1. **Store 1.5 bundle + Czech in the App Store** (6–9 Nov, #101, #104, #105): cs/en .lproj,
   1.5 listing, screenshots, nomination text, the orchestrator rules in AGENTS.md, and header
   and search assets. Build 92 uploaded; Pavol submitted it.
2. **Salvátor popover** (5–6 Nov, #100): "Dnes ještě: 20:00 adorace". Live; it went to TestFlight as build 91.
3. **Roráty step 1** (5 Nov, #94 branch): range records, a batch checker, the pass checklist, a
   dry run on 5 parishes, and the Christmas pages switched off.

## Next
- 22–28 Nov: the roráty pass, merged into main; 28 Nov: the in-app and Dušičky-hub links (shots first).
- 13 and 15 Dec: read the nomination numbers. 14–23 Dec: the Christmas pass.

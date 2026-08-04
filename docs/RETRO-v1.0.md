# Retro — v1.0 ship (App Store, READY_FOR_SALE 2026-07-27)

Kaizen, three derivatives (FLYWHEEL-STANDARD §12c.7):

**What failed or held us back**
- QUALITY MISS: duplicated screenshots (3×2 in both sets) reached the live
  listing. Two `fastlane ios release` runs each uploaded screenshots; the
  second appended. Locked until v1.1 (ASC 409 on released versions).
- Build-number collisions (53) from expired-build blindness — fixed mid-ship
  (Fastfile queries the builds API incl. expired).
- Speed: ~3 build/upload cycles burned on numbering + inset fixes that a
  device pass before the first upload would have caught.

**Fix that removes it (1st derivative)**
- `release` lane gets a post-upload verification step: GET screenshot sets,
  assert per-set count == local shots; fail loud. Dedupe v1.1 screenshots
  then. [x] land in Fastfile before v1.1 (`verify_listing`, `dedupe_screenshots`,
  and `release`'s skip-if-unchanged guard — landed in this commit).

**What would have caught it sooner (2nd derivative)**
- Standards gap: no "read back the published artifact" rule. Every publish
  step (store listing, web deploy, email send) ends by READING the published
  thing, not trusting the upload exit code. → goes to FLYWHEEL-STANDARD §11.

**Pavol admin-minutes this ship (target: fall next ship)**
- TestFlight install + device checks: ~45 min (3 rounds)
- ASC forms (privacy/categories/DSA, done pre-CX): ~40 min
- Submit + Release clicks: ~5 min
- Outward email review (drafted, still unsent): ~5 min pending
- Total ≈ 90 min. Next ship targets: forms already templated (≈0), device
  checks → 1 round via review packet + audit agent, clicks stay (gates).

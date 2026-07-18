# Bohoslužby → App Store — submission checklist (human-gated)

Everything code-side is done and verified (Capacitor 8 shell, offline, native
features, icons/splash, screenshots, privacy page). What remains needs the Apple
account + Pavol's sign-off. Steps are ordered; most take a few minutes.

Metadata to paste is in `docs/store/ios-metadata.md`. Screenshots are in
`store-assets/ios/{iphone-6.9,ipad-13}/`.

## Automated path (fastlane) — preferred

Most of the manual steps below are now scripted in `ios/App/fastlane/`. The
metadata, screenshots, and reviewer contact are checked into the repo; only a
few things must be done by hand once (they can't be, or aren't worth, scripting):
categories, age rating, the App Privacy nutrition label, and the final Submit.

**One-time key setup (you, ~3 min):**
1. App Store Connect → Users and Access → **Integrations** → App Store Connect API → **＋** → name `fastlane`, role **App Manager** → Generate.
2. Note the **Key ID** and **Issuer ID**. Download the `.p8` (offered once only) to `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`.
3. `cp ios/App/fastlane/.env.example ios/App/fastlane/.env` and fill in `ASC_KEY_ID` / `ASC_ISSUER_ID`.

**Run (from `ios/App/`):**
- `fastlane ios create_app` — registers the app record (once).
- Then in the ASC UI set the parts fastlane skips: **Primary Lifestyle / Secondary Reference**, **age rating 4+** (all "None"), and the **App Privacy** answers from §3 below.
- `fastlane ios release` — builds, signs, uploads the binary + all metadata + screenshots. **Stops before Submit** (lane sets `submit_for_review: false`).
- Do the airplane-mode self-check (§7), then **Submit for Review in the UI after Pavol's sign-off** (§8).

Re-uploading a new build later is just `fastlane ios release` again. TestFlight is `fastlane ios beta`.

The manual Xcode steps below remain valid as a fallback if fastlane signing fails.

## 0. Machine prep (once)
- [ ] `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` (Xcode 26 — required for uploads).
- [ ] Open the project: `npx cap open ios` (or open `ios/App/App.xcodeproj`).

## 1. Signing (Xcode → target App → Signing & Capabilities)
- [ ] Team = the fleet's Apple Developer team (same one that notarizes the macOS apps).
- [ ] "Automatically manage signing" ON. Bundle id is already `org.dravec.bohosluzby`.
- [ ] No entitlements needed — this app has no login, no push, no iCloud. (Local notifications need no entitlement.)

## 2. App Store Connect — create the app record
- [ ] apps → **＋** → New App. Platform iOS. Name **Bohoslužby: katolické mše**. Primary language Czech. Bundle id `org.dravec.bohosluzby`. SKU `bohosluzby`.
- [ ] Paste subtitle, promo text, description, keywords, URLs from `ios-metadata.md`.
- [ ] Category: Primary **Lifestyle**, Secondary **Reference**. Age rating **4+** (answer all "None").
- [ ] Privacy Policy URL: `https://bohosluzby.dravec.org/privacy` (ships from this PR — confirm it's live after deploy).
- [ ] Upload screenshots: iPhone 6.9″ (3) + iPad 13″ (3) from `store-assets/ios/`.

## 3. App Privacy (Data collection)
- [ ] **Usage Data → Analytics**: collected, **not** linked to identity, **not** used for tracking.
- [ ] **Location (coarse/precise) → App Functionality**: **not** linked to identity, **not** used for tracking.
- [ ] No other data types. (Matches `public/privacy/` and the analytics client.)

## 4. EU compliance
- [ ] DSA trader status: **non-trader** (free, no ads, no IAP, no commercial activity).
- [ ] Content rights: you have the right to use the content (data is the public ČBK registry; app is your own).

## 5. Export compliance
- [ ] Already declared in Info.plist (`ITSAppUsesNonExemptEncryption = NO`) → no encryption questionnaire.

## 6. Build → upload
- [ ] Xcode → Product → Destination **Any iOS Device (arm64)** → **Product → Archive**.
- [ ] Organizer → Distribute App → App Store Connect → Upload. Wait for processing (~5–15 min).
- [ ] In ASC, attach the processed build to the version.

## 7. Pre-submit self-check (the reviewer's moves)
- [ ] **Airplane-mode test**: install on a device/simulator, turn on Airplane Mode, open the app — the finder must list masses (map may be blank; that's fine). This is the #1 guideline-4.2 check.
- [ ] Open a church → "do kalendáře" opens the share sheet with an .ics; "připomenout" schedules a reminder (grant notifications).
- [ ] Location prompt shows the Czech copy and, once allowed, the list is sorted by distance.

## 8. Submit — **only after Pavol's explicit sign-off**
- [ ] Submit for Review. First-app review is often 24–48h; base rejection rate for a first app is ~40–60%, usually guideline 4.2 — if it bounces, the offline + reminders + calendar + haptics are the defense (see `flywheel/docs/standards/ios-app.md`).

## Notes
- Screenshots currently render the web UI at exact device sizes (deterministic Prague fixture). If you want them to show the **native** reminder button / iOS chrome, recapture from the simulator — optional, not required to submit.
- Android: `cap add android` is installed and building; no Play submission implied.

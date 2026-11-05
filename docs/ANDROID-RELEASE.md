# Android release — Pavol's steps

Everything else is automated (list at the end). Answers to paste live in
`docs/store/play-metadata.md`; the requirements behind these steps, with sources, in
`docs/research/2026-11-04-google-play.md` (checked 4 Nov 2026).

## Steps

1. **Check which rules apply to your account.** Play Console → ⚙ *Settings* → *Developer
   account* → *Account details*: note **Account type** (Personal / Organization) and the
   creation date. If it is *Personal* and created after 13 Nov 2023, step 8 applies (closed
   test). Confirmation later: in the app's menu, *Test and release → Production* is locked
   and the *Dashboard* shows "Apply for production".
2. **Upload key + GitHub secrets — one command at the mini**, in your bohosluzby
   checkout (needs `gh auth login` once and a JDK):
   ```
   git pull && scripts/android-keystore.sh
   ```
   It sets the 4 `ANDROID_*` secrets and keeps the password in your macOS Keychain
   ("kam-na-msi android upload key"). Nothing secret is printed.
3. **First build:** GitHub → *Actions* → *Release Android* → *Run workflow* → branch
   `main`, version `1.5.0` → *Run*. When it is green, open the run and download the
   artifact `kam-na-msi-android-1.5.0` (the `.aab` inside).
4. **Create the app and upload that first build by hand** (Google's API can't do the very
   first upload). Play Console → *Create app* → name `Kam na mši – katolické mše`, default
   language *Czech – cs-CZ*, *App*, *Free*, tick the declarations → *Create app*.
   Then *Test and release → Testing → Internal testing* → *Create new release* → accept
   Google-generated app signing → upload the `.aab` → *Next* → *Save and publish*.
   *Testers* tab → create an e-mail list with your own Google account → *Save*.
5. **Let CI upload from now on** (one time, ~5 min):
   1. console.cloud.google.com → new project `kam-na-msi-play` → *APIs & Services* →
      enable **Google Play Android Developer API**.
   2. *IAM & Admin → Service accounts* → *Create* `play-upload` → *Done* → open it →
      *Keys → Add key → JSON* (a file downloads).
   3. Play Console → *Users and permissions* → *Invite new users* → paste the service
      account's e-mail → *App permissions* → Kam na mši → tick **Release apps to testing
      tracks** and **Manage store presence** → *Invite user*.
   4. At the mini: `scripts/android-keystore.sh --play-json ~/Downloads/<the-file>.json`,
      then delete the file.

   A newly invited service account can take up to a day before Google stops answering
   "caller does not have permission"; the next run after that works. If the Cloud
   project sits under a Workspace organisation, its policy may block JSON keys — use a
   project under your personal account.

   From now on every *Release Android* run (or tag `android-vX.Y.Z`) uploads to the
   internal track by itself.
6. **App content** — Play Console → *Policy and programs → App content*, paste from
   `docs/store/play-metadata.md`: privacy policy `https://bohosluzby.dravec.org/privacy/`,
   ads *No*, app access *all functionality without special access*, content rating
   (IARC, all *No*), target audience *18+*, Data safety (the table), news *No*,
   government *No*, financial features *none*, health *none*.
   Also *Store settings*: category *Lifestyle*, contact e-mail, website.
7. **Approve the listing text** — read `store-assets/android/metadata/cs-CZ/*.txt` and
   `en-US/*.txt` and the privacy page (updated 4 Nov). If they're right: *Actions →
   Release Android → Run workflow* with **upload_listing** ticked; it builds and uploads a
   new internal build and, with it, puts text, icon, feature graphic and screenshots on
   the listing (Play attaches listing changes to a release).
8. **Only if step 1 said so — closed test, 12 testers, 14 days.** *Testing → Closed
   testing* → *Create track* → *Promote release* from internal → *Testers*: an e-mail list
   (or Google Group) with at least 12 people → *Save* → send them the opt-in link. They opt
   in and keep the app installed for 14 days in a row. Then *Dashboard → Apply for
   production* (Google answers in about 7 days). New personal accounts also verify a
   phone: the *Dashboard* task, in the Play Console app on an Android 10+ phone.
9. **Trader status** (all accounts, by 1 Feb 2027): Play Console → *Settings* →
   *Developer account* → declare trader / non-trader (a free app with no income: non-trader).
10. **Production** — *Testing → Internal (or Closed) testing* → the release → *Promote
   release → Production* → *Review* → *Start rollout to production*. This is the only
   submit; CI never does it.

## What is automated (`.github/workflows/release-android.yml`)

- Web build → `cap sync` → **signed AAB + APK**; versionCode = 100 + run number (always
  higher than the last upload); versionName from the tag or the run's input.
- Read-back: versionName, permissions, signature, and 16 KB page-size alignment (Play
  blocks updates without it from 1 Feb 2027; the app ships no native code today).
- **Upload to the internal testing track** with fastlane supply 2.241.2, release notes
  from `store-assets/android/metadata/cs-CZ/changelogs/default.txt`. While the app has
  never been published, Play only accepts draft releases: then the upload retries as a
  draft and says so (roll it out once, as in step 4). Never any other track.
- **Store listing** (text + graphics) from `store-assets/android/metadata/`, only when run
  with *upload_listing* (step 7), in the same call as that run's internal upload. `scripts/play-listing.mjs` checks Play's limits in
  CI (`ci.yml`) (title 30, short 80, full 4000 characters, no price/ranking words in title or
  short description; icon 512², feature 1024×500; 2–8 screenshots, 16:9–9:16, 320–3840 px).
- Graphics are generated: `node scripts/play-graphics.mjs` (icon, feature graphic) and
  `npx playwright test e2e/store-shots.spec.ts -g phone --grep-invert iphone` (screenshots).
- Without the secrets every step that needs them is skipped with a notice; the build
  still runs (unsigned) and attaches the files.

## Checked requirements (4 Nov 2026)

- Target API 36 for new apps and updates since 31 Aug 2026 — the app targets 36.
- AAB + Play App Signing required; ours is only the upload key, resettable in Play Console.
- The first upload must go through Play Console; the API works only afterwards.
- Personal accounts created after 13 Nov 2023: closed test, ≥ 12 testers, 14 continuous
  days, then *Apply for production*.
- Data safety is required for closed, open and production tracks (not internal-only).

## Uncertain

- Whether step 8 applies: depends on your account (step 1).
- Draft-app error text and behaviour come from third-party reports, not Google's docs —
  the workflow handles both outcomes.
- Data safety: a town picked by hand travels in an analytics event. Drafted as an app
  interaction, not *Location* (it isn't the device's location). If Google disagrees, add
  *Approximate location* · collected · analytics.
- The footer's *Podpořit* link (GitHub Sponsors) is fine on iOS 1.4. Play's payments
  policy limits donation links for non-charities; if review objects, hide it on Android.
- The exact Console label for the account type (step 1) was read from Google's help
  pages, not a live Console.
- The icon is an RGB PNG without alpha; Play's spec says 32-bit PNG. Play usually accepts
  it; if the listing upload complains, re-export with alpha in `scripts/play-graphics.mjs`.
- The first CI upload sends release notes in cs-CZ and en-US while en-US is not yet a
  listing language; if Play refuses, run step 7 first (it adds en-US).

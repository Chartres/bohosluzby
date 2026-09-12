# Google Play Console — metadata + submission (Android)

Paste-ready listing for **Kam na mši** on Google Play (Capacitor build of the same
web app as iOS). Primary locale **Czech (cs-CZ)**. Character counts verified against
Play limits. The binary comes from `.github/workflows/release-android.yml`
(tag `android-vX.Y.Z` → signed `.aab` on the GitHub Release).

Same app, same data, same privacy posture as `ios-metadata.md` — where Apple and
Google ask the same question the answer is identical; only the form differs.

---

## Names & URLs

| Field | Value | Chars / limit |
|---|---|---|
| App name | `Kam na mši – katolické mše` | 26 / 30 |
| Short description | `Nejbližší mše svatá podle vaší polohy – kterou ještě stihnete. Zdarma, offline.` | 79 / 80 |
| Package | `org.dravec.bohosluzby` | fixed forever |
| Category | Lifestyle | — |
| Tags (optional) | Religion, Maps, Offline | — |
| Contact e-mail | your address (Play shows it publicly) | — |
| Website | `https://bohosluzby.dravec.org` | — |
| Privacy policy | `https://bohosluzby.dravec.org/privacy` | — |

## Full description (≤4000)

```
Kam na mši vám podle vaší polohy ukáže nejbližší katolické mše svaté – a hlavně to, kterou mši dnes ještě stihnete.

Otevřete aplikaci a hned vidíte pořad bohoslužeb v okolí: kde a v kolik začíná nejbližší mše, kolik zbývá času a jak daleko to máte. Bez zdlouhavého hledání na webu farnosti.

Co aplikace umí:
• Nejbližší mše podle vaší polohy, seřazené od té, kterou ještě stihnete
• Mapa kostelů v okolí – na jeden pohled vidíte, kam je to nejblíž
• Pořad bohoslužeb pro dnešek, zítřek i neděli
• Funguje offline – data máte v telefonu i bez signálu
• Export mše do kalendáře jedním klepnutím
• Připomínka před začátkem mše, ať nikam nespěcháte
• Přibližně 4 000 kostelů a kaplí z oficiálního rejstříku České biskupské konference

Zdarma, bez reklam a bez registrace. Nepotřebujete účet ani přihlášení.

Vaše poloha se používá jen ve vašem telefonu k výpočtu nejbližších kostelů a nikam se neodesílá. Místo polohy můžete kdykoli zadat město ručně.

Zdroj dat: oficiální rejstřík bohoslužeb České biskupské konference (bohosluzby.cirkev.cz). Rejstřík doplňují farnosti samy; u každého kostela proto uvádíme datum posledního ověření – před cestou si čas raději ověřte ve farnosti.
```

## Graphics

| Asset | Size | File |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | `store-assets/android/icon-512.png` |
| Feature graphic (required) | 1024×500 PNG/JPG | `store-assets/android/feature-graphic.png` |
| Phone screenshots (2–8) | 1080×1920 PNG, 9:16 | `store-assets/android/phone/*.png` (from `e2e/store-shots.spec.ts`) |
| 7″ / 10″ tablet | optional; skip for v1 | — |

Play rejects screenshots outside 16:9…9:16, so the iPhone 6.9″ shots (2.17:1) cannot
be reused — the Android device entry in `store-shots.spec.ts` renders 360×640 @3.

## Release notes — `store-assets/android/whatsnew/whatsnew-cs-CZ`

Used by the workflow's Play upload step (≤500 chars). Keep it factual, one release.

## Data safety (Play → App content → Data safety)

Derived from the analytics client, same three anonymous types as the Apple label.
Everything else: **not collected**.

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (https to Supabase) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — e-mail (the data is an anonymous install id; deletion = delete the row on request) |
| App activity → **App interactions** | Collected, not shared, **optional** (can't be disabled but is anonymous), purpose Analytics |
| App info and performance → **Crash logs / Diagnostics** | Collected (the `error` events), not shared, purpose App functionality |
| Device or other IDs → **Device or other IDs** | Collected (anonymous per-install `visitor_id`), not shared, purpose Analytics |
| Location | **Not collected** — read on-device only, never transmitted |
| Personal info, Financial, Health, Messages, Photos, Audio, Files, Calendar, Contacts | Not collected (calendar export writes an .ics via the share sheet; the app never reads the calendar) |
| Data handling | Not processed ephemerally; no data sold; no third-party SDKs |

## Content rating questionnaire (IARC)

Category **Reference, news, or educational** → every question "No" (no violence, sexuality,
language, controlled substances, gambling, user interaction, personal-info sharing,
location sharing with others, purchases). Result: **Everyone / PEGI 3**.

## App content — other declarations

| Declaration | Answer |
|---|---|
| Ads | No ads |
| Target audience | 18 and over (simplest; avoids the Families policy). The app is suitable for all ages but is not *designed for* children. |
| News app | No |
| COVID-19 contact tracing | No |
| Government app | No |
| Financial features | None |
| Health | None |
| Advertising ID | Not used (matches the manifest: no `AD_ID` permission) |
| Foreground service | None |
| Exact alarms | Not requested — reminders use inexact scheduling, minutes of jitter is fine for a 45-min lead |

## Permissions the reviewer will see

`ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` (nearest-mass sort, on device),
`POST_NOTIFICATIONS` (mass reminders), `RECEIVE_BOOT_COMPLETED` + `WAKE_LOCK` (the
local-notifications plugin re-registers scheduled reminders after a reboot), `INTERNET`
(data refresh + anonymous analytics). No background location, no sensitive-permission
declaration form needed.

---

## Submission — what only the account owner can do

1. **Play Console account** — https://play.google.com/console, one-time 25 USD, personal
   account (seller name = Pavol Dravecký, same posture as Apple). Google may require identity
   verification (ID + a few days) before the first publish; new personal accounts also
   need a **closed test with ≥12 testers for 14 days** before production is unlocked.
   Plan for that: publish to *Closed testing* first, invite family + the parish list.
2. **Upload key** — run `scripts/android-keystore.sh` once on the Mac (needs `keytool`
   from any JDK and `gh`). It creates the keystore under `~/.config/kam-na-msi/` and sets
   the four `ANDROID_*` secrets on the repo. Save the printed password in 1Password.
3. **Tag a release** — `git tag android-v1.2.0 && git push origin android-v1.2.0`. The
   workflow attaches `kam-na-msi-1.2.0-<code>.aab` (+ `.apk` for sideloading) to a
   GitHub Release and reads the bundle back (versionName, permissions, signature).
4. **Create the app** in Play Console (name, Czech, free, app) and upload that `.aab` on
   *Testing → Closed testing → Create release*. The first upload enrolls **Play App
   Signing** automatically (Google keeps the real key; ours is the upload key).
5. **Store listing** — paste this file: name, short/full description, icon, feature
   graphic, screenshots, category, contact, privacy URL. Then *App content*: data safety,
   content rating, target audience, ads, declarations (tables above).
6. **Roll out** the closed test; after the 14-day/12-tester bar, *Production → Create
   release* with the same `.aab` (or the next tag).

### Optional: API upload so future releases need no console visit

Play Console → *Setup → API access* → link a Google Cloud project → create a service
account with **Release manager** on this app → download its JSON → repo secret
`PLAY_SERVICE_ACCOUNT_JSON`. From then on every `android-v*` tag lands on the internal
track by itself; promote to production in the console (or change the workflow's `track`
input). The first `.aab` must still go through the console (step 4).

## Self-check before the first upload (airplane-mode test on a real phone)

- Install the `.apk` from the GitHub Release (Settings → allow this source).
- Airplane mode on → open app → nearest masses render from the bundled data.
- Deny location → city picker works; allow → list re-sorts.
- Church detail → *Připomenout* → notification permission prompt → reminder appears in
  the shade at the scheduled time.
- Share → Android share sheet; *Do kalendáře* → .ics opens in Google Calendar.
- Rotate, back gesture (Android 13+ predictive back returns to the list, not out of the app).

# Google Play Console — metadata + submission (Android)

Listing and App content answers for **Kam na mši** on Google Play (Capacitor build of
the same web app as iOS). The owner's steps are in `docs/ANDROID-RELEASE.md`; this file
holds the answers they paste.

**The listing text and graphics live in `store-assets/android/metadata/`** (fastlane
supply layout: `cs-CZ/` with text + `images/`, `en-US/` text only).
`scripts/play-listing.mjs` checks them against Play's limits in CI (`ci.yml`); the release
workflow uploads them only when run by hand with `upload_listing`. The text quoted below
is a copy for reading: the files win.

Same app, same data, same privacy posture as `ios-metadata.md` — where Apple and
Google ask the same question the answer is identical; only the form differs.

---

## Names & URLs

| Field | Value | Chars / limit |
|---|---|---|
| App name | `Kam na mši – katolické mše` | 26 / 30 |
| Short description | `Nejbližší mše svatá podle vaší polohy – kterou ještě stihnete. Funguje offline.` | 79 / 80 (no price words: Play's metadata policy) |
| Package | `org.dravec.bohosluzby` | fixed forever |
| Category | Lifestyle | — |
| Tags (optional) | Religion, Maps, Offline | — |
| Contact e-mail | your address (Play shows it publicly) | — |
| Website | `https://bohosluzby.dravec.org` | — |
| Privacy policy | `https://bohosluzby.dravec.org/privacy` | — |

## Full description (≤4000) — copy of `store-assets/android/metadata/cs-CZ/full_description.txt`

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

## Graphics — generated, never hand-edited

| Asset | Size | File | Generator |
|---|---|---|---|
| App icon | 512×512 PNG | `store-assets/android/metadata/cs-CZ/images/icon.png` | `node scripts/play-graphics.mjs` |
| Feature graphic (required) | 1024×500 PNG | `…/cs-CZ/images/featureGraphic.png` | `node scripts/play-graphics.mjs` |
| Phone screenshots (2–8) | 1080×1920 PNG, 9:16 | `…/cs-CZ/images/phoneScreenshots/*.png` | `npx playwright test e2e/store-shots.spec.ts -g phone --grep-invert iphone` |
| 7″ / 10″ tablet | optional; skipped | — | — |

Play rejects screenshots whose long side is more than twice the short side (16:9 is the
recommended ratio, and `scripts/play-listing.mjs` enforces it), so the iPhone 6.9″ shots
(2.17:1) cannot be reused; the Android device in `store-shots.spec.ts` renders 360×640 @3. en-US has
no images of its own: Play shows the default language's (cs-CZ) graphics for it.

## Release notes — `store-assets/android/metadata/{cs-CZ,en-US}/changelogs/default.txt`

fastlane supply sends it with every internal-track upload (≤500 chars). Keep it factual.

## Data safety (Play → App content → Data safety)

Taken from the code (4 Nov 2026): the analytics client `src/platform/flywheel-client.ts`
inserts `events` (app, event name, props, random `visitor_id`/`session_id`, time) and,
only when the user writes it, `feedback` (score, Sean Ellis answer, free text) into
Supabase over https. Event props carry filter choices, day, church ids, the name of a
town the user **picked by hand**, and timings — never coordinates (`src/lib/geo.ts`
computes distances on the device). No accounts, no ads SDK, no advertising ID.
Required only once the app goes beyond internal testing.

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (https) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — e-mail ahoj@dravec.org (the data is keyed by an anonymous install id) |
| App activity → **App interactions** | Collected · not shared · **required** (no opt-out) · purpose **Analytics** |
| App activity → **Other user-generated content** | Collected · not shared · **optional** (the feedback card) · purpose **Analytics** |
| App info and performance → **Crash logs** and **Diagnostics** | Collected (`error` events) · not shared · required · purpose **Analytics** |
| Device or other IDs → **Device or other IDs** | Collected (random per-install `visitor_id`) · not shared · required · purpose **Analytics** |
| Location (approximate, precise) | **Not collected** — read on the device only, never transmitted. A town picked by hand is sent as an app interaction, not as the user's location (see Uncertain in `docs/ANDROID-RELEASE.md`) |
| Personal info, Financial, Health, Messages, Photos/videos, Audio, Files, Calendar, Contacts, Web browsing | Not collected (calendar export hands an .ics to the share sheet; the app never reads the calendar) |
| Is data processed ephemerally? | No |
| Is data sold / shared with third parties? | No (Supabase is our processor, not a third party receiving data) |

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

## Submission

The owner's steps, in order and nothing else: `docs/ANDROID-RELEASE.md`.

## Self-check before the first upload (airplane-mode test on a real phone)

- Install the `.apk` from the GitHub Release (Settings → allow this source).
- Airplane mode on → open app → nearest masses render from the bundled data.
- Deny location → city picker works; allow → list re-sorts.
- Church detail → *Připomenout* → notification permission prompt → reminder appears in
  the shade at the scheduled time.
- Share → Android share sheet; *Do kalendáře* → .ics opens in Google Calendar.
- Rotate, back gesture (Android 13+ predictive back returns to the list, not out of the app).

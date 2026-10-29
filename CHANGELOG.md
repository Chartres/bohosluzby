# Changelog — Kam na mši

The web app deploys continuously from `main` (bohosluzby.dravec.org). Store versions
(iOS, Android) are cut from it; `VERSION` holds the current store version. Newest first.
Format: what a user notices first, then what an agent needs to know.

## Unreleased (web: live · iOS/Android: next store build)
- Native analytics guard: `scripts/check-analytics.mjs` now also runs on the native bundles —
  `android/app/src/main/assets/public` after `cap sync` in release-android.yml, and
  `ios/App/App/public` in the Fastfile's `sync_web` (CI and local), plus an early secrets
  check in release-ios.yml. A store build without the Supabase config fails instead of
  shipping an app that sends no events.
- **pozvat** on every service row (`docs/SIGNATURE.md` mechanic C): opens your messenger with
  "Půjdeš se mnou na mši svatou? V neděli 1. 11. v 9:00, kostel … (město)." and the church
  link (`utm_source=pozvani`). The date is the next one the service really runs (its note
  respected). Fires `key_action: invite`.
- **Titulární svátek (pouť)** on the church detail and the static church page (mechanic B):
  the church's title read from its name, with its day. Only titles with one unambiguous
  date; "sv. Jakuba" alone or a bare "Panny Marie" get nothing.
- `docs/SIGNATURE.md` (lineage: Schematismus, Ordo, rubrics, CIC 1218, growth by attraction)
  and `docs/research/competition-2026-10.md`.
- **Všech svatých a Dušičky pages**: `/dusicky/` (dates, the indulgence for the dead, how
  exact the times are) and `/dusicky/<city>/` for the 30 city pages — every service the
  registry gives for 1 and 2 November, by time, church linked, one-offs and old entries
  marked. Static HTML, no app on top (the app has no such route); the service worker lets
  them through. Each `/kostel/<id>/` page lists the two days in the month before and
  carries them as schema.org `Event`s. Sitemap `lastmod` for church pages is now the
  registry's own date (build date only while the feast section is on the page).
  `scripts/check-prerender.mjs` reads the new pages back. IndexNow key file added.
- **seznam · mapa moved to a bottom bar**, in thumb reach, in both views. It fills the old
  blank strip under the map and owns the bottom safe area. (Pavol 1A, 2026-10-25)
- **"7:30⁺²" on map chips**: the number of further services that day that the same filters
  let through. (Pavol 2A, 2026-10-25)
- **Photos nightly**: `refresh-photos.yml` matches one grid cell per night, so the whole
  country is covered in about 3 weeks.
- **Church photos for the Brno area**: photos for 218 more churches (grid cell 49-16, 38%
  of it), 341 in total. Central Brno has 12 of 22. The matcher now rejects photos with
  the right patron but the wrong subject (a view *from* the tower, the rectory) and
  anything that isn't a jpg. `--recheck` re-applies the rules offline and `--ids` re-matches
  single churches. The other cells (Olomouc/Ostrava, Bohemia) aren't matched yet.
- **Fixed: monthly services shown every week.** A bare "1. neděle", "2. a 4. sobota" or
  "první pátek" (without "v měsíci") wasn't parsed, so a first-Sunday chapel showed as
  "dnes" on every Sunday. 8 services affected. (Pavol, 2026-10-25)
- **Fixed: filtered-out groups "disappear" on zoom.** With a filter on, a group of churches
  with no match drew as a grey count circle and then split into tiny dots. It now draws as
  the same faded dot from the start.
- **iOS: swipe back from a church page**: the native edge swipe with the slide animation
  (`allowsBackForwardNavigationGestures`, `MainViewController` in `AppDelegate.swift`).
- **Map popover shows the church's whole day**: one row per service (time, type, language
  if not Czech), with the shown one bold. Services excluded by your filters stay listed,
  faded. More than four rows ends in "+N další ›". (friends' feedback, 2026-10-21)
- **Back from a church lands where you left the map**, with its popover open again. A new
  location (GPS fix, another city) still recentres. `src/lib/mapMemory.ts`, in memory
  only. (friends' feedback, 2026-10-21)
- **Fixed: the iOS home-indicator swipe panned the map.** In map mode the map now stops at
  the bottom safe area, so the app-switch gesture starts on paper.
- **Moje kostely**: ☆ on a church saves it on the device. Starred churches show their next
  mass above the nearby list, at any distance. No notifications. (#37)
- **No location needed**: the six towns with the most churches are one tap away. (#37)
- **Holy days, quietly**: one line on the eve or the day of a weekday solemnity, with
  tomorrow's masses one tap away. (#37)
- **Fixed: blank app on iOS 15–16.3.** A regex lookbehind made the bundle unparseable on
  WebKit < 16.4 (the deployment target is 15.0). Guarded by `src/compat.test.ts` and a CI
  bundle scan. (#36)
- **Fixed: shared links.** Native Share sent `capacitor://localhost/…`; shares and `.ics`
  now use the public URL. (#36)
- **Fixed: slow GPS.** A fix arriving after the 10 s deadline is no longer thrown away.
  Native failures get phone wording instead of browser advice. (#36)
- **Fixed: Advent/Lent notes.** "pouze/jen v adventu", "během adventu", "v době adventní"
  and their Lent forms were not parsed, so Advent-only masses showed every week. (#39)
- **Web: 4,000 church pages** (`/kostel/<id>/`, previously HTTP 404 to crawlers), with
  Church JSON-LD and in the sitemap; **parish embed** (`embed.js`, `docs/EMBED.md`). (#36, #39)
- Telemetry: bots excluded; page_view carries route, referrer host, utm, language and
  platform; `list_ready` and `geo_late` events. No new identifiers. (#36, #37)
- Ops:
  - CI gives each ref its own concurrency lane, so a PR can no longer cancel a deploy.
  - Play phone screenshots added.
  - iOS releases can run on GitHub's hosted Macs (`release-ios.yml`).
  (#38, #40)

## 1.2 — 2026-08-23 (iOS)
- Name "Kam na mši". Church photos (Wikimedia Commons), confession times at selected
  Prague churches, a smoother map, and a church detail with a large photo hero. Intro
  guide. Witness chips built but gated off.

## 1.1 — 2026-08-08 (iOS)
- Map chips no longer drift or flash on pan. Dead parish links are dropped from the data.
  The map leads the store listing. The feedback copy says corrections reach the registry.

## 1.0 — 2026-07-27 (iOS, READY_FOR_SALE) · web soft-launch 2026-07-03
- Nearest masses by location; city pages; day and time filters; language, rite and
  barrier-free filters; church detail with the weekly schedule; .ics export; reminders;
  offline data with monthly over-the-air refresh; English UI; stale-schedule warnings.
  Retro: `docs/RETRO-v1.0.md`.

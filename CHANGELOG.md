# Changelog — Kam na mši

The web app deploys continuously from `main` (bohosluzby.dravec.org). Store versions
(iOS, Android) are cut from it; `VERSION` holds the current store version. Newest first.
Format: what a user notices first, then what an agent needs to know.

## Unreleased (web: live · iOS/Android: next store build)
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

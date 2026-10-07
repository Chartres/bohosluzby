# Kam na mši — evolve ledger (`/flywheel:evolve`)

Dated sections, newest first. Each run starts by scoring the previous run's picks against
their signal, then proposes new ones. Corrections stay visible; they are part of the record.

## 2026-10-07 — first run (revised the same day after a visitor-level pass)

### Corrections to the first pass
- **"GPS-free first paint fixes ⅔ of failures" — wrong.** The app already seeds the list from
  the last position and sends web denials to the picker (2 of those 29 visitors converted).
  The real defects were narrower: late fixes thrown away, browser advice shown in the native
  app (item 3; fixed in this run).
- **"Native converts 3× web" — withdrawn.** Only geo errors carried a `native` flag, so every
  "native visitor" had an error by construction. Native share and native conversion were
  unmeasurable. `page_view.platform` (shipped in this run) closes that.
- **"The filter event can't say which filter" — wrong.** It logs the full filter state.
- **"Monday = 50 visitors" — an artifact.** 30 visitors arrived 10 Aug 01:00–03:00 (Prague),
  almost certainly a crawler. Bots are now excluded client-side.

### Discover (last 60 days unless noted)
1. **Kill criterion missed and overdue.** "<50 weekly visitors after ČBK contact + one honest
   channel attempt by 2026-09-03 → maintain". Weekly visitors, last 10 weeks:
   4 · 49 · 13 · 29 · 11 · 8 · 20 · 23 · 22 · 32. Never 50. ČBK emailed 5 Jul, no reply
   logged; **no channel attempt logged**.
2. **Visitors 177**, of which 30 from the 10 Aug burst and 64 single-pageview, no-action
   visits. 16 opened a church detail (the `conversion`); 11 came back on ≥2 days.
3. **Geolocation.** Native app: `geo_deadline` 50 events from 12 visitors, about 4 each. The
   same iOS users hit it on most opens: a coarse iOS fix needs ~10–12 s and the 10 s deadline
   threw it away every time. Web: `geo_denied` 38 events from 29 visitors (picker shown).
4. **Filters.** 13 visitors used any filter. Time window (`kdy`) 11, radius (`okruh`) 6,
   mass-only 2, language 0, Greek rite 0, barrier-free 0, witness tag 1 (owner test).
5. **Defects found by reading the product back** (all fixed in this run):
   - `/kostel/<id>/` returned **HTTP 404** (GitHub Pages serves `404.html` with a 404 status).
     Every shared, `.ics` and city-page church link was a 404 to Google, Seznam, AI crawlers
     and link previews.
   - Native **Share** sent `capacitor://localhost/…` (iOS) and `https://localhost/…` (Android).
   - A **regex lookbehind** (since 9 Jul) made the bundle unparseable on iOS 15–16.3
     (deployment target 15.0): blank app, no telemetry.
6. **Witness chips**: gated off; 27 rows, all owner testing; `CORROBORATION_MIN` still 1.
7. **Sean Ellis**, all time: 24 very · 2 somewhat · 1 not (small n).
8. **Stores**: iOS ratings 0. Android built and signed-release-ready, not released (owner
   steps).
9. **Market.**
   - *Incumbent*: ČBK's official iOS app "Bohoslužby.Církev.cz" (Next Generation Solution
     s.r.o.). Same registry, Mapy.com map, filters for day/time/language/type/accessibility,
     parish details, offline basic data, Mapy.cz navigation. 5.0 from 1 rating; iOS only.
   - *CEE*: msze.info and "Godziny Mszy świętych" (PL, 2.4 M installs). DoKostola (SK): radius
     slider, holy-day alerts. Msze.LIVE: livestreams.
   - *Global*: Catholic Mass Times (140 k churches; favourites, confession/adoration, sharing),
     MassTimes.org (117 k), messes.info (FR, ~5 000 volunteer contributors). Hallow's parish
     partnerships: a Church tab with events, RSVP and notifications.
   - *Adjacent analogue*: transit apps (Transit). A proximity-sorted "next departures" list,
     the same shape as ours, plus lock-screen/home widgets and Live Activities with a
     countdown.
   - *Trend*: answer engines (Google AI Overviews, chat assistants) answer "when is mass at X"
     from Google Business Profiles and structured data. Wrong times send people to a locked
     church. Whoever publishes clean, dated, per-church schedules becomes the cited source.
10. **Telemetry gaps.** Closed in this run:
    - platform, route, referrer host, utm and UI language on `page_view`;
    - bot exclusion;
    - late GPS recoveries (`geo_late`).

    Still open: someone who reads the time off the list and leaves never opens a detail, so the
    north star undercounts successful visits.

### Define
- HMW make "50 weekly visitors" a channel instead of a wish: be where people ask for a mass
  time (search, answer engines, parish websites, Christmas)?
- HMW stop losing people to infrastructure (404s, blank screens, slow GPS) before they see a
  single time?
- HMW stand next to the official ČBK app instead of losing a head-to-head on the same data?
- HMW make it a weekend habit rather than a one-off lookup?
- **Binding constraint: reach.** The first pass said retention. At ~25 visitors a week the
  retention numbers are noise. The kill criterion is about reach, and the reach channel
  (long-tail search for a specific church) returned 404 until today.

### Develop → Deliver

Impact 1–5 · confidence H/M/L · effort S/M/L · reversibility (2-way = easy to undo).

| # | Idea | Kind | HMW | Signal | Imp | Conf | Eff | Rev | First cheapest test |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ✅ **4 000 church pages as the long-tail search / answer-engine source**: dated ordo, Church JSON-LD, sitemap. Shipped. Pavol submits the sitemap to Google Search Console + Seznam (10 min). | adjacent | reach | D5, D9 trend | 5 | M | S | 2-way | Search Console impressions on `/kostel/*`; `page_view.ref` = google/seznam |
| 2 | ✅ **Stop losing people to infrastructure**: late GPS fix, phone wording, iOS 15 parse fix, share links. Shipped on web; needs iOS build + Android tag. | adjacent | infra | D3, D5 | 4 | H | S | 2-way | native `geo_deadline` visitors ending in `geo_late` |
| 3 | **Rating prompt after the 3rd conversion** (native, StoreKit / Play in-app review) | adjacent | ČBK | D8 | 2 | M | S | 2-way | ratings count after 4 weeks |
| 4 | **Demote the unused filters** (language, rite, barrier-free) into one "více" sheet; keep `kdy` + `okruh` in the pill row. Removes chrome. | adjacent · remove | habit | D4 | 2 | M | S | 2-way | filter use unchanged; first-run tap-through unchanged |
| 5 | **Christmas pages** — `/vanoce/` + per-city "půlnoční / Štědrý den / Boží hod" lists. Online by mid-November so they get indexed. Filled by the 15 Dec registry refresh (parishes enter Christmas times in Advent) plus one extra refresh around 20 Dec. | mid | reach | D1, D9 | 5 | M | M | 2-way | visitors in the 21–27 Dec week vs 32 now |
| 6 | **Parish embed**: a one-line `<script>` "nejbližší mše u nás / v okolí" for parish websites, utm-tagged | mid | reach, ČBK | D9 (Hallow) | 4 | L | M | 2-way | 3 parishes embed it; `utm_source` visits |
| 7 | **Moje kostely + Saturday-evening reminder** (opt-in local notification, native) | mid | habit | D2 | 3 | M | M | 2-way | share of starrers back within 2 weekends |
| 8 | **Zpověď poblíž**: confession windows (registry + diocesan data we already have) as their own list. Peaks in Advent and Lent. | mid | reach, ČBK | D9 (Catholic Mass Times) | 3 | M | M | 2-way | Advent visits on the confession view |
| 9 | **Next-mass widget / Live Activity** (the transit pattern) | mid | habit | D9 analogue | 3 | L | L | 2-way | widget installs among native users |
| 10 | **ČBK's data-quality partner**: a monthly per-diocese report of stale (>18-month) and contradictory entries, plus correction diffs. We stay the "which one can I still make" front end. | radical · uses incumbent | ČBK | D1, D9 | 4 | L | M (mostly talking) | 2-way | one reply to one concrete report (Pavol signs off) |
| 11 | **Witness chips as private thanks to the parish**: drop the public line, send a monthly "poutníci ocenili…" note to the parish. Removes the Canon 220 risk and gives parishes a reason to point at the app. | radical · remove | ČBK, reach | D6 | 3 | L | M | 2-way | pilot parish reaction to one note |
| 12 | **Open mass-times feed for AI assistants**: per-church JSON plus `llms-full.txt` so assistants cite Kam na mši. The finder UI matters less than being the trusted, dated source. Depends on ČBK's redistribution terms (unanswered). | radical | reach | D9 trend | 4 | L | M | 1-way once published | assistant answers cite bohosluzby.dravec.org |

**Recommended top 3**
- **Quick win: #1, already shipped.** Remaining: Pavol submits sitemaps to Google Search
  Console and Seznam Webmaster. *Kill:* fewer than 100 impressions a week on `/kostel/*` by
  2026-11-18 means long-tail search is not our channel.
- **Mid bet: #5 Christmas pages.** Build by 15 Nov. *Kill:* the 21–27 Dec week stays under 100
  visitors. Then seasonal search is not a channel either, and the gate below resolves to
  MAINTAIN.
- **Radical probe: #10 ČBK data-quality partner.** One email carrying one concrete stale-entry
  report (outward, so Pavol signs it). *Kill:* no reply in 4 weeks; drop the incumbent route
  and stay a companion.

**Gate recommendation (Pavol decides).** ITERATE once, with a new dated criterion: "fewer
than 50 weekly visitors (bots excluded) in any week by 2026-12-31, Christmas week included →
MAINTAIN".
- *For:* the criterion required "one honest channel attempt", and none was made. For the whole
  window every church link was a 404 to search engines, and the app was blank on iOS 15–16.3.
  The test never ran under fair conditions.
- *Against:* 3 months live at ~25 a week, and an official ČBK app now exists. ITERATE can
  become a habit, so the playbook caps it at two in a row.

### Pavol's picks (2026-10-07, same day)
His numbers refer to the **first-pass** list (shown to him in chat), not the revised table
above. Mapped here:

| First-pass # | Idea | Decision | Where it went |
|---|---|---|---|
| 1 | Use the app without location permission | yes | Shipped: one-tap city chips on the no-location screen, on top of the late-GPS fix |
| 2 | Moje kostely + Saturday nudge | yes, **without the nudge** | Shipped: ☆ on the detail, "Moje kostely" above the list; nothing ever notifies |
| 3 | Lock-screen widget | — (not picked) | parked |
| 4 | Holy-day alerts | yes, **very subtle** | Shipped: one line on the eve/day of a weekday solemnity, "bohoslužby na zítra". Says "slavnost", not "zasvěcený svátek" (the CZ list of days of obligation is ČBK's call) |
| 5 | Parish embed | yes; asked about infra load | candidate; infra math below |
| 6 | ČBK data-quality partner | yes | Report shipped (`docs/registry-quality.md` + CSV); email drafted, Pavol sends |
| 7 | Chips as private thanks to parishes | likes it; "will users engage with no loop back?" | candidate, with the loop design below |
| 8 | Travel mode | yes | candidate |
| 9 | Rating prompt after 3rd conversion | yes | candidate (native release) |
| 10 | Siri / Assistant shortcut | yes | candidate (native release) |
| 11 | Release Android | Pavol does it | `docs/OWNER-TASKS.md`, 6 dated steps |
| 12 | Telemetry | yes, more detail **without identifying anyone more** | Shipped: page_view context (#36) + `list_ready` (time to a visible list, origin source); no new ids |

**Parish embed — what it costs the infra.** The embed would be `embed.js` (~3 KB gzipped)
plus one prerendered `embed/<id>.json` (~0.5 KB), both static and HTTP-cached.
- Load: 100 parishes × 3,000 page views a month ≈ 300 k loads × 4 KB ≈ 1.2 GB/month, about
  1 % of GitHub Pages' 100 GB soft limit. Cloudflare Pages (the Standard's host) has no
  bandwidth cap.
- What must not happen: logging every embed view to flywheel-core. At ~300 B a row that is
  ~90 MB a month against the 500 MB free database. So views stay unlogged; only clicks
  through count, as `page_view` with `utm_source=embed`.

**Witness chips as private thanks — closing the loop for the giver.**
- After tapping, they see: "Poděkování předáme farnosti v měsíčním dopise."
- Their own "ohlasy" list (on device) shows "odesláno farnosti v říjnu" once the monthly
  note goes out.
- Optional: the parish's own reply, published only if the parish wants.

The loop is "your thanks arrived", not a public count. Test: share of givers who give a
second time within 4 weeks, compared with the public-chip pilot.

### Open questions for Pavol
1. **Gate**: ITERATE to 2026-12-31 with #1 + #5 as the channel attempt, or MAINTAIN now?
2. **ČBK**: send #10 (a concrete stale-entry report) as the second contact, or stay quiet and
   be the companion?
3. **Witness chips**: keep the public line (phase 2 of WITNESS-RELEASE-PLAN), or switch to
   private thanks to parishes (#11)?

# Kam na mši — evolve ledger (`/flywheel:evolve`)

Dated sections, newest first. Each run checks whether the previous run's picks moved
their signal before proposing new ones.

## 2026-10-07 — first run

### Discover
1. Weekly visitors, last 10 weeks: 4 · 49 · 13 · 29 · 11 · 8 · 20 · 23 · 22 · 32. Flat at ~20–30.
2. Conversions (church detail opened from the list): 13 in 30 days.
3. Returning visitors (≥2 days in 30d): 8 of ~90. Almost nobody comes back.
4. Day-of-week (60d unique visitors): Sun 57 · Mon 50 · Sat 44 · Tue–Fri 10–17. A weekend tool.
5. Errors (30d): 46 of 47 are geolocation (`geo_deadline` 28, `geo_denied` 16, `geo_timeout` 2).
6. Native: 1–5 visitors a week on iOS; App Store ratings 0. Android built, never released (no tag).
7. Witness chips: gated off; 27 rows, all owner testing, last 17 Aug; `CORROBORATION_MIN` still 1.
8. Sean Ellis all-time: 24 very · 2 somewhat · 1 not (small n, strong).
9. **Market: ČBK shipped an official iOS app** "Bohoslužby.Církev.cz" (map, time/language/
   accessibility filters, regular + irregular services, navigation) on the same registry.
   Global apps (Catholic Mass Times, MassTimes.org) add favourites, confession/adoration
   times, travel mode, share. messes.info (FR) runs on 5,000 volunteer contributors.
10. Telemetry gaps: no referrer/path on page_view; the `filter` event logs every key, so
    which filter people use is unknowable.

### Define
- HMW make Kam na mši something people return to every weekend, not once?
- HMW get a mass on screen when GPS fails (two thirds of visits that error)?
- HMW stand next to the official ČBK app instead of losing a head-to-head on the same data?
- HMW make the witness chips reach critical mass with ~25 users a week?
- **Binding constraint now: retention** (8 returning in 30 days).

### Develop → Deliver

| # | Idea | Kind | HMW | Impact | Effort | First cheapest test |
|---|---|---|---|---|---|---|
| 1 | **GPS-free first paint**: show the list for the last city / IP-city instantly, refine when GPS lands; shorter deadline, coarse accuracy | adjacent | GPS | 5 | S | geo-error share and conversions per visit, 2 weeks before/after |
| 2 | **Moje kostely + Saturday-evening nudge**: star churches; opt-in local notification "Zítra 9:00 u sv. Ludmily" | mid | return | 5 | M | % of starrers who come back next weekend |
| 3 | **Lock-screen / home widget**: next mass countdown (iOS widget + Live Activity, Android widget) | radical | return | 4 | L | widget installs among native users |
| 4 | **Zasvěcené svátky alerts**: "zítra je slavnost, mše v okolí" on holy days of obligation | mid | return | 4 | S | open rate on the next holy day (1 Nov) |
| 5 | **Parish embed**: `<script>` widget "nejbližší mše v okolí" for parish websites | radical | ČBK / distribution | 4 | M | 3 parishes embed it; referrer traffic |
| 6 | **Become ČBK's data-quality partner**: offer stale-entry detection + correction diffs to their registry; we stay the "kterou stihnu" front-end | radical | ČBK | 4 | M (mostly talking) | one reply from ČBK / NGS |
| 7 | **Chips as private thanks to the parish**: drop the public line; monthly "poutníci ocenili…" note to the parish. Removes the Canon 220 risk entirely and gives parishes a reason to promote the app | radical / remove | chips | 4 | M | pilot parish reaction to one note |
| 8 | **Travel mode**: "jedu Praha → Brno v neděli" → masses at arrival time along the route | mid | return / differentiation | 3 | M | share of visits >50 km from home city |
| 9 | **Rating prompt after the 3rd conversion** (native): 0 ratings vs an official competitor | adjacent | ČBK | 3 | S | ratings count in 4 weeks |
| 10 | **Siri / Google Assistant shortcut** "Kdy je nejbližší mše?" (App Intents, Android App Actions) | mid | return | 3 | M | shortcut invocations |
| 11 | **Release Android** (owner steps pending) | adjacent | reach | 3 | S | Play installs |
| 12 | **Telemetry fix**: `filter` logs only the changed key; page_view carries referrer + path + utm | adjacent | measurement | 2 (enables all) | S | can answer "which filter, from where" next run |

**Recommended top 3**
- Quick win: **#1 GPS-free first paint** (+ #12 alongside). Kill test: geo errors per visit do not drop by half.
- Mid bet: **#2 Moje kostely + Saturday nudge**. Kill test: <20% of starrers return within 2 weekends.
- Radical probe: **#7 chips as private thanks** (replaces phase 2 of WITNESS-RELEASE-PLAN). Kill test: the pilot parish shrugs.

### Open questions for Pavol
1. Is beating the official ČBK app a goal, or is being its best companion (#5, #6) acceptable?
2. Would you trade the public chip line for private thanks to parishes (#7)?
3. Is a Saturday-evening notification acceptable, or too pushy for a reverent tool?

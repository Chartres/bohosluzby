# PERSONAS.md — Bohoslužby

Detailed personas with **concrete journeys**. These are the test scripts for the persona
pass (e2e + manual seasonal) and the lens for feature selection: a feature that serves no
journey below needs a new persona (with evidence) before it gets built. Behavioral, not
demographic — each one is defined by a trigger, a constraint, and a finish line.

How to use:
- **Testing:** every journey marked `e2e` runs in `e2e/personas.spec.ts` (plus the older
  specs noted). Journeys marked `manual/seasonal` are walked by hand (or browse daemon)
  when their season comes — the shots land in `e2e/shots/` like any persona evidence.
- **Feature selection:** when a user ask or an idea comes in, name the persona and journey
  it serves. No match → park it in the backlog with a `persona:?` tag; it competes for a
  slot only after a second independent signal (see flywheel `docs/standards/mini-scrum.md`).

---

## P1 · Marie — "mše hned, jsem tu cizí" (anchor persona)

Friday late afternoon, unfamiliar Prague district, phone in hand, wants the nearest mass
she can still make. No patience for configuration; the list must be right on first paint.

- **Trigger:** spontaneous — a free evening, a habit kept.
- **Constraint:** time-to-first-useful-row < 5 s; one thumb; outdoors in daylight.
- **Journey (e2e — `hero.spec.ts`):**
  1. Open app → allow location.
  2. Read the first three rows: time, "za X min", distance, church name.
  3. Tap a row → detail → tap navigace.
- **Done:** she is walking toward a real mass within 30 seconds of opening.
- **Watch for:** anything that delays or reorders the hero list (the HNED regression this
  file exists because of), permission-denied path (city picker fallback).

## P2 · James — tourist, Sunday mass in his own language

Weekend in Prague, practicing Catholic, wants Sunday mass in English — Latin acceptable,
Czech only as a last resort. Doesn't know districts; hotel address means nothing to him.
Czech UI doesn't stop him (he pattern-matches "neděle", times, church names), but the
language filter is the one control he must find.

- **Trigger:** planned — Saturday evening, planning tomorrow morning.
- **Constraint:** foreign language; no local knowledge; picks by time + language, not distance.
- **Journey (e2e — `personas.spec.ts`):**
  1. Open app (location allowed, hotel in centre).
  2. Tap **neděle** → full Sunday ordo.
  3. Open filtry → set **jazyk: anglicky**.
  4. List narrows to English masses; pick one mid-morning.
  5. Detail → "do kalendáře" (ICS) so it's on his phone calendar with the address.
- **Done:** one English Sunday mass in his calendar, address attached.
- **Watch for:** language list only offers languages that actually exist nearby (no dead
  options); ICS carries the right local time; filter + den compose in the URL (shareable
  with his wife).
- **Feature gates:** any future i18n/UI-translation work starts from this journey — the
  journey must prove Czech-only UI actually blocks him before we invest.

## P3 · Tomáš — office worker, lunch-window mass

Works in the centre; has a real window 11:45–13:00 between meetings. Wants a weekday mass
that fits inside it, walking distance from the office, and he needs to know it reliably
runs — a cancelled mass costs him the only window he had.

- **Trigger:** recurring weekday habit (Ash Wednesday started it; now it's Tuesdays).
- **Constraint:** hard time box; reliability matters more than distance.
- **Journey (e2e — `personas.spec.ts`):**
  1. Open app at the office ~10:30.
  2. Kolem **12:00** (±90 min window matches his time box).
  3. Pick the 12:00 mass nearby → detail → check the note line (no "dle ohlášení"
     uncertainty; freshness "naposledy ověřeno" recent).
- **Done:** at his desk by 13:00, mass attended.
- **Watch for:** the ±90 min "kolem" window honoring the clock edge; unverifiable notes
  ("nepravidelně, dle ohlášení") loudly marked, never silently dropped.

## P4 · Novákovi — family driving home, evening mass on the itinerary

Sunday afternoon, driving back from a cottage weekend, mass not yet attended. The driver
wants an evening mass either along the route or in their home city — decided from the
passenger seat, five minutes at a rest stop.

- **Trigger:** obligation + logistics — "stihneme večerní?"
- **Constraint:** origin is not "here" (it's where they'll be); evening only; car, not foot.
- **Journey (e2e — `personas.spec.ts`):**
  1. Open app → **změnit** → pick the destination city (no geolocation dependence).
  2. **dnes** + **večer**.
  3. Compare the 18:00 / 20:00 options; pick by time cushion, not distance.
  4. Share the row (sdílet) into the family chat.
- **Done:** one evening mass chosen before the car leaves the rest stop.
- **Watch for:** city landing works without a location prompt; večer band + city origin
  compose; distance shown but never used to exclude (they're driving — the ranking fix
  from July 2026 is exactly this persona's guarantee).

## P5 · Ludmila — feast on a workday

Retired, devout, structures her week around the liturgical calendar. On a slavnost that
falls on a Tuesday (Cyril a Metoděj, Nanebevzetí Panny Marie) she wants the fuller
schedule parishes put on — and she notices when the app treats a feast like any other
workday.

- **Trigger:** the calendar itself — she knows the feast is coming.
- **Constraint:** trusts print-era conventions; the feast must be *visible*, not inferred.
- **Journey (partial e2e — `day.spec.ts` feast tint; rest manual/seasonal):**
  1. Open app early in the feast week.
  2. Day picker: the feast day's chip carries its liturgical tint + name on hover/label.
  3. Pick the day → ordo shows regular masses **plus** any published one-off feast masses.
  4. Missing feast masses at her parish → she checks the parish detail page's freshness
     line to judge whether the data is stale or the parish just hasn't published.
- **Done:** she knows where the feast mass is, or knows the app honestly doesn't know.
- **Feature gates:** this journey is the evidence line for any future "svátky" mode
  (pre-harvest one-offs around major feasts). Until the registry carries feast schedules,
  the app's job is honesty about what it has, not invented completeness.

## P6 · Věra — did the summer schedule change?

Regular parishioner back from three weeks away. Her parish historically drops the 10:30
Sunday mass in July/August. She doesn't want to walk to a locked church — she wants to
*verify* before Sunday.

- **Trigger:** seasonal doubt — "o prázdninách to bývá jinak."
- **Constraint:** needs the *reason* visible, not just an absent row (an absent row could
  be a bug; a note is an answer).
- **Journey (e2e — `personas.spec.ts`):**
  1. Search/select her church directly (změnit → church by name).
  2. Detail page: weekly ordo shows the 10:30 with its note ("kromě července a srpna")
     visibly excluded in season.
  3. Freshness line ("naposledy ověřeno …") tells her how much to trust it.
  4. Hero list cross-check: in July the 10:30 does not appear as her church's next mass.
- **Done:** she knows which mass runs *this* Sunday and why the other one doesn't.
- **Watch for:** note-parser honesty (provable exclusions excluded, unverifiable notes
  kept + flagged); the freshness line never missing on detail.

## P7 · Ondřej — Triduum / Christmas planner

Choir member and the family's liturgical logistician. Twice a year (Holy Week, 24–26 Dec)
he plans multiple services across two churches for five people — Maundy Thursday, Good
Friday, the Vigil, plus "kdy je půlnoční?".

- **Trigger:** the two liturgical peaks; planning starts a week out.
- **Constraint:** these services mostly do **not** exist as regular rows in the registry —
  they're one-offs parishes may or may not publish. Highest-stakes, lowest-data journey.
- **Journey (manual/seasonal — walk it in Holy Week and the week before Christmas):**
  1. Pick Zelený čtvrtek / Štědrý den in the day picker (day chips show feast tint).
  2. Ordo: whatever one-offs parishes published appear in-day; regular rows that
     provably don't run (parish note) are excluded.
  3. Detail pages of his two churches: extras section + freshness line.
  4. ICS-export the chosen set.
- **Done:** the family plan exists in his calendar; no service in it turns out cancelled.
- **Feature gates:** the strongest candidate signal for a seasonal data harvest
  (`data/extract.mjs` re-run cadence around the peaks) and a "svátky" surface. Run this
  journey manually each peak **before** building anything — the gap it documents is the
  PRD for that feature.

---

## Journey ↔ automation map

| Persona | Journey | Where it runs |
|---------|---------|---------------|
| P1 Marie | hero list, hned | `e2e/hero.spec.ts` (existing) |
| P2 James | neděle + jazyk + ICS | `e2e/personas.spec.ts` |
| P3 Tomáš | kolem 12:00 lunch window | `e2e/personas.spec.ts` |
| P4 Novákovi | city + dnes + večer + sdílet | `e2e/personas.spec.ts` |
| P5 Ludmila | feast chip + feast ordo | `e2e/day.spec.ts` (tint) + manual on real feasts |
| P6 Věra | summer note on detail + hero cross-check | `e2e/personas.spec.ts` |
| P7 Ondřej | Triduum/Christmas plan | manual/seasonal (Holy Week, 20–24 Dec) |

Seasonal manual passes are due: Holy Week (P7), the week before Christmas (P7), the first
week of July (P6 live re-check), and any workday slavnost (P5). Log each pass as shots in
`e2e/shots/` with a `seasonal-` prefix. In the same weeks, dispatch the
**Refresh data** workflow (`.github/workflows/refresh-data.yml`, monthly cron otherwise)
so late-published feast one-offs reach the site before the pass.

# UX walkthrough — červenec 2026 (JTBD persony)

Method: Playwright against the local preview (`npm run preview`), real committed dataset
(3 991 kostelů, 7 755 bohoslužeb), mocked geolocation + clock per persona. Every state
screenshotted and visually inspected (Standard: persona testing is visual). Findings feed the
fix list below; per-fix evidence lands in `e2e/shots/`.

## Persona walkthroughs

### 1. Cestovatel v neznámém městě (Olomouc, neděle 8:20, mše v 9:00)
Journey works: geolocate → first row "09:00 · farní kostel sv. Mořice · 200 m · za 39 min".
The 40-minute question is answered in one glance; detail gives mapa/navigace.
- Hit: rows with an empty service type render a dangling separator ("Olomouc · 200 m · ") —
  typographic slop in exactly the hero moment. (Own finding F1, fixed.)
- Hit: to check "je to daleko?" for a *different* row he must open the detail — no map link
  in the row. (Pavol #2, fixed.)

### 2. Rodič plánující nedělní mši (pátek → neděle, bezbariérově, Brno)
Day picker "neděle" gives the full chronological Sunday ordo — planning works. The
`bezbariérové` filter yields an honest empty state with "Zrušit filtry".
- Reality check: the registry marks **0 of 41** Brno churches barrier-free (393 of 3 991
  nationwide). The empty state is data truth, not an app bug; noted as a registry gap. (F2, logged.)
- Hit: 5. 7. is Cyril a Metoděj — the ordo gave no hint the Sunday obligation interacts with a
  solemnity. Feast highlight was missing. (Pavol #3, fixed.)

### 3. Senior (velké písmo, málo trpělivosti, ověřuje telefonem)
At 24 px root font the layout holds — no overlap, no clipped text; typographic pickers (day,
filters) are plain text buttons, no custom widget traps.
- Hit: parish contacts (telefon) are only in the detail, *below* the full weekly ordo — but they
  are present and `tel:` links work. Acceptable; kept.
- Hit: the sampled village detail showed "naposledy ověřeno 28. 4. 2009" — 17 years stale, set
  quietly. Honest but easy to miss at a glance; candidate for a louder staleness warning. (F3, logged.)
- Hit: the city datalist picker is effectively unusable for him (see #4). Fixed via typeahead.

### 4. Řeckokatolík z Ukrajiny v Praze
`řeckokatolické` filter → 3 rows incl. katedrála sv. Klimenta (ukrajinsky, za 14 min).
Language filter offers `ukrajinsky`. Journey works end-to-end. No fix needed.

### 5. Červencový turista (Hostěradice — rozpisy plné letních výjimek)
**Lied to.** First row: "18:00 · kostel farní sv. Kunhuty · do 100 m · *mimo červenec a srpen*
· za 1 h 59 min" — the mass provably does not run in July; the church's actual July mass (19:00,
"období od července do srpna") sat one row below it. Same screen: "školní rok" rows shown in
July, "kromě letních prázdnin" rows shown in July. Trust-critical. (Pavol #8, fixed — parser +
exclusion + warning rubric for unparseable conditional notes.)

### 6. Hledač konkrétního kostela ("vím, kam chci jít")
Before: no direct lookup at all — a known church was reachable only by geolocating near it or
paging a broken city picker. Now: the unified typeahead (header "změnit" / the no-location hero)
finds churches by name diacritics-insensitively — "tyn" → farní kostel Matky Boží před Týnem
(verified against the full dataset), Enter/click lands on `/kostel/<id>/`, whose document title
("… — pořad bohoslužeb | Bohoslužby") makes the deep link a good bookmark/share target.
(Fixed together with #4.)

## Root causes found (Pavol's confirmed issues)

- **#7 past masses after day-switch**: NOT a stale `now` — reproduced with a frozen clock.
  The ordo view can render two rows with the same `(church, start)` (e.g. sv. Havla, Praha has
  two 12:15 entries: "kromě období letních prázdnin" + "pouze v červenci a srpnu", plus a
  `days:"1234512345"` registry quirk) → duplicate React `key` → production React reconciles the
  next render against a corrupted keyed map and leaves phantom rows from the previous view
  (morning masses at noon, no rubric, no countdown). Fix: unique keys; the duplicate-visibility
  itself is resolved by the #8 note parser (only the season-true row survives).
- **#4 city picker ends at "Dubí"**: the dataset has 3 259 raw city values; Chromium caps
  `<datalist>` suggestions at 512 entries — "Dubí" is exactly index 512 in Czech collation.
  Also diacritics-sensitive ("ceske" → no match) and raw values ("Praha 1", "quarter, obec")
  instead of municipalities. Replaced with a diacritics-insensitive keyboard-navigable typeahead
  over `aggregateCities` (all municipalities). Interactive map: out of scope (needs a tile
  provider — deferred, would break $0 infra).
- **#5 no way back**: "změnit" destroyed the origin and showed the *"Bez přístupu k poloze"*
  copy even to users who had granted location — misleading and irreversible. Picker is now a
  state with zpět/Escape that keeps the previous origin.

## Own findings (ranked)

1. **F1 (fixed)** Dangling "·" in list rows when the registry omits the service type — hits the
   most common surface (Olomouc, Brno rows).
2. **F2 (logged)** Barrier-free coverage is a registry gap (393/3 991; 0 in Brno). Consider a
   note in the filter empty-state naming the data source limitation.
3. **F3 (logged)** Freshness line can be decades old ("ověřeno 2009") and reads the same as
   "ověřeno minulý týden". Consider a warning style past some age threshold.
4. **F4 (logged)** `days:"1234512345"` -style registry quirks (duplicated digit sets) decode
   fine (the weekday set dedupes) but hint the extractor should normalize.
5. **F5 (logged)** The language `<select>` in the filter bar renders its chevron at the far edge
   of its `max-w-40` box, visually detached from a short selected value ("LATINSKY   ⌄").
   Cosmetic; shrink-to-content would fix it.

## Note-parser coverage (fix #8, measured on the committed dataset)

7 755 services · 4 151 without a note · **3 604 with a note** (1 504 unique). Of the noted ones:

| class | count | share of noted |
|---|---|---|
| date-constrained, fully interpreted | 2 176 | 60.4 % |
| descriptive, no date condition | 502 | 13.9 % |
| **interpreted with certainty** | **2 678** | **74.3 %** |
| conditional but unparseable → kept + warning rubric | 926 | 25.7 % |

Direction of trust: only provable exclusions exclude; the 926 uncertain notes are never hidden —
they print in rubric red on the row. Largest uncertain families: "1x za 14 dní" without parity
(45), "1x za 14 dní, jinak" (27), "1x za měsíc" without a week (24), year-qualified school-year
ranges, "dle ohlášení".

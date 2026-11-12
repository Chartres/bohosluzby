# Roráty and Vánoce pages — plan (3 Nov 2026, updated 5 Nov)

Status: **Pavol's call, 5 Nov: roráty before 29 Nov, Christmas after the December pass.**
The PR (#94) stays unmerged until the roráty pass is done; it ships on Sat 28 Nov evening.
The build renders only the Advent pages (`SEASON_KINDS` in `scripts/prerender.mjs`); the
Christmas code stays in `season.ts` for December. The pass checklist is
[`RORATY-PASS.md`](RORATY-PASS.md). Advent 2026 starts on Sun 29 Nov, and Christmas Eve is
Thu 24 Dec.

## What the draft does
- `/advent/<town>/` lists roráty and `/vanoce/<town>/` lists 24.–26. 12. Both are static, with
  no script, in the Dušičky shape (`src/domain/season.ts`, `scripts/prerender.mjs`). Hubs are at
  `/advent/` and `/vanoce/`. The pages are kept out of the sitemap until the ship call.
- **Every row names its source.** A row from `data/corrections.json` links the parish notice
  and gives its date ("ohlášky farnosti (ohlášky 22. 11. 2026)"). A row from the registry gives
  the date the schedule was last verified ("rejstřík ČBK, ověřen 6. 9. 2016").
- **Advent** lists registry rows whose type or note says roráty and that run in Advent (by
  parseNote, so "kromě adventu" rows drop out), plus roráty one-offs dated in Advent. Notes
  that name a past year ("v adventu 2019") are skipped.
- **Christmas** lists only rows dated 24 Dec (from 15:00), 25 Dec or 26 Dec. A weekly row says
  nothing about Christmas Eve, so weekly rows are left out on purpose.

## Why it needs data passes
The registry alone can't fill these pages (3 Nov):

| | registry today |
| --- | --- |
| rows naming roráty | 31 rows, 25 churches |
| towns that would get a roráty page | 4 (Praha, Kolín, Hořovice, Chrudim) |
| one-offs dated 24 Dec | 0 |
| weekly rows that happen to fall on the evening of 24 Dec | 710, deliberately not listed |

Without the passes, the roráty view is thin and the Christmas view is empty.

## Pass 1: roráty, 22–28 Nov
- **When:** parishes announce roráty on Christ the King Sunday (22 Nov), in the Advent
  bulletins of that week, and on the 1st Sunday of Advent (29 Nov). The pass runs 22–28 Nov in
  daily batches, with a last batch on the morning of 29 Nov.
- **Scope:** the same 30 largest towns as Dušičky, largest first. Inside each town, the
  parishes come in this order: those with a roráty row in the registry, then cathedrals and
  city-centre parishes, then the rest.
- **Source rule:** the same as Dušičky. A 2026 notice that names the church, the days and the
  time. "Roráty po–pá v 6:30" in a notice dated November 2026 for that church counts. An
  undated standing schedule doesn't. If a notice gives the time but doesn't name the church,
  the row is held.
- **Record format (landed 5 Nov):** a `data/corrections.json` entry can carry
  `"from"/"to"/"days"` (with `"except"`), or `"dates": [...]`. It expands to dated one-offs
  with the same source, quote and checked fields (`expandCorrections` in
  `data/corrections.mjs`). On the page, one notice is one row: "po–pá 30. 11. – 23. 12.,
  kromě 8. 12.". `data/roraty-check.mjs` checks a batch before it goes in.
- **Review:** as in #79–#86. An independent subagent re-fetches every source and checks the
  2026 date, the church, the days, the time and the quote. A source the reviewer can't reach
  is held. No bot-wall workarounds, and no contact with parishes.
- **Ship:** each batch merges on green CI plus a clean review, and is read back live at 390 px.

## Pass 2: půlnoční and Christmas, 14–23 Dec
- **When:** Christmas programmes appear in the bulletins of the 3rd and 4th Sundays of Advent
  (13 and 20 Dec). The pass runs 14–23 Dec in daily batches; the last merge is the evening of
  23 Dec.
- **Scope:** the same 30 towns; 24 Dec from 15:00 (children's, evening and midnight Masses),
  25 Dec and 26 Dec.
- **Source rule and review:** as above. A půlnoční at 24:00 is written as "24:00" so it sorts
  last and reads as midnight.
- **What the page says:** only what the sources say. Where a town has nothing, the day reads
  "Zatím tu nic není. Vánoční pořad doplníme z ohlášek farností."

## Decisions taken in the draft (reversible)
- **Weekly rows off the Christmas page.** Listing 710 ordinary Thursday rows as "24 Dec
  evening" would be wrong more often than right.
- **Variant roráty rows are listed.** These are rows like "v adventu rorátní" on an all-year
  Mass (#90); in Advent they are the roráty.
- **No sitemap entry, no link from the app or the Dušičky hub** until Pavol says ship.

## Decided (Pavol, 5 Nov 2026)
- Roráty pages ship before 29 Nov, with the towns pass 1 fills.
- Christmas pages ship after pass 2 (14–23 Dec).
- At the roráty ship: sitemap entry and links from the app and the Dušičky hub, as with the
  Dušičky pages (Pavol, 8 Nov).

## Open for Pavol
- The wording for corrected rows ("mimořádná" and the like) is Pavol's call. The draft shows
  the source instead of a label.

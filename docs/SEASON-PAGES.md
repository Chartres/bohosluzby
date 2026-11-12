# Roráty and Vánoce pages (3 Nov 2026, updated 5 and 12 Nov)

Status: **live since 12 Nov 2026 (Pavol, 12 Nov: option A).** `/vanoce/` and `/advent/` render
for every Dušičky-size town (3+ churches, 181 towns), are in the sitemap and linked from the
home page and `public/llms.txt`. A town with nothing published still gets its page: it names
each church, says "rozpis zatím farnost nezveřejnila" with the register date, and links the
parish website or the church page. The data passes below fill them. This supersedes the 5 Nov
call (Christmas only after the December pass). The pass checklist is
[`RORATY-PASS.md`](RORATY-PASS.md); the passes now merge into `main`, not into #94. Advent 2026
starts on Sun 29 Nov, and Christmas Eve is Thu 24 Dec.

Kill line (BACKLOG): the 21–27 Dec week under 100 visitors.

## Markdown twins (for assistants)
Every season page has a static twin next to it, `index.md` (`/vanoce/praha/index.md`, hubs
`/vanoce/index.md` and `/advent/index.md`), written by `scripts/prerender.mjs` from the same
`seasonCityPage` call, so the two never disagree. The twin holds more than the HTML: a table
row per service with church, town and GPS, time, days, kind and note, rite, language,
barrier-free flag, the date the register entry was last verified, the source (register or the
linked parish notice), the church page and the parish website; then every church in the town
with no schedule yet. It states the build date and the register snapshot
(`public/data/version.json` `generated`). The HTML links it with
`<link rel="alternate" type="text/markdown">`, the sitemap and llms.txt list it. Each HTML
page carries a schema.org Event per service date. GitHub Pages serves the files; the domain
sits behind Cloudflare, so the CDN caches them. Twins exist only for these season pages:
twins for all ~4,000 church pages or the whole dataset were deferred (Pavol, 12 Nov, option B,
over the data-copying risk). `scripts/check-prerender.mjs` fails the deploy if a town page or
twin is missing, undated, unsourced or out of the sitemap.

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
  "Na tento den rozpis zatím žádná farnost nezveřejnila (stav rejstříku k …)", and each church
  without a schedule is listed with where to check.

## Decisions taken in the draft (reversible)
- **Weekly rows off the Christmas page.** Listing 710 ordinary Thursday rows as "24 Dec
  evening" would be wrong more often than right.
- **Variant roráty rows are listed.** These are rows like "v adventu rorátní" on an all-year
  Mass (#90); in Advent they are the roráty.
- ~~No sitemap entry until Pavol says ship~~: shipped 12 Nov with sitemap, home-page and
  llms.txt links. The in-app link is still open (a visual change: shots first).

## Decided (Pavol, 5 Nov 2026)
- Roráty pages ship before 29 Nov, with the towns pass 1 fills.
- Christmas pages ship after pass 2 (14–23 Dec). Superseded 12 Nov: they ship now, honest
  when empty, and pass 2 fills them.
- At the roráty ship: sitemap entry and links from the app and the Dušičky hub, as with the
  Dušičky pages (Pavol, 8 Nov).

## Open for Pavol
- The wording for corrected rows ("mimořádná" and the like) is Pavol's call. The draft shows
  the source instead of a label.

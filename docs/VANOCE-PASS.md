# Christmas pass, 14–23 Dec 2026 — checklist

Pass 2 of [`SEASON-PAGES.md`](SEASON-PAGES.md): fill `/vanoce/<town>/` and the app with the
Christmas Masses the parishes announce. Same rules as the roráty pass
([`RORATY-PASS.md`](RORATY-PASS.md)); this file has what differs and the tools that are ready.
Prepared 23 Nov 2026 so that the pass only fills data.

## What is ready (23 Nov)
- **Pages:** `/vanoce/` and the town pages are live and honest when empty. They list rows dated
  24 Dec from 15:00, 25 and 26 Dec. A notice that confirms a weekly Mass (25 Dec 2026 is a
  Friday, so "25. 12. v 9:00" at a church with Friday 9:00 is common) is listed from the notice,
  with the notice as source (`season.ts`, `datedRows`).
- **App:** a dated row at `24:00` counts as 00:00 the next day (`occurrences.ts`). Before this, the
  app dropped it. **Apps older than the build that carries this change don't show a 24:00 row at
  all.** The change has to be in the build Pavol submits before Christmas.
- **Checker:** `node --experimental-strip-types data/vanoce-check.mjs batch.json` (below).
- **Site list:** `node --experimental-strip-types data/pass-sites.mjs --towns 30 --mark 'půlnoční|vánoč' > sites.json`
  gives the 30 largest towns, one entry per parish website with its churches (183 sites on 23 Nov).
  The 22 sites that showed a bot wall on 22 Nov (`data/pass-blocked.json`) are listed apart and
  never queued. Remove a site from that file only after it opens normally.
- **Pill draft:** `data/views-drafts/vanoce.json`, label "Vánoce", shown 19–26 Dec, listing
  24 Dec from 15:00, 25 and 26 Dec. It is **not live**: screenshots go to Pavol first, then it
  moves into `public/data/views.json` (data only, over the air). The 1.6 app reads it.

## Each day, 14–23 Dec (last merge the evening of 23 Dec)
1. **Read.** Christmas programmes appear in the bulletins of the 3rd and 4th Sundays of Advent
   (13 and 20 Dec), in "vánoční pořad bohoslužeb" pages, and on parish calendars. Find them from
   the site's own index (notices, aktuality, site search, `sitemap.xml`), never from guessed URLs.
   Bot walls (403/429, captcha, challenge, login) go on the blocked list. Never get around them,
   and never contact a parish.
2. **Source rule.** A 2026 notice that names the church, the day and the time. "Půlnoční ve 24:00"
   without a church, in a parish with several churches, is held.
3. **One record per church and day** (no ranges at Christmas):
   ```json
   {"id": "<registry id>", "church": "…", "town": "<slug>", "date": "2026-12-24",
    "add": [["24:00", "mše sv.", "půlnoční"], ["16:00", "mše sv.", "štědrovečerní, pro děti"]],
    "source": "<link to the notice>", "source_date": "vánoční pořad bohoslužeb 2026",
    "quote": "<verbatim, short>", "checked": "2026-12-1x"}
   ```
   - Dates: 24 Dec from 15:00, 25 Dec, 26 Dec. Morning Masses on 24 Dec are still Advent.
   - Midnight is `24:00` on the 24th, never `00:00` on the 25th.
   - The note (third field of `add`) names the Mass with one of: `půlnoční`, `štědrovečerní`,
     `vigilie`, `slavnost Narození Páně`, `svátek sv. Štěpána`, `jitřní`, `pastýřská`. Add
     "pro děti", a language or "s koledami" after it. The page, its calendar events and the pill
     find rows by these words.
   - The fourth field is the language if not Czech: `["10:00", "mše sv.", "slavnost Narození Páně", "anglicky"]`.
4. **Check:** `node --experimental-strip-types data/vanoce-check.mjs batch.json`. It fails on a
   missing source, date or quote, an unknown id, a date outside 24–26 Dec, a time before 15:00 on
   the 24th, `00:00`, a note that doesn't name the Mass, or a record the page would not show. It
   prints each row as the page will show it.
5. **Independent review:** a subagent that did not write the batch re-fetches every source and
   checks the 2026 date, the church, the day, the time and the quote. What it can't reach is held.
6. **Merge:** append to `data/corrections.json`, run `node data/corrections.mjs` and
   `npx vitest run data/`. PR, green CI, squash-merge. Data only: live over the air.
7. **Hand-back for the day:** towns, rows, held, blocked.

## Brief for a reading subagent
Give it this file, its site group (`sites-<G>.json` cut from `pass-sites.mjs` output) and these
lines: read only the sites in the group; plain `curl -sSL --max-time 25`; at most ~6 requests a
site; PDFs into a new empty folder, `pdftotext -layout`; write `batch-<G>.json` (records as above)
and `report-<G>.json` (one object per site: `site`, `town`, `status` ok / not-yet / held /
blocked / error, `url_checked`, `note`); validate the JSON; reply with a five-line summary.

## Before 19 Dec
- [ ] Screenshots of the Vánoce pill at 390 px (pill row, the list with it on) to Pavol.
- [ ] On his OK, move the entry from `data/views-drafts/vanoce.json` into `public/data/views.json`.
- [ ] The build Pavol submits carries the `24:00` fix (1.6 build 96 or later).

## Limits
No store submissions, no emails or posts, no contact with parishes, no Supabase writes.

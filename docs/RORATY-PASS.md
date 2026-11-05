# Roráty pass, 22–28 Nov 2026 — checklist

Pavol's call, 5 Nov 2026: roráty pages before 29 Nov, Christmas after the December pass.
Background and the page design: [`SEASON-PAGES.md`](SEASON-PAGES.md). The dry run of this
checklist on 5 parishes (5 Nov, on last year's notices) is in
[`review/2026-11-05-roraty-dryrun.md`](review/2026-11-05-roraty-dryrun.md).

## Before 22 Nov
- [ ] Draft PR #94 is up to date with main and CI is green. Do not merge it before the pass is done.
- [ ] Town order: the 30 largest towns, largest first (the Dušičky list). Inside each town:
      parishes with a roráty row in the registry first, then cathedrals and city-centre parishes,
      then the rest.

## Each day, 22–28 Nov (last batch on the morning of 28 Nov)
1. [ ] **Read.** Read each parish's notices for Christ the King Sunday (22 Nov) and the 1st Sunday
       of Advent (29 Nov, often online during the week before). Use the notice page, the bulletin
       PDF, and the parish calendar.
       - A site that refuses automated reads (403, captcha, challenge page, JS-only wall) goes on
         the **blocked list** with its URL. Never get around a block: no browser-looking user
         agents, no caches or archives, no contact with the parish.
2. [ ] **Source rule.** A 2026 notice that names the church, the days and the time. An undated
       standing schedule doesn't count. If the notice gives a time but no church, hold the row.
3. [ ] **Write one record per notice line** in a batch file (not yet in `data/corrections.json`):
       ```json
       {"id": "<registry id>", "church": "…", "town": "<slug>",
        "from": "2026-11-30", "to": "2026-12-23", "days": "12345", "except": ["2026-12-08"],
        "add": [["06:30", "mše sv.", "roráty"]],
        "source": "<https link to the notice>", "source_date": "ohlášky 22. 11. 2026",
        "quote": "<verbatim, short>", "checked": "2026-11-2x"}
       ```
       - `days` uses the registry's digits, 1 = Monday … 7 = Sunday. Roráty are weekdays: no 7.
       - `except` lists the days the notice leaves out (8 Dec, a parish's own gap). Use
         `"dates": [...]` when the notice lists single days instead of a run.
       - The note (third field of `add`) must say `roráty`, or the page won't pick the row up.
       - From 30 Nov (Monday after the 1st Sunday) to 23 Dec, or as the notice says.
4. [ ] **Check the batch:** `node --experimental-strip-types data/roraty-check.mjs batch.json`.
       It fails on a missing source, date or quote, an unknown id, dates outside Advent, or a
       record the page would not show. It prints each row as the town page will show it.
5. [ ] **Independent review.** A subagent that did not write the batch re-fetches every source and
       checks the 2026 date, the church, the days, the time and the quote. A source the reviewer
       can't reach is held, not shipped.
6. [ ] **Merge the batch.** Append the records to `data/corrections.json`, then run
       `node data/corrections.mjs` (it writes the dated rows into the shards) and
       `npx vitest run data/` (every record must land). Open a PR, wait for green CI, squash-merge.
       This is data only, so it goes live over the air and needs no app build.
7. [ ] **Note the day** in the hand-back: towns done, rows added, the blocked list, rows held.

## Ship, Sat 28 Nov evening (before Advent, Sun 29 Nov)
- [ ] Rebase #94 on main, CI green, then a fresh code review of the diff.
- [ ] Decide the towns: a town page appears only where rows exist. The hub lists them.
- [ ] Merge #94. Deploy runs on main.
- [ ] Live check at 390 px: the hub, Praha, one town filled only by the pass, and one row's source
      link opened. Screenshots go in `docs/review/shots/`.
- [ ] Sitemap and links from the app: only if Pavol says so in the ship hand-back (open question in
      SEASON-PAGES.md). Until then the pages are reachable but not linked.
- [ ] Hand-back `docs/review/2026-11-28.json`: towns, rows, sources, the blocked list, and what is held.

## Christmas (14–23 Dec)
Same steps with a Christmas notice. The records are dated one-offs on 24 Dec (from 15:00), 25 Dec
and 26 Dec. Midnight Mass is written as `24:00`. Add `'vanoce'` back to `SEASON_KINDS` in
`scripts/prerender.mjs` when it ships.

## Limits
No store submissions, no emails or posts, no contact with parishes, no Supabase SQL. The wording
for corrected rows stays Pavol's call; the pages show the source instead of a label.

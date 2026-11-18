# Roráty pass — dry run, 5 Nov 2026

This was a test of [`RORATY-PASS.md`](../RORATY-PASS.md) on 5 parishes. The 2026 Advent
notices are not out yet, so it used **last year's (Advent 2025)** notices where they are still
online. Nothing went into `data/corrections.json`. The records are in
[`2026-11-05-roraty-dryrun-batch.json`](2026-11-05-roraty-dryrun-batch.json), kept only as a
check of the format.

| Parish (registry id) | Result | Roráty 2025 | Source |
| --- | --- | --- | --- |
| Praha, sv. Vít (10001) | no archive | past entries are deleted; the 2026 list already shows "30. 11. Po 06.30 Rorátní mše svatá" | katedralasvatehovita.cz/bohosluzby/ |
| Praha, Týn (100031) | no archive | no ohlášky; items in "Aktuality" have no year; the newsletter archive stops at 2023 | tyn.cz |
| Kolín, sv. Bartoloměj (1000473) | **record** | út (with children) and čt (Old Czech roráty), 6:30, 2.–23. 12. | [ohlášky 30. 11. 2025](https://www.farnostkolin.cz/ohlasky-1-nedele-adventni-4/) |
| Chrudim, Nanebevzetí P. M. (3000146908370) | no archive | ohlasky.php shows the current week only | farnost-chrudim.cz/ohlasky.php |
| Brno, katedrála sv. Petra a Pavla (8000949776313) | **record** | po 6:00, 1.–22. 12. (on 8. 12. too) | [ohlášky 1. a 2. neděle adventní 2025](https://www.katedrala-petrov.cz/l/farni-ohlasky-1-a-2-nedele-adventni/) |

No site blocked automated reads. Every page answered 200 to a plain request.

## The tooling
- Range records: both notices fit one record each (`days: "24"`, `days: "1"`).
- `data/roraty-check.mjs … --today 2025-11-23`: 2 rows, no errors. The page shows them as
  "út, čt 2. 12. – 23. 12." and "po 1. 12. – 22. 12.", each with a linked source.
- Review: the two quotes were fetched again from the live pages and found verbatim
  ("Srdečně zveme děti každé úterý v adventu na mši v 6:30 v kostele sv. Bartoloměje. …
  Rorátní mše … budou o adventu každý čtvrtek v 6:30 u sv. Bartoloměje"; "Roráty budou v
  katedrále vždy v pondělí v 6:00 ráno."). A plain text search can miss a quote, because pages
  use non-breaking spaces; the reviewer should normalise whitespace before searching.

## What changes in the checklist
- **Find notices from the site's own index**, not from guessed URLs. Kolín's URL suffix changes
  every year (`-4`, `-5`). Brno's 2025 posts are named after the Sundays, the 2026 ones after
  the date, and its `sitemap.xml` lists every post.
- **Record a dated list while it is visible.** Sv. Vít and Chrudim replace their page every week
  or month. The quote and the check have to happen the week the notice is up. Sv. Vít may list
  December roráty only once December starts; re-check it on 1 Dec, after the ship.
- **A notice that says "v kostele" without naming it** (Chrudim) is held when the parish has
  more than one church, as the source rule says.
- **Items without a year** (Týn): `source_date` is the item's day and month plus the year of
  reading, and it says so ("aktuality, čteno 23. 11. 2026").
- **Registry lookups:** search the name and the town separately (the registry says "katedrála
  sv. Petra a sv. Pavla", with "Brno" in the town field).
- **What the registry gets wrong:** Kolín's registry row for these roráty says "v adventním
  období r. 2019", so the pages skip it. The 2025 notice shows the same days and time. A 2026
  record fixes it.

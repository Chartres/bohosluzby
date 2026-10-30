# Signature — Kam na mši

What makes this product ours rather than another map with pins. Written for the deep round
(27–29 Oct 2026, flywheel `docs/program/2026-10-27-deep-round.md`); binding next to
`docs/DESIGN-BRIEF.md`. Status of each mechanic is kept current here.

## 1. Lineage

**The diocesan Schematismus (Catalogus cleri).** From the 18th century every diocese of the
Habsburg lands printed a yearly directory: each parish with its filial churches and chapels,
the title (patron) of each church, the clergy, the languages of the faithful, and a date
("Stand vom …") the whole book was true as of. The Prague archdiocese's *Catalogus venerabilis
cleri … Archidioeceseos Pragenae* (e.g. 1854,
https://www.deutsche-digitale-bibliothek.de/item/2PLX4EDZG2LTQKPBZO5EIA54QABWRQME) and the
St. Pölten *Schematismus* still published today ("Stand vom 01.10.2023",
https://www.dsp.at/dl/tlNqJmoJKONJqx4KJl/Schematismus_2023-10-01_pdf) are the form. The ČBK
registry is its digital heir, and this app is the reader's edition.
- changes: every church gets its own page even when it lists no service; each entry carries
  its own "as of" date (*naposledy ověřeno …*) instead of one date for the whole book; old
  entries are marked with their date, never silently dropped or silently trusted; the
  church's title is read from its name and turned into its patronal feast (mechanic B).

**The Ordo / Directorium — the liturgical year as the calendar.** The annual *Directorium*
(in Czech the ČBK *Liturgický kalendář*, https://www.liturgie.cz/) tells every parish what
is celebrated on which day. The year has seasons and peaks, and people come to church on the
peaks: Christmas Eve, the Triduum, All Saints and All Souls.
- changes: the app's accent follows the season (green, violet, gold, red — `liturgical.ts`);
  the day picker names feasts; for the peak days we publish a printed-ordo page per city
  (mechanic A), the way a cathedral used to post its feast-day order on the door.

**The Roman Missal's rubrics.** Since the *Missale Romanum* of 1570, instructions are
printed in red and the text in black (https://en.wikipedia.org/wiki/Rubric).
- changes: rubric red is functional only — day labels, warnings, wayfinding; content is ink.
  Already binding in `DESIGN-BRIEF.md`; the static feast pages follow it.

**The title of a church (CIC 1983, can. 1218).** "Each church is to have its own title which
cannot be changed after the church has been dedicated"
(https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann1205-1243_en.html).
In Czech villages the title's feast is the *pouť* — the one weekday a year the whole village
and everyone who moved away come back to that church.
- changes: mechanic B — each church page names its patronal feast and the date; the city's
  upcoming *poutě* are findable.

**Growth by attraction, not proselytism.** Benedict XVI, homily at Aparecida, 13 May 2007:
the Church "does not engage in proselytism; instead, she grows by attraction"
(https://www.vatican.va/content/benedict-xvi/en/homilies/2007/documents/hf_ben-xvi_hom_20070513_conference-aparecida.html;
quoted by Francis in *Evangelii gaudium* 14, 2013).
- changes: mechanic C — the only growth loop is one person inviting another to one Mass, in
  their own words, through their own messenger. No push campaigns, no streaks, no counts of
  how often you went.

## 2. Refused

- **Streaks, attendance counts, badges.** Going to Mass is not a habit metric; counting it
  turns worship into a score and shames the person who missed. Never.
- **Push notifications we initiate.** Only reminders the user sets for one Mass (iOS). No
  "you haven't opened the app" nudges, no feast-day campaigns.
- **Ads, accounts, data sale.** The data is the Church's, maintained by parishes for free;
  reselling attention on top of it would be taking from them.
- **Invented certainty.** No time that the registry doesn't give; no "Mass is held" claim for
  a date the note might exclude without showing the note; no hiding an old entry either.
- **The generic AI-app look.** No gradients, blobs, rounded cards, emoji, "✨". Paper, ink,
  rubric red, hairlines, Fraunces (DESIGN-BRIEF).
- **Engagement bought at the cost of presence.** The app's job ends when you know where to go.
  Success is fewer minutes in the app, not more.

## 3. Signature mechanics

| | Mechanic | What the user sees | From | Status | How we know it works |
|---|---|---|---|---|---|
| A | **Svátkový pořad** (feast-day ordo) | `/dusicky/<město>/`: every service the registry gives for 1 and 2 Nov, by time, church linked, one-offs and old entries marked; church pages show the two days in the month before. Next: Christmas (`/vanoce/`, půlnoční) and the Triduum on the same engine. | Ordo/Directorium, Schematismus | shipped (Dušičky, PR #63) | visitors landing on `/dusicky/*` 27 Oct–2 Nov (static-page `page_view`, `route: feast`); target ≥ 50 in the week; Search Console impressions for "mše dušičky" |
| B | **Titulární slavnost / pouť** | On a church page: "Titul: sv. Jakub · pouť 25. července"; in the feast window, "Tento týden slaví" — churches in your area whose patron's day falls this week. Times only if the registry has them for that date. | Schematismus (title per church), CIC can. 1218 | shipped on web (church pages + detail); "tento týden" list next | church-page visits in the week of a church's titular feast vs. the weeks around it (page_view by church id); later a `key_action` when a "tento týden" list exists |
| C | **Pozvat** (invite one person to one Mass) | On each service row: *pozvat* → your messenger opens with "Jdu v neděli 1. 11. v 9:00 na mši do kostela sv. Jakuba (Brno). Přidáš se? <odkaz>". The link opens that church's page. | Benedict XVI / *Evangelii gaudium* 14; constitution art. III | shipped on web; iOS waits for Pavol's look at the shots | `key_action: invite` count, and visits arriving with `?pozvani=1` (invitations that were opened) |

## 4. Visual signature

The printed parish ordo and the Schematismus page: a directory set in a serif with tabular
times, entries separated by hairlines, place names in small caps, rubric red for the
instructions, warm paper. No cards, no shadows, no icons doing a word's job. The static feast
pages (no app on top) are the purest form of it and the reference for later print-like pages.
Accessibility: WCAG AA contrast on paper, 44 px rows, real headings for screen readers.

## 5. Founder lens

Pavol's constitution, articles cited by number (the text is private):
- **III — faith passes on through persons and invitation, never pressure.** Hence mechanic C
  and the refusals in §2: the app helps one person bring another; it never pushes anyone.
- **II — the order: faith, family, body, craft, money.** The product runs itself: the
  registry refresh, photo matching and the feast pages are scheduled builds. It must not
  cost evenings around the feasts it serves.
- **VI — the moat is distribution, reputation, frozen judgment, relationships.** Distribution
  here is search (4,000 church pages, feast pages) and parishes (the embed widget, the ČBK
  data-quality report). Reputation is accuracy: one wrong Mass time on All Souls costs more
  than a hundred right ones earn.
- **VIII — never lie, cheat or trick.** Every time is the parish's own entry with its date;
  every uncertain note is printed; there is nothing to buy and nothing hidden.

**Differentiation that follows:** the others are either the registry itself (complete,
official, unreadable on a phone) or a global directory (readable, thin on Czech data, funded
by ads or donations). Kam na mši is the Schematismus in your pocket: official data, set like a
printed ordo, organised around the liturgical year and around one person inviting another.

## 6. Decision log

Pavol's picks, dated, in his words where he wrote any. Newest first.

**2026-10-30** (decision page, 08:30 CET; built the same day)
1. **Dušičky town pages: keep** (176). On the hub: *"Add a map to this page? List of towns in
   alphabetical order is strange ux."* → `/dusicky/` has a build-time SVG map (a dot per town
   page, each a link), the towns grouped by diocese instead of A–Z, a "Najdi obec" filter and
   an opt-in "Podle mé polohy" sort. Diocese, not kraj: it comes from data we hold (the
   registry id), it is the Schematismus's own order, and each group names the kraje it
   covers for anyone who doesn't know church geography.
2. **Patron feast and pouť line: keep.**
3. **Pozvat: keep.**
4. **Feast pages, registry entries older than 18 months:** *"list with the date on the row"*.
   Already so ("rozpis ověřen naposledy …, ověřte u farnosti"); now a decision, not a default.
5. **Feast pages:** *"static page"*. Plain static HTML; the app does not boot on top
   (`scripts/check-prerender.mjs` fails a feast page that loads the bundle).
6. **Ambiguous patronal titles** (plain "sv. Jakuba", two-title churches, Navštívení P. M.):
   *"show nothing"*, with *"Explore parish sites of the ambiguous ones to find the feast"*.
   → Still nothing by default. Where a parish's own website or bulletin names the feast, the
   church gets it, with that source recorded next to it in the data; where nothing confirms
   it, nothing is shown.

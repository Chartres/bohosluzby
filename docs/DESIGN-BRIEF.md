# Design brief — Bohoslužby

Pavol's mandate: this must NOT feel AI-generated. Diverge from typical style
patterns. The direction is grounded in real liturgical print tradition — a
domain generic app design never touches. Every visual decision below is
binding; deviations need a reason written here.

## Liturgical-season color system

The app's accent follows the actual church calendar (Roman rite, with the
Czech solemnities):

| Season / day                              | Color        | Token      |
|-------------------------------------------|--------------|------------|
| Ordinary time                             | green        | `#3d6b46`  |
| Advent, Lent                              | violet       | `#5b3a7e`  |
| Christmas season, Easter season, feasts   | white/gold   | `#a8842c`  |
| Pentecost, Palm Sunday, Good Friday, martyrs (sv. Václav) | red | `#8f1d1d` |

The current season is computed client-side (`src/domain/liturgical.ts`:
Gregorian Easter computus → season boundaries → color; fixed-date CZ
solemnities override). Documented and unit-tested against known dates
including 2026. The app literally changes with the year — meaningful,
memorable, zero-maintenance.

The seasonal color is exposed as the CSS custom property `--season` and used
for the wayfinding accent (header rule, active states, links). It is never
the text ink.

## Missal / breviary typography

- **Display**: Fraunces (Google Fonts, latin-ext — full Czech diacritics
  verified). Real character: soft wonk, high-contrast serifs. Used for the
  app name, church names, and times.
- **Body**: Source Sans 3 (latin-ext) — a quiet humanist sans for secondary
  text, labels, notes.
- NO Inter-on-white-cards defaults.

## Rubrics in red

In missals, instructions are printed red («rubrika»). We use exactly that:
small red functional labels and wayfinding text (`--rubric: #9a2b1e`) —
section headers, day labels, state hints — while content is black ink
(`--ink: #1a1712`) on warm paper (`--paper: #f6f1e5`). Rubric red is
functional, not decorative; it never colors content.

## Printed-ordo structure

Timetables are set like a printed schedule (ordo):

- Strong typographic hierarchy: big time, church name in display serif,
  details in small sans.
- Hairline rules (`1px` `#d8d0bd`) separate rows — no card-soup.
- No gradients, no glassmorphism, no shadows, no emoji.
- Square-ish corners (2px max radius).
- Generous margins; content column max-width ~40rem.
- Think "beautifully typeset parish notice board", not "startup landing".

## Mobile-first

One-hand use: primary actions in thumb reach, tap targets ≥44px, list over
map as the primary surface. Works at 375px. WCAG-AA contrast, visible
keyboard focus, real landmarks (header/main/footer).

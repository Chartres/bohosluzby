# BACKLOG — bohosluzby

The mini-scrum artifact (flywheel `docs/standards/mini-scrum.md`). Inbox → candidates →
sprint (1–3) → shipped; parked holds `persona:?` asks and explicit no's, each with a reason.

## inbox

## candidates

- **Mute provably-excluded rows on detail in-season** — P6 Věra · detail step 2 · the
  "kromě července a srpna" note shows, but the 10:30 row renders like any other in July;
  visual muting would answer her at a glance. Test: detail spec asserts muted class in
  July, normal in June.
- **Seasonal data harvest around liturgical peaks** — P7 Ondřej · ordo step 2 · registry
  one-offs for Triduum/Christmas are mostly missing until parishes publish late; re-run
  `data/extract.mjs` on a schedule the week before each peak so published extras land in
  time. Test: extract run dated in Holy Week picks up new `x` rows.

## sprint

## parked

- **UI translation / i18n** — persona:? for now. P2 James pattern-matches the Czech UI
  fine in the e2e journey; no real-user signal yet that Czech-only blocks the errand.
  Second signal (a real tourist stuck) promotes it. (2026-07-09)

## shipped

- 2026-07-09 · Persona library (docs/PERSONAS.md) + 4 automated journeys (P2/P3/P4/P6),
  English-chaplaincy fixture, PW_CHROMIUM escape hatch.
- 2026-07-09 · HNED no longer excludes masses beyond walking reach — time-then-distance
  is ranking, not a cutoff (P4 Novákovi; user report). PR #2.
- 2026-07-09 · Sticky filters/kdy expire after 12h — a fresh visit means "right now"
  (P1 Marie; user report). PR #2.

# BACKLOG — bohosluzby

The mini-scrum artifact (flywheel `docs/standards/mini-scrum.md`). Inbox → candidates →
sprint (1–3) → shipped; parked holds `persona:?` asks and explicit no's, each with a reason.

## inbox

## candidates

## sprint

## parked

- **UI translation / i18n** — persona:? for now. P2 James pattern-matches the Czech UI
  fine in the e2e journey; no real-user signal yet that Czech-only blocks the errand.
  Second signal (a real tourist stuck) promotes it. (2026-07-09)

## shipped

- 2026-07-09 · Paused services are visible: a note that provably excludes every upcoming
  occurrence (5-week window) mutes the detail row + prints "nyní se nekoná" (P6 Věra).
- 2026-07-09 · Registry refresh automated: monthly cron + manual dispatch before
  liturgical peaks (`.github/workflows/refresh-data.yml`, 90% sanity gate, tests must
  stay green, explicit CI dispatch so fresh data deploys) (P5/P6/P7 freshness).
- 2026-07-09 · Persona library (docs/PERSONAS.md) + 4 automated journeys (P2/P3/P4/P6),
  English-chaplaincy fixture, PW_CHROMIUM escape hatch.
- 2026-07-09 · HNED no longer excludes masses beyond walking reach — time-then-distance
  is ranking, not a cutoff (P4 Novákovi; user report). PR #2.
- 2026-07-09 · Sticky filters/kdy expire after 12h — a fresh visit means "right now"
  (P1 Marie; user report). PR #2.

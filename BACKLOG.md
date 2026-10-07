# BACKLOG — bohosluzby

The mini-scrum artifact (flywheel `docs/standards/mini-scrum.md`). Inbox → candidates →
sprint (1–3) → shipped; parked holds `persona:?` asks and explicit no's, each with a reason.

## inbox

## candidates

- **Parish embed** (evolve #5, Pavol: yes): `embed.js` + prerendered `embed/<id>.json`, next 3
  services, utm-tagged link. Views unlogged; clicks arrive as page_view `utm_source=embed`.
  Infra math in docs/EVOLVE.md. First test: 3 parishes embed it.
- **Christmas pages** (`/vanoce/`, per-city půlnoční lists): build by 15 Nov, filled by the
  15 Dec refresh + one extra ~20 Dec. Kill: 21–27 Dec week < 100 visitors.
- **Travel mode** (evolve #8, Pavol: yes): "jedu v neděli Praha → Brno" → masses at arrival.
- **Rating prompt after the 3rd conversion** (#9, Pavol: yes): StoreKit / Play in-app review;
  native release needed.
- **Siri / Google Assistant shortcut** "Kdy je nejbližší mše?" (#10, Pavol: yes): App
  Intents + Android App Actions; native release needed.
- **Witness chips → private thanks to parishes** (#7, Pavol: likes it): needs the giver's
  loop ("předáno farnosti v říjnu") — design in docs/EVOLVE.md.

## sprint

## parked

- **UI translation / i18n** — persona:? for now. P2 James pattern-matches the Czech UI
  fine in the e2e journey; no real-user signal yet that Czech-only blocks the errand.
  Second signal (a real tourist stuck) promotes it. (2026-07-09)

## shipped

- 2026-10-07 · Evolve picks: one-tap city chips without location; Moje kostely (☆ on the
  detail, section above the list, no notifications); quiet holy-day line on the eve/day of a
  weekday solemnity; `list_ready` telemetry (time to a visible list, origin source);
  registry data-quality report for ČBK (`docs/registry-quality.md`, `data/registry-quality.mjs`).
- 2026-10-07 · Evolve no-regret fixes (#36): 4 000 prerendered church pages (were HTTP 404),
  native share links, iOS 15 blank-app lookbehind, late GPS fixes kept, page_view context, bots
  excluded.

- 2026-08-08 · v1.1 persona-fix batch: dead parish `www` links dropped from the served
  data via a batched liveness pass (`scripts/linkcheck-www.mjs`, wired into
  `refresh-data.yml`) — 138 dropped out of 1,031 checked (`docs/linkcheck-report.md`);
  feedback copy states schedule corrections are forwarded to the parish/diocese
  registry; store description/keywords gained the map feature; map popover verbs and
  pin markers carry a church-scoped aria-label (list rows already did).

- 2026-07-10 · Map chips are day-honest: on hned, a pin whose next mass is not
  today greys out and carries its weekday ("ne 11:00") — a bare time read as
  "go now" for a Tuesday mass (user report; P1/P4 map face). Filters already
  applied to the map (shared selector) — the missing dimension was the day.

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

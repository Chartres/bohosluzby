# Release plan: Ohlasy poutníků (appreciation chips) — 2026-09-23

Status: **PLAN, awaiting Pavol's go.** Charter, research and schema are in
`PILGRIM-WITNESS-PLAN.md`; this document only says how the feature leaves the
private prototype and reaches users, in what order, and what would stop it.

## 1. Where it stands (verified 2026-09-23)

| Piece | State |
|---|---|
| Code | Complete and merged: ledger (`feedbackLedger.ts`), after-Mass card, positive-only chips (7 locked + `jazyk`), detail-page line, "Ohlasy poutníků" list filter, `feedbackStore.ts` read/aggregate. Unit tests + 3 e2e specs green. |
| Gate | `WITNESS_ENABLED` is off in every public build (web, App Store, Android). On only in dev, the e2e build and any build passed `VITE_WITNESS_PREVIEW=1`. |
| Backend | Supabase table `mass_feedback` (RLS on, anon SELECT of `status='visible'` only), Edge Function `submit-feedback` v1 ACTIVE: chip-vocabulary allowlist, 40 writes/device/hour, one row per device per Mass. Turnstile is **dormant** (no `TURNSTILE_SECRET` set). |
| Data | 27 rows, all 13–17 Aug, 2 churches, Pavol's own testing. Nothing from real users yet. |
| Threshold | `CORROBORATION_MIN = 1` — the prototype value (`TODO(prod): 3`). **Must be 3 before any public build.** |
| Fixed today | Anon and authenticated roles had `TRUNCATE`/`DELETE`/`REFERENCES`/`TRIGGER` on `mass_feedback` and `progress`. TRUNCATE bypasses RLS, so anyone with the publishable key could have wiped the table. Revoked 2026-09-23. |
| Usage context | Kam na mši: 25 visitors and 8 church-detail opens in the last 7 days; 57 visitors, 10 of them the iOS app, in 30 days. Sean Ellis all time: 24 "very", 2 "somewhat", 1 "not". |

The honest read: the feature is ready, the audience is small (tens of weekly users), and the
corroboration threshold means a chip needs three separate devices at the same Mass. At today's
traffic most churches will show nothing for months. That is by design (no shame, no scoreboard),
but it means the release is about **seeding witnesses**, not about UI.

## 2. Decision to take before anything ships

**Courtesy conversation with a friendly priest or the diocese** (PILGRIM-WITNESS-PLAN
"Permission posture"). The plan itself says a public, evaluative-adjacent launch gets this first,
and the ČBK outreach of 4 Jul went unanswered. This is the one step that is Pavol's alone and it
gates phase 2. Draft in `docs/outreach/` (see §6); Pavol sends it or names the priest.

Recommended framing for that conversation: "positive-only witness chips, no ratings, no priest
field, nothing negative can be expressed; here is the exact vocabulary; we would like you to see
it before anyone else." Ask for one parish willing to be the pilot.

## 3. Phases

### Phase 0 — production hardening (no user-visible change, ~1 session, no permission needed)
1. `CORROBORATION_MIN = 3`; unit test asserts the constant.
2. Turnstile on web writes: create the Cloudflare widget (free), set `TURNSTILE_SECRET` on the
   Edge Function, wire the token in `feedbackStore.submitFeedback` for `!isNative`. Native
   writes stay token-free (no Origin) as the function already expects.
3. Read-back: a `witness.spec.ts` that submits through the real function against a throwaway
   `church_id`, reads it back visible, and checks a single device never surfaces a chip.
4. Report path: a Supabase SQL view `mass_feedback_flags` + the "nahlásit" affordance is not in
   v1 — with no free text and no negatives there is nothing to moderate. Keep it out.
5. Analytics: `key_action` events `witness_card_shown / witness_attended / witness_chip / witness_dismissed`
   so §5 can be measured. They are `props`-only, no new table.

### Phase 1 — private pilot, native only (2–4 weeks)
- Ship the iOS build with `VITE_WITNESS_PREVIEW` **off** and `VITE_WITNESS_ENABLED=1`
  (feature on, no forced demo card) to **TestFlight only**; the same flag on the Android
  closed-testing track once Play is live. App Store production stays gated off.
- Cohort: Pavol + family + the pilot parish's people (the priest's list) — realistic 10–30 devices,
  enough to cross the threshold at one or two Masses and see the line render for real.
- Web stays off. The web audience is anonymous and cannot be invited; it comes in phase 2.
- Exit criteria: at least one Mass reaches ≥3 witnesses organically; zero complaints from the
  parish; no chip vocabulary confusion in `suggest_tag`.

### Phase 2 — public, all surfaces
- Flip `WITNESS_ENABLED` on in the public builds (web via the CI build env, iOS via
  `fastlane ios release`, Android via the `android-v*` tag). One PR, three artifacts.
- No launch post. The card only appears after a reminder or a detail view near Mass time, so
  discovery is organic and reverent by construction.
- Store listings gain one line ("Ohlasy poutníků: co jiní poutníci ocenili — bez hodnocení").
  App Store privacy label and Play data safety: the rows are anonymous device ids + chips;
  same "Device ID, not linked, not tracking" answer already declared. No new data type.

### Phase 3 — grow the vocabulary (quarterly)
- Read `suggest_tag` (routed privately to Pavol) and add chips only from real demand.
- `lang_actual` corroborations feed the language filter and become a registry-correction signal
  (v2 in the plan).

## 4. What must never change (the product's defense)
No stars, thumbs, scores, negatives, free-text reviews, priest field, ranking, leaderboard, map or
list rating pills. Absence renders as nothing. If a change request asks for any of these, the
answer is the kill criterion, not a variant.

## 5. Metrics and kill criterion
- Leading: witness cards shown → attended taps (target ≥40% — the card fires only on a real
  attendance signal, so a low rate means the ledger is wrong, not the users).
- Lagging: Masses with ≥3 witnesses (the only number that matters; target 5 within 8 weeks of phase 2).
- Guard: detail views per visitor must not drop after phase 2 (the chips must not crowd the ordo).
- Kill: a parish or diocese objects, or the framing drifts toward grading — revert the flag in
  one PR; data stays in the table, nothing renders.

## 6. Pavol's tasks (everything else is mine)
1. Say **go** on this plan, and pick the friendly priest / parish for the pilot (or approve the
   outreach draft I will put in `docs/outreach/witness-pilot.md` and send it).
2. Cloudflare: create a Turnstile widget for `bohosluzby.dravec.org` (2 minutes) and give me the
   site key; the secret goes on the Edge Function via the Supabase dashboard (or I do it if the
   MCP is allowed to set function secrets).
3. When phase 1 starts: `fastlane ios beta` with the flag, and add the pilot testers in TestFlight.

## 7. Related: download numbers
App Store downloads are still not measurable from the pipeline. One App Store Connect API key
with **Sales and Reports** access (ASC → Users and Access → Integrations, 3 values: key id,
issuer id, .p8) as repo secrets lets a daily workflow pull the sales report into
`data/kpi/bohosluzby.jsonl` alongside web visitors. The fastlane key already in `.env.example`
is App Manager only and cannot read sales. I will write the workflow once the key exists.

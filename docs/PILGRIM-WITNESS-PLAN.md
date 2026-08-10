# Plan: pilgrim witness & notes (mass feedback)

Status: **PLAN — private prototype only.** Branch: `feature/mass-reviews`.
Not for public launch; no ČBK contact; no reviews of priests. See "Permission" below.

## Charter

- **Goal (Pavol's words):** let people who attended a Mass leave low-friction, Uber-style
  feedback so that, over time, each Mass/church builds a profile that helps pilgrims choose —
  done reverently, because you come for the **sacrament**, not the experience.
- **Success:** a pilgrim gets useful "what to expect" signal on the detail page; a parish gets a
  gentle mirror; zero consumerist framing; no canonical or ČBK blowback.
- **Constraints:** $0 infra (reuse the fleet's `flywheel-core` Supabase), Claude-Max only,
  **prototype privately** (no public reviews, no ČBK outreach yet), missal design brief (no stars,
  no emoji, no leaderboards), TDD.
- **Kill criteria:** if the reverent framing can't hold (it drifts into grading priests/homilies),
  or ČBK objects to the registry-data use, stop.

## The core decision the research forced: witness + descriptive tags, NOT reviews

Four independent precedents converged, unprompted, on the same line — **describe the
circumstances so a stranger can self-select; never evaluate:**

- **ČBK's own official app** (`bohosluzby.cirkev.cz`) ships factual attributes (step-free,
  foreign-language) and deliberately **no** ratings/reviews.
- **messes.info** (French bishops', ~5,000 contributors, 15+ years): contributors *correct facts*
  only — no reviews, ever.
- **AA Meeting Guide** (the closest structural analogue, a dignity-heavy context): self-described
  **tags** (language, wheelchair, newcomer, type) so a newcomer can choose — no ratings.
- **Therapy directories:** client reviews of the practitioner are ethically **prohibited**; "fit"
  is conveyed through descriptive profile attributes instead.

Plus **Canon 220** ("no one may harm illegitimately the good reputation a person possesses") makes
any public grading of an identifiable **priest or homily** a live canonical *and* civil-defamation
risk. Google Maps church reviews are mostly tourist "nice architecture" + occasional grievance —
which is exactly (a) why a Mass-specific channel is genuinely differentiated, and (b) the failure
mode to avoid institutionalizing.

**Conclusion:** the contributor is a **witness** ("I was there; it happened; here is what was true
of it"), not a critic. There is **no star, thumb, or 1–5 score anywhere near a Mass, church, or
priest.** The absence of a rating line *is* the product, and it answers "the sacrament is not
rated" by construction — there is no field in which quality could be entered.

## Schema (v1) — all optional, fixed vocabulary, no free text on the public profile

Occurrence (the one primary signal):
- `attended` — "Ano, byl/a jsem." Stored as an aggregate **witness/corroboration count**, never a rating.

Descriptive tags (neutral facts a pilgrim needs to not be surprised):
- `lang_actual` — česky · latinsky · anglicky · polsky · německy · jinak (confirms/corrects registry)
- `sung` — zpívaná · čtená
- `music` — bez hudby · varhany · schola · sbor · rytmická
- `homily` — **length/language only** (krátké · delší; jazyk) — **never a quality grade**
- `duration` — do 45 min · ~1 h · přes 1 h (Pavol's "mass duration" — factual)
- `confession` — před mší · po mší
- `access` — bezbariérový vstup ano/ne (routed to the parish/registry channel, not crowd-published)

Positive-only witness tags (this is where Pavol's "hluboký prožitek" lands — see the fork below):
- `hluboky_prozitek` — a positive-only testimony with **no negative counterpart** and **no scale**;
  shown as "N poutníků zde zažilo hluboký prožitek," a corroboration count, not a score.

Contributor escape hatch (Pavol's ask):
- `suggest_tag` — "navrhnout štítek" free-text that is **not** published; it is routed privately
  to Pavol (email/Supabase queue) to grow the controlled vocabulary deliberately.

## Flow (low friction, no GPS)

Cohort = **reminder-setters + recent detail-viewers** near Mass time (per Pavol). No location check.
1. On reminder-set (or a detail view close to Mass time), write `{churchId, serviceKey, startISO}` to
   a local **ledger** in `localStorage` (new — `scheduleMassReminder` currently persists nothing).
2. On next app open, if a ledger entry's start is ≥~60 min past, unanswered, and "Neptat se" is off →
   show an **in-app card** (missal dress: Fraunces name, hairlines, rubric red, no stars/emoji).
3. **1 tap** — "Ano, byl/a jsem" — already contributes the witness. It then reveals a few optional
   chip rows (language, sung/music, confession, hluboký prožitek). **Save** = "Díky. Zapsáno pro
   další poutníky."
4. "Teď ne" dismisses this once; "Neptat se" stops the card forever. Notifications stay **opt-in, off
   by default**; a start+1h nudge notification is v2.

Anti-nag rules from the UX research: fire only on real attendance signal, at most once per Mass,
never gate by sentiment (FTC/Google ban it), skip is one tap and sticks.

## Display

- **Detail page only**, under the relevant service row, in ordo type as a plain factual line
  (e.g. `zpívaná · varhany · zpověď před mší · potvrdilo 11 poutníků`).
- A tag appears **only after ≥3 independent corroborations** (threshold — fork below). Below that it
  simply doesn't show; a church with no data looks exactly like today (no empty stars, no shame).
- **No** map/list rating pills, **no** leaderboard, **no** "best Masses" sort. Ever.

## Backend ($0, reuse) — no new infra

- Extend the fleet's live `flywheel-core` Supabase (already vendored here as `src/lib/supabase.ts`;
  same anon-insert + RLS pattern as `events`/`feedback`). One table `mass_feedback` (raw rows).
- Write path: client → Supabase **Edge Function** (`submit-feedback`) that verifies a Cloudflare
  **Turnstile** token (free), rate-limits by anon `device_id`, and upserts. One row per
  device-per-mass (DB unique index).
- Read path: the **nightly refresh cron** pre-aggregates (`GROUP BY church, mass, tag`, thresholded)
  and **bakes counts into the static shard JSON** the app already reads — so the app reads feedback
  **offline, for free**, with no live query. Preserves the $0 + offline-first contract.

## Anti-abuse (the schema is the defense)

No score to lower, no priest field, no public free text → **nothing to brigade.** Worst case is a
false neutral tag, self-limiting and correctable. Plus: ≥3-corroboration threshold (single device
publishes nothing), anon device id, per-device rate limit, report button → a Supabase SQL view Pavol
actions by hand. Tags-only MVP removes the human-moderation burden entirely.

## Permission posture

**Prototype privately — no permission needed** (per Pavol). ČBK never replied to the 4 Jul outreach
and shipped their own app; they chose the descriptive-attributes line and omitted evaluation. Our
attribute layer is close to (and complementary with) what they already normalize, so it's defensible.
**Any public, evaluative launch** would get a courtesy conversation with a friendly priest/diocese
first — not a strict legal requirement, but their goodwill and their data are load-bearing.

## Phasing

- **v1 (this branch, private):** reminder+viewer ledger · in-app card · tags-only (occurrence +
  language + sung/music + confession + duration + hluboký prožitek) · suggest-a-tag → Pavol ·
  detail-page display (≥3) · one Supabase table via Edge Function · no map/list change, no notification.
- **v2:** opt-in start+1h nudge · more tags (fullness, family, parking) · `access` correction routed to
  parish · confirmed-language feeds the language filter · parish override.
- **v3:** `form` (novus ordo / starý ritus) · feast-occurrence confirmations · a **private** per-parish
  mirror through the outreach channel (never a public dashboard).

## Open forks for Pavol (defaults marked)

1. **`hluboký prožitek` & homily.** Recommend: **positive-only witness, no grade** — `hluboký prožitek`
   as a testimony with no opposite, and homily captured as **length/language only, never a quality
   score** (Canon 220 + person-rating risk). This honors your "quality shouldn't matter" while keeping
   your chip. A true 1–5 homily/quality axis is the one thing the research says not to ship publicly.
   *(Recommended: positive-only.)*
2. **Corroboration threshold:** 3 (safer) vs 2 (faster profiles). *(Recommended: 3.)*
3. **Card language:** bilingual CZ/EN on this one surface (its users are disproportionately foreign
   pilgrims) vs Czech-only. *(Recommended: bilingual here.)*
4. **"Mše se nekonala":** capture as a **private** freshness/registry signal only, never a public
   "cancelled" badge. *(Recommended: private-only.)*

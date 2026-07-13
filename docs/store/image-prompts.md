# Bohoslužby — image-generation prompts (gpt-image / ChatGPT)

Two sets: **A** = subtle visuals to implement *inside* the app; **B** = visuals to
*accompany the App Store submission*. All are steered hard toward the app's brief
(missal / breviary / engraved, liturgical-season palette) and away from the
generic glossy-AI look — the design brief is explicit that nothing should read as
AI-generated.

**How to run ($0):** paste a prompt into ChatGPT (image) — your subscription covers
it, no API credits. **Or** with `OPENAI_API_KEY` set, `flywheel/scripts/gen-image.mjs`
posts to the Images API (that spends credits).

**Shared style block** — prepend/keep in every prompt:

> Style: fine-line **engraving / copperplate etching**, in the manner of a 19th-century
> missal or breviary illustration. Flat, printed, hand-inked — NOT photorealistic, NOT
> 3D, NOT glossy, no gradients, no lens blur, no drop shadows. Limited palette only:
> parchment `#f6f1e5` background, rubric red `#9a2b1e`, ink brown-black `#1a1712`, with
> at most one muted liturgical accent (green `#3d6b46`, violet `#5b3a7e`, gold `#a8842c`,
> or red `#8f1d1d`). Generous negative space, calm, reverent, restrained. No text, no
> lettering, no watermarks, no UI. Paper grain subtle.

---

## A. In-app visuals (subtle, functional)

### A1 — Empty state: "no mass nearby / nothing found"
Shown when the finder has no upcoming service in range. Must feel quiet, not sad.
> [shared style]. A single small engraved motif: a closed breviary book resting on a
> plain surface, or an empty wooden pew seen head-on. Centered, tiny, lots of parchment
> around it. Monochrome ink line-work with one faint rubric-red detail. Square, 1024×1024,
> transparent background (PNG). It will sit above a line of Czech text, so leave the lower
> third empty.

### A2 — Liturgical-season header ornament (×4, one per season)
A faint band that sits behind or beside the "Bohoslužby" title, tinted per season.
> [shared style]. A slender horizontal engraved ornament — repeating gothic tracery /
> quatrefoil border, like a chapter rule in a missal. Extremely subtle, low contrast,
> meant to sit UNDER a title as a watermark. Ink line-work only. Wide banner 1536×256,
> transparent background. Make four variants tinted respectively muted green `#3d6b46`
> (ordinary time), violet `#5b3a7e` (advent/lent), gold `#a8842c` (feast), red `#8f1d1d`
> (martyrs) — generate one per run, swapping the accent.

### A3 — App background watermark (very faint)
Optional page texture behind the list, barely visible.
> [shared style]. A single large **rose window** rendered as pale engraved line-art,
> radial gothic tracery, no fill — only thin ink lines at ~6% opacity feel. Centered on
> parchment. 2048×2048, tileable-safe edges, background parchment `#f6f1e5`. It must be
> so faint that black text stays fully legible on top.

### A4 — "Add to calendar / reminder set" confirmation glyph
A small mark for the success toast (pairs with the app's engraved iconography).
> [shared style]. One tiny engraved glyph: a gothic pointed arch (lancet) with a small
> bell inside it, or a candle. Single rubric-red line-weight, no fill. 512×512,
> transparent background, centered, thick enough to read at 24px.

---

## B. Submission / marketing visuals

### B1 — App Store screenshot backdrop (behind the device frames)
A calm framing panel the 6 screenshots sit on (if you present them framed).
> [shared style]. A vertical parchment panel with a faint engraved gothic arcade — a row
> of slender pointed arches — running along the top and bottom edges, the center left
> empty for a phone screenshot. Very low contrast, ink line-work on `#f6f1e5`. Portrait
> 1320×2868 (iPhone 6.9″). Also make a 2064×2752 variant for iPad. No text.

### B2 — Promotional hero / social share (Open Graph, sharing the app)
For the website, ČBK email, and social posts.
> [shared style]. A wide engraved scene: a simple Czech village church with a single
> spire, seen from the road at a reverent distance, framed inside a gothic pointed-arch
> border. Rubric-red accents on the arch only; everything else ink line-work on parchment.
> Landscape 1536×1024. Leave the lower-left quiet for an overlaid title (do not draw text).

### B3 — App Store "feature" / poster tile (optional)
A single strong emblem if Apple features the app or for a directory listing.
> [shared style]. The app's emblem: a gothic pointed-arch portal (lancet), rubric red on
> parchment, with a faint compass/location needle subtly integrated at its base to say
> "nearest". Bold, iconic, centered, lots of space. Square 1024×1024. This is a logo-like
> mark — keep it simple enough to read as an app tile.

---

## Notes
- Generate A2 and B1 as multiple runs (per season / per device size); the rest are single.
- Keep outputs in `store-assets/generated/` (in-app) and `store-assets/marketing/` (B); wire
  A1–A4 into the app only after a taste pass (they must clear `flywheel/docs/standards/taste.md`).
- If any output looks like stock-AI (soft gradients, 3D, faux-photo), regenerate with the
  negative guidance strengthened — the brief's whole point is that it must not.

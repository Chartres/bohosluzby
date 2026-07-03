# Bohoslužby

Mše svatá poblíž, právě teď. Mobilní webová aplikace, která najde nejbližší
katolické bohoslužby v ČR — podle vaší polohy, seřazené podle toho, kterou
ještě stihnete.

Data: [bohosluzby.cirkev.cz](https://bohosluzby.cirkev.cz) (oficiální rejstřík
bohoslužeb, Česká biskupská konference). Aplikace je zdarma, bez reklam a bez
registrace; funguje offline jako PWA.

## Vývoj

```bash
npm ci
npm run dev        # http://localhost:5173
npm run typecheck && npm test && npm run build
npx playwright test   # e2e + screenshoty do e2e/shots/
```

Build/test/release kontrakt: `AGENTS.md`. Vizuální kontrakt: `docs/DESIGN-BRIEF.md`.
Obnova dat: `node data/extract.mjs` (viz hlavička souboru).

# App Store Connect — metadata (iOS)

Paste-ready metadata for the Bohoslužby iOS app (Capacitor build).
Primary locale: **Czech (cs)**. Character counts verified against Apple limits.

---

## Names & URLs

| Field | Value | Chars / limit |
|---|---|---|
| App name | `Bohoslužby: katolické mše` | 25 / 30 |
| Subtitle | `Mše poblíž — jdi do kostela` | 27 / 30 |
| Primary category | Lifestyle | — |
| Secondary category | Reference | — |
| Age rating | 4+ | — |
| Support URL | `https://bohosluzby.dravec.org` | — |
| Marketing URL | `https://bohosluzby.dravec.org` | — |
| Privacy Policy URL | `https://bohosluzby.dravec.org/privacy` | — |

---

## Promotional text (≤170)

Chars: 141

```
Najděte nejbližší katolickou mši svatou podle své polohy. Uvidíte, kterou bohoslužbu dnes ještě stihnete. Zdarma, bez reklam, bez registrace.
```

---

## Description (Czech)

```
Bohoslužby vám podle vaší polohy ukážou nejbližší katolické mše svaté — a hlavně to, kterou mši dnes ještě stihnete.

Otevřete aplikaci a hned vidíte pořad bohoslužeb v okolí: kde a v kolik začíná nejbližší mše, kolik zbývá času a jak daleko to máte. Bez zdlouhavého hledání na webu farnosti.

Co aplikace umí:
• Nejbližší mše podle vaší polohy, seřazené od té, kterou ještě stihnete
• Pořad bohoslužeb pro dnešek, zítřek i neděli
• Funguje offline — data máte v telefonu i bez signálu
• Export mše do kalendáře jedním klepnutím
• Připomínka před začátkem mše, ať nikam nespěcháte
• Přibližně 3 991 kostelů z oficiálního rejstříku České biskupské konference

Zdarma, bez reklam a bez registrace. Nepotřebujete účet ani přihlášení.

Vaše poloha se používá jen ve vašem telefonu k výpočtu nejbližších kostelů a nikam se neodesílá.

Zdroj dat: oficiální rejstřík bohoslužeb České biskupské konference (bohoslužby.cirkev.cz).
```

---

## Keywords (≤100, comma-separated, no spaces after commas)

Chars: 89

```
mše,bohoslužby,kostel,mše svatá,katolík,nedělní mše,poblíž,offline,kalendář,farnost,kaple
```

---

## App Privacy (Data types)

Three data types collected — all sent to the shared Supabase events table, all
anonymous. No others. (Verified against the analytics client, not assumed.)

**Usage Data → Product Interaction**
- Linked to identity: **No** · Used for tracking: **No** · Purpose: Analytics
- Notes: page_view / key_action / conversion events (taps, mass found). No ad or third-party tracking SDKs.

**Diagnostics → Other Diagnostic Data**
- Linked to identity: **No** · Used for tracking: **No** · Purpose: App Functionality
- Notes: `error` events — truncated error messages for debugging (e.g. data-load failures).

**Identifiers → User ID**
- Linked to identity: **No** · Used for tracking: **No** · Purpose: Analytics
- Notes: `visitor_id`, an anonymous per-install localStorage UUID. No name/account (the app has no login).

**Location is NOT collected — do not declare it.** The app reads location only
on-device to sort nearby churches; coordinates are never transmitted or stored, so
under Apple's definition it is not "collected" (the purpose string in Info.plist is a
separate requirement). No name, email, contacts, advertising IDs, device ID, payment,
purchases, or user content. No account/login. No in-app purchases.

---

## DSA — Trader status

Declare **non-trader**: the app is free, has no ads, no in-app purchases, and no
commercial activity. It is offered by an individual (Pavol Dravecký) with no
trade in goods or services through the app.

---

## Notes for submission

- Age rating 4+: no objectionable content; suitable for all ages.
- Privacy Policy must be live at `https://bohosluzby.dravec.org/privacy` before review
  (source: `public/privacy/index.html`).
- Church count "~3 991" mirrors the churches dataset; update the number if the
  ČBK catalog import changes it.

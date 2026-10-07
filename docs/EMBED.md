# Nejbližší bohoslužby na webu farnosti

Dva řádky HTML. Na webu farnosti se objeví nejbližší tři bohoslužby daného kostela
a odkaz na celý pořad v aplikaci [Kam na mši](https://bohosluzby.dravec.org).

```html
<div data-kam-na-msi="10001"><a href="https://bohosluzby.dravec.org/kostel/10001/">Pořad bohoslužeb</a></div>
<script src="https://bohosluzby.dravec.org/embed.js" async></script>
```

- **ID kostela** je číslo v adrese jeho stránky v aplikaci: `bohosluzby.dravec.org/kostel/10001/`
  → `10001`. Více kostelů = více `<div>`, skript stačí jednou.
- **Data** pocházejí z rejstříku bohosluzby.cirkev.cz. Změnu pořadu udělejte tam;
  widget ji převezme s nejbližší aktualizací (nejpozději do měsíce).
- **Soukromí:** žádné cookies, žádné sledování návštěvníků. Skript stáhne jeden statický
  soubor a vypíše časy. Počítá se jen kliknutí na odkaz do aplikace (s označením zdroje).
- **Když selže síť** nebo kostel v rejstříku chybí, zůstane na stránce původní odkaz.
- Vzhled přebírá písmo a barvy webu; rámeček je jemný. Poznámky z rejstříku
  („kromě července“, „v adventu“) jsou vyhodnocené: bohoslužba, která daný den není,
  se nezobrazí.

## Pro správce (technicky)

- `public/embed.js` je čistý skript bez závislostí. Data jsou v `embed/<id>.json` (≈ 0,5–2 KB)
  a generují se při každém nasazení webu (`scripts/prerender.mjs`, `PRERENDER_CHURCHES=1`).
- Poznámky parsuje aplikace při sestavení (`src/domain/notes.ts`) do 60denní masky
  „koná se / nekoná“ od data sestavení. Měsíční obnova dat (`refresh-data.yml`, 3. dne v
  měsíci) web znovu nasadí, takže maska nikdy nevyprší. Za jejím koncem by widget
  použil prostý den v týdnu.
- Zátěž: statické soubory s cache. 100 farností × 3 000 zobrazení/měsíc ≈ 1,2 GB/měsíc,
  asi 1 % limitu GitHub Pages. Zobrazení se nelogují do flywheel-core; kliknutí přijdou
  jako `page_view` s `utm_source=embed&utm_campaign=<web farnosti>`.

# Rejstřík bohoslužeb — konkrétní nesrovnalosti k opravě

Ručně ověřený seznam pro ČBK. Doplňuje automatický přehled
[`registry-quality.md`](registry-quality.md), který počítá jen stáří a duplicity.

Každá položka vznikla při kontrole Dušiček 2026 (28. 10. – 1. 11. 2026). Rejstřík
(bohosluzby.cirkev.cz) jsme porovnali s ohláškami nebo webem farnosti.
**V rejstříku jsme nic neměnili.** Opravu musí zapsat farnost nebo správce
rejstříku. Aplikace Kam na mši přebírá rejstřík tak, jak je; jednorázové časy pro
1.–2. 11. jsou zvlášť v `data/corrections.json` a zdroj má každý z nich.

Stav: sepsáno, **neodesláno**. Odeslání ČBK je rozhodnutí Pavla.

| Kostel (ID v rejstříku) | Co rejstřík uvádí | Co uvádí farnost | Zdroj, kdy |
| --- | --- | --- | --- |
| Opava-Kylešovice, sv. Jan Nepomucký (50001870444019) | všední mše podle stálého pořadu | všední mše od 18. 10. do 22. 11. 2026 nejsou (operace kněze) | farní ohlášky 11. 10. 2026 (farnostkylesovice.cz) |
| Olomouc, Panny Marie Sněžné (70003866394229) | neděle 10:00, řeckokatolický ritus, poznámka „svátky 18.00 hod“ | aktuality farnosti tento řádek nepotvrzují; zřejmě zastaralý, ověřit u farnosti | farnostsnezenka.cz/aktuality, 1. 11. 2026 |
| Plzeň, sv. Mikuláš, řeckokatolický (60001289900425) | neděle 9:00 a 10:30, středa 18:30 | v listopadu neděle 9:30 a 11:00, středa 18:00 | Věstník plzeňských farností 11/2026 |
| Plzeň, Nanebevzetí P. Marie u františkánů (60002727640371) | pondělí 12:00, 1. pondělí v měsíci „pouze bohoslužba slova“ | 2. 11. 2026 mše svatá; bohoslužba slova přesunuta na 9. 11. | aktualita Dušičky 2026 (farnostbartolomej.cz, 1. 11. 2026) a Věstník 11/2026 |
| Kolín, sv. Bartoloměj (1000473) a Nejsv. Trojice (1000474) | pondělí–sobota 8:00 u Nejsv. Trojice | pondělní ranní mše je u sv. Bartoloměje | ohlášky 25. 10. – 1. 11. 2026 (farnostkolin.cz) |
| Děčín, Povýšení sv. Kříže (2000388) | pondělí 7:30 | stálý pořad farnosti: pondělí 7:00 (bez data) | farnost-decin.cz, 1. 11. 2026 (ráno i večer) |
| Česká Lípa, sv. Máří Magdaléna (20007) | pondělí 17:30 | veřejný kalendář farnosti nemá v pondělí žádnou mši | kalendář farnostceskalipa.cz, 1. 11. 2026 ráno |
| Praha-Hodkovičky, kaple sv. Bartoloměje (10002789) | každá neděle 9:30, v poznámce „poutní (jen v neděli po 24. srpnu …)“ | poutní mše je jednou za rok; jako týdenní řádek se zobrazuje každou neděli | modranskafarnost.cz, 1. 11. 2026 |
| Praha, sv. Duch (100022) | neděle 9:30, „pouze 19. 7., 2. 8., 16. 8. a 30. 8.“ (bez roku) | letní termíny bez roku; zastaralé | rejstřík a tyn.cz, 1. 11. 2026 |
| Jihlava, sv. Ignác (80003820872696) | neděle 10:00 řeckokatolická liturgie dvakrát: jednou každou neděli, jednou „1x za 14 dní, sudý týden“ | řádky si odporují | rejstřík; pořad 1.–8. 11. 2026 (svjakub.cz) |

## Weby farností

| Farnost | V rejstříku | Správně |
| --- | --- | --- |
| Příbram-Svatá Hora (1000663) | svata-hora.cz (dnes jiný, pronájmový web) | farnost-svatahora.cz |
| Teplice (2000553 a další) | salesianiteplice.cz/farnost/ | přibyl farnost-teplice.cz |
| Liberec, arciděkanství | odkaz přes http (ten je blokovaný) | přes https funguje |

Podrobnosti s citacemi: `docs/review/2026-11-01.json` (data_check.notes) a
`docs/review/2026-11-01-evening.json`.

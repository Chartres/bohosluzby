# Kvalita dat v rejstříku bohoslužeb — přehled pro ČBK

Stav k 2026-10-07. Zdroj: veřejný rejstřík bohosluzby.cirkev.cz, jak jej zobrazuje
[Kam na mši](https://bohosluzby.dravec.org). Počítáno skriptem `data/registry-quality.mjs`.

Datum aktualizace říká, kdy farnost záznam naposledy změnila — ne že jsou časy chybné.
Starý záznam může být správný; jen ho nikdo dlouho nepotvrdil, a aplikace proto
u něj zobrazuje výzvu „ověřte si u farnosti“.

| Ukazatel | Počet | Podíl |
| --- | --- | --- |
| Kostely s pořadem bohoslužeb | 4000 | 100 % |
| Pořad neaktualizovaný déle než 18 měsíců (před 2025-04-07) | 2382 | 60 % |
| — z toho naposledy před rokem 2020 | 1517 | 38 % |
| Dvakrát zapsaný stejný termín (kostel · den · čas · typ) | 130 | — |
| Poznámka „nepravidelně / dle ohlášek / viz web“ | 179 | — |
| Nefunkční web farnosti (3 pokusy, DNS nebo 404) | 60 | — |

## Rok poslední aktualizace

2009: 167 · 2010: 110 · 2011: 333 · 2012: 42 · 2013: 15 · 2014: 5 · 2015: 49 · 2016: 425 · 2017: 24 · 2018: 31 · 2019: 316 · 2020: 39 · 2021: 62 · 2022: 37 · 2023: 191 · 2024: 497 · 2025: 606 · 2026: 1051

## Farnosti s nejvíce neaktuálními kostely

| Farnost | Kostelů s pořadem starším 18 měsíců |
| --- | --- |
| Římskokatolická farnost Kolín | 16 |
| Římskokatolická farnost Říčany u Prahy | 15 |
| Římskokatolická farnost Roudnice nad Labem | 13 |
| Římskokatolická farnost Beroun | 12 |
| Římskokatolická farnost Český Brod | 11 |
| Římskokatolická farnost Hořovice | 11 |
| Římskokatolická farnost Tachov | 11 |
| Římskokatolická farnost Hrádek | 10 |
| Římskokatolická farnost Klatovy | 10 |
| Římskokatolická farnost Svojanov | 10 |
| Římskokatolická farnost Kralupy nad Vltavou | 9 |
| Římskokatolická farnost Poříčí nad Sázavou | 9 |
| Římskokatolická farnost Roztoky u Prahy | 9 |
| Římskokatolická farnost Sedlčany | 9 |
| Římskokatolická farnost Žebrák | 9 |
| Římskokatolická farnost Bystré u Poličky | 8 |
| Římskokatolická farnost Městec Králové | 8 |
| Římskokatolická farnost Uhlířské Janovice | 8 |
| Římskokatolická farnost Votice | 8 |
| Římskokatolická farnost Zbiroh | 8 |
| Římskokatolická farnost - děkanství Jirkov | 7 |
| Římskokatolická farnost - děkanství Turnov | 7 |
| Římskokatolická farnost - děkanství u Všech Svatých Litoměřice | 7 |
| Římskokatolická farnost Kralovice | 7 |
| Římskokatolická farnost Kraslice | 7 |
| Římskokatolická farnost Křečovice | 7 |
| Římskokatolická farnost Mnichovice | 7 |
| Římskokatolická farnost Nové Strašecí | 7 |
| Římskokatolická farnost Odolena Voda | 7 |
| Římskokatolická farnost Přibyslav | 7 |

Úplný seznam (kostel, obec, farnost, datum poslední aktualizace, odkaz) je v
`docs/registry-quality-stale.csv`.

## Duplicitní termíny (prvních 30)

- katedrála sv. Víta, Václava a Vojtěcha, Praha-Hradčany (Praha 1): 7 10:00 mše sv.
- klášterní kostel Panny Marie pod řetězem, Praha-Malá Strana (Praha 1): 7 10:00 mše sv.
- bazilika sv. Ludmily, Praha-Vinohrady (Praha 2): 7 09:00 mše sv.
- farní kostel Panny Marie Královny míru, Praha-Lhotka (Praha 4): 5 18:30 - 19:30 adorace
- farní kostel Nanebevzetí Panny Marie, Praha-Modřany (Praha 12): 5 18:00 mše sv.
- farní kostel Narození sv. Jana Křtitele, Lysá nad Labem (Lysá nad Labem): 3 17:00 mše sv.
- farní kostel sv. Jakuba Staršího, Čechtice (Čechtice): 4 17:00 mše sv.
- farní kostel sv. Václava, Dlažkovice (Dlažkovice): 6 16:30 mše sv.
- farní kostel Nanebevzetí Panny Marie (Chraštice): 7 08:00
- filiální kostel sv. Petra a Pavla (Pohoří, Mišovice): 6 17:00
- filiální kostel Panny Marie Bolestné (na Homoli) (Lhoty u Potštejna): 7 14:30
- filiální kostel (bývalý farní) Povýšení svatého kříže (Ostružno): 7 10:45
- filiální kostel (bývalý farní) Povýšení svatého kříže (Ostružno): 7 10:45
- filiální kostel (bývalý farní) sv. Jana Křtitele (Mladkov): 7 10:00
- filiální kostel (bývalý farní) sv. Jana Křtitele (Mladkov): 7 10:00
- filiální kostel (bývalý farní) sv. Jana Křtitele (Mladkov): 7 10:00
- filiální kostel sv. Petra a Pavla, apoštolů (Slatina): 7 08:00
- filiální kostel sv. Zikmunda, mučedníka (Králova Lhota): 7 08:15
- filiální kostel Božího Těla ("špitálský") (Skuteč): 3 17:00
- farní kostel Navštívení Panny Marie (Zálší): 7 11:00
- filiální kostel sv. Vavřince (Kraselov): 6 15:00
- filiální kostel Panny Marie Bolestné a sv. Jana Nepomuckého (Omlenička, Omlenice): 7 08:00
- farní kostel sv. Martina (Radomyšl): 7 11:00
- farní kostel Nanebevzetí Panny Marie (Drahov): 7 08:00
- farní kostel Navštívení Panny Marie (Suchdol): 2 07:30
- kaple Neposkvrněného Srdce Panny Marie (Troubky, Troubky-Zdislavice): 6 17:30
- farní kostel sv. Jakuba Staršího, apoštola (Kopidlno): 7 11:00
- farní kostel sv. Jakuba Staršího, apoštola (Kopidlno): 7 11:00
- farní kostel sv. Jakuba Staršího, apoštola (Kopidlno): 7 11:00
- filiální kostel (bývalý farní) sv. Vavřince, jáhna a mučedníka (Svinčany): 7 11:00

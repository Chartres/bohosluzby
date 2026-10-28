# Competitive analysis: Kam na mši (Oct 2026)

Date seen for everything below: **2026-10-27**. Web research only (WebSearch/WebFetch). Where a
number or price could not be found it says "not found". Store ratings are as shown on the store
page on that date, or from a named third-party tracker when the store page did not load.

## Summary

- In Czechia the only real competitor is the **ČBK registry site itself**
  (bohosluzby.cirkev.cz). It is the data source, has the same core search (location, day,
  language, wheelchair, sort by time/distance), but no map, no app, no offline, no calendar
  export, no embed. No dedicated Czech Mass-finder app was found on the App Store; nothing
  turned up for Google Play either.
- Slovakia has **DoKostola** (iOS + Android, ~4,000 churches, volunteer-maintained, includes
  confession times and a map). omse.sk returned HTTP 503 on two tries and could not be verified.
- International apps (**Mass Times for Travel**, **Catholic Mass Times**) are funded by
  donations. Neither depends on ads or a subscription. MassTimes.org also shows ads in its
  search results.

## Competitors

### Czech Republic

**1. bohosluzby.cirkev.cz: "Katolické bohoslužby v České republice" (ČBK)**
- URL: https://bohosluzby.cirkev.cz. Price: free. Model: run by the Czech Bishops' Conference
  as part of its cirkev.cz family. Web development credited to Next Generation Solution, s.r.o.
  No ads seen.
- Audience: all Czech Catholics, and it is the official source parishes are asked to update.
- Does well: authoritative data (we consume it). Search by town/district/church name, "current
  location" (with permission), day buttons and a date picker, radius filter, wheelchair yes/no,
  10 languages (CS, SK, PL, EN, DE, ES, IT, FR, Latin, KO), sort by time or distance, "load more"
  and "extend to more distant churches", feedback form.
- Does badly: no map view described on the search page; no mobile app (no app links on the site,
  and none found in either store); no calendar export, offline mode, or embed widget seen.
  The site asks users to verify times with the parish, which tells you freshness is a known
  problem, but no per-entry staleness indicator was seen. Ratings and reviews: none exist (it is
  a website).

**2. Diocesan websites (apha.cz, biskupstvi.cz, dioceze-ostrava etc.)**
- URLs: https://www.apha.cz and the other diocesan sites. Price: free.
- What they do: news, newsletters (e.g. Zpravodaj pražské arcidiecéze), pastoral plans, lists of
  parishes. Searches turned up no Mass-time search on apha.cz; https://www.apha.cz/farnosti/
  returned 404. Not checked one by one for the other dioceses.
- Verdict: not a competitor for "nearest Mass now". They send people to parish sites or to the
  ČBK registry.

**3. Parish websites and ohlášky (weekly notices, often PDF)**
- Examples: kostelec.dpv.cz (weekly "Farní listy" PDF with the Mass schedule table),
  srdcepane.cz (notices PDF; says updates go to "web, facebook a nástěnky"). Price: free.
- Does well: they are the freshest source for one-offs (feasts, cancellations, intentions).
- Does badly: one parish at a time, often PDFs, not searchable by location, not on phones in a
  usable form. This is the main reason a parish embed widget could make sense.

**4. Farnost do kapsy (IS OMNIA / AgenduFarnosti)**
- URL: https://apps.apple.com/tt/app/farnost-do-kapsy/id1609757101. Developer IT2GO s.r.o.
  Price: free. Business model: not stated in the listing; the app belongs to a parish-website
  system, so it looks like a paid B2B product for parishes, with the app free to parishioners.
  Pricing to parishes: not found.
- Does: parish schedule, events, notifications from the priest, booking Mass intentions.
  It only works for parishes on that system.
- Ratings: "not enough ratings" on the App Store. Android: not found.
- Verdict: a parish-engagement app, not a finder. Coverage is only the parishes that use it.

**5. LiturgieCz / AudioKostel (adjacent, not finders)**
- LiturgieCz (https://apps.apple.com/app/id793979123): liturgical texts for priests, from
  Fenomen multimedia with Liturgie.cz/ČBK content. AudioKostel
  (https://apps.apple.com/cz/app/audiokostel/id1522194154): live audio from churches, made by
  an individual developer. Neither finds a Mass by location. Listed because users searching
  "mše aplikace" find them first.

### Slovakia

**6. DoKostola (dokostola.sk + app)**
- URLs: https://www.dokostola.sk, https://apps.apple.com/sk/app/dokostola/id1589411662.
  Operator DoKostola s. r. o. (also runs a Catholic news site). Price: free; no in-app
  purchases listed. Revenue model: not stated; the site is a news portal, so ads or publisher
  funding are possible but were not confirmed (not found).
- Audience: Slovak Catholics; the listing claims more than 4,000 churches in Slovakia.
- Does well: search by town or current location, sort by time or distance, confession-time
  search, map coordinates, favourites, notifications the day before holy days of obligation,
  link to parish announcements. Schedules are maintained by a volunteer team.
- Does badly / unknown: App Store rating 5.0 from only 4 ratings, so there is little user signal.
  Google Play listing: the site links to it, but I could not load the page or find a rating
  (not found). No language/rite or wheelchair filter mentioned. No calendar export or embed seen.

**7. omse.sk**
- URL: https://www.omse.sk. Returned HTTP 503 on 2026-10-27 (two attempts). No search result
  described it. Status: unverified, possibly dead. Recheck before relying on it.

**8. KBS (kbs.sk) / Slovak diocesan sites**
- No national Mass-time registry from the Slovak Bishops' Conference turned up in searches. The
  2026 Direktórium for Bratislava has a section "Aplikácia svätých omší", which is about how
  Mass intentions are applied, not an app. So Slovakia has no official equivalent of the ČBK
  registry that I could find.

### Poland (as a model)

**9. msze.info**
- URL: https://www.msze.info. Operator NETSTEL Software (netstel.pl), which runs a network of
  content sites. Price: free. Ads: not stated on the page; likely ad-funded content network,
  not confirmed.
- Does: nearby Masses with distance and map, church pages, Masses abroad by country, streams,
  prayer texts, feast and name-day pages. The feast/holiday content pages are an SEO pattern
  similar to our feast pages. No mobile app mentioned.
- Others seen: msze.pl (the authors phoned about 8,000 parishes to build the data, per
  antyweb.pl), Drogowskaz (started in the Poznań archdiocese in 2021, per bankier.pl). Ratings
  not checked.

### International

**10. MassTimes.org / "Mass Times for Travel" (Mass Times Trust)**
- URLs: https://masstimes.org, https://apps.apple.com/us/app/-/id825001975.
- Model: Mass Times Trust, a US 501(c)(3), operated as a service of the Diocese of Lansing, which
  provides no funding. "Masstimes.org relies on donations from those who use the service." The
  site also shows ads inside search results. ProPublica (Form 990/990-EZ): revenue $69,723 and
  expenses $67,413 in 2020; contributions were 88.3% of revenue. In 2011 revenue was $279,005.
  Newer filings: not found.
- Coverage: about 121,000 churches in 201 countries and territories. Each listing shows a
  last-updated date. Only lists churches found on diocesan sites or confirmed by a diocese.
- App: free; 4.3/5 from 266 ratings (App Store US). Filters: day, time of day, service type
  (incl. confession); sort by time or distance; map and list on one screen.
- Weak: reviews say the app adds little over the website (2019) and that the 2023 switch to
  time-first sorting buried nearby churches. Czech coverage depth: not checked (?).
- DiscoverMass (discovermass.com) is a parish-services vendor (Diocesan) whose Mass times come
  from MassTimes. It is not a separate data source.

**11. Catholic Mass Times (catholicmasstimes.com, Pablo Licheri / Catholia, Inc.)**
- URLs: https://catholicmasstimes.com, https://apps.apple.com/us/app/-/id789923520.
- Model: free, no ads (per CNA, Aug 2025). The founder: "For almost 10 years, my wife and I
  financed everything." Now crowd-funded by donations (Donorbox) through Catholia, Inc., a
  US 501(c)(3), in partnership with an Argentine foundation. Amount raised: not found.
- Scale (self-reported): 125,000–136,000+ churches in 245 countries, 2.1M downloads, 250,000+
  monthly users, 40 app languages. A third-party tracker (AppGoblin) estimates 366K installs,
  far below the 2M claim.
- App: 4.9/5 from 8.1K ratings (App Store US). Google Play rating: not found (an unreliable
  mirror says 4.8 from 542). Filters for confession today, adoration today, and language.
  Each time shows its last verification date. Corrections are submitted in the app and checked
  against diocesan sites and Google Maps.
- Weak: the most common complaint is missing churches (e.g. one parish shown where 10 exist,
  per justuseapp review summaries). Czech coverage depth: not checked (?).

**12. Google Maps / Google Search**
- Free, ad-funded. No dedicated Mass-times field in Google Business Profile was found; church
  guides tell parishes to put service times into normal opening hours and "special hours".
  So times appear only when a parish keeps its profile updated, and "open hours" is ambiguous
  for a church. It is the default many people try first.

**13. Laudate (Aycka Soft)**: free, a readings/prayers app with a daily Mass stream. No
Mass-finder feature was confirmed in current listings. Not a direct competitor.

**Others seen but not analysed:** Mass Times USA and Canada (5.0 from 2 ratings), Sveta Misa
(Croatia), Duszpolonia (Polish Masses abroad), gcatholic.org (church directory with maps,
mostly without times). iMass: no current listing found.

## Feature-gap table

Legend: ✓ yes · ✗ no · partial · ? not verified. "CBK" = bohosluzby.cirkev.cz,
"DoK" = DoKostola, "MT" = MassTimes.org app, "CMT" = Catholic Mass Times, "Par." = parish
websites, "FdK" = Farnost do kapsy, "GMaps" = Google Maps.

| Feature | Us | CBK | Par. | FdK | DoK | msze.info | MT | CMT | GMaps |
|---|---|---|---|---|---|---|---|---|---|
| Location-based next Mass (time+distance) | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | partial |
| Map with times on pins | ✓ | ✗ | ✗ | ✗ | partial (map, times ?) | partial (map) | partial (map+list) | partial (map) | ✗ |
| Offline | ✓ | ✗ | ✗ | ? | ? | ✗ | ? | ? | partial |
| Language filter | ✓ | ✓ | ✗ | ✗ | ? | ? | ? | ✓ | ✗ |
| Rite filter (Greek-Catholic) | ✓ | ? | ✗ | ✗ | ? | ? | ? | ? | ✗ |
| Wheelchair filter | ✓ | ✓ | ✗ | ✗ | ? | ? | ? | ? | partial (place attribute) |
| Confession times | ✓ | ? | partial | ? | ✓ | ? | ✓ | ✓ | ✗ |
| Feast-day pages (Dušičky etc.) | ✓ | ✗ | partial | ✗ | partial (holy-day alerts) | ✓ | ✗ | ? | ✗ |
| ICS / add to calendar | ✓ | ✗ | ✗ | ? | ? | ? | ? | ? | ✗ |
| Parish embed widget | ✓ | ✗ | n/a | partial (it is the parish site) | ✗ | ✗ | ? | ✗ | partial (Maps embed, no times) |
| Data freshness shown | ✓ | ✗ | partial (date on PDF) | ? | ? | ? | ✓ | ✓ | ✗ |
| Official data source | ✓ (ČBK) | ✓ | ✓ | ✓ (parish) | ✗ (volunteers) | ? | partial (diocese-confirmed) | ✗ (crowd + team) | ✗ |
| No ads / no account | ✓ | ✓ | ✓ | ? | ? | ? | ✗ (ads in results) | ✓ | ✗ (ads) |
| iOS app | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| Android app | ✗ (web/PWA) | ✗ | ✗ | ? | ✓ (linked) | ✗ | ✓ | ✓ | ✓ |
| Coverage | CZ (~4,000) | CZ | 1 parish | OMNIA parishes | SK (~4,000) | PL + abroad | world (121k) | world (125–136k) | world, patchy |

## Where we win (moat)

- Nobody in CZ combines the official ČBK data with a phone-first app. The ČBK site has the data
  and the filters but no app, no map, no offline. No Czech finder app turned up in either store.
- Map with times on the pins: no one in CZ does it; the international apps show pins without
  the next time.
- Calendar export (ICS) and offline: no Czech option. Not confirmed for any competitor.
- Parish embed widget: parishes publish PDFs. The only "app" path for parishes (Farnost do kapsy)
  needs a paid parish-website system. A free embed fed by the official registry fills that gap.
- Per-entry staleness warnings: the ČBK site only has a general "verify with the parish" note.
  MassTimes and Catholic Mass Times show last-updated dates, which suggests users expect it.
- Feast pages (Dušičky, All Saints) and per-church/city static pages: in CZ, only parish PDFs
  cover feasts; msze.info shows the SEO pattern works in Poland.
- Greek-Catholic rite filter: not seen anywhere in CZ/SK.
- Risks: the ČBK could ship its own app or map. Catholic Mass Times keeps growing worldwide and
  is ad-free, so "no ads" alone is not a moat. We have no Android store app yet; DoKostola,
  MassTimes and CMT do.

### Moat bet and entrant-difficulty score (flywheel `docs/standards/moat.md`)

**Before this round: 1.** A competent solo dev with our prompt, two weeks and $0 could
rebuild the app: the ČBK API is open, the scraper and the note parser are a few hundred lines.
What they would not have is ours only in part: the parsed-note rules (`notes.ts`, tuned on
the real registry phrasings) and ~4,000 indexed church pages that had been 404 until October.

**Target after: 3 — a channel and a reputation we built.** The bet is the Schematismus role
(`docs/SIGNATURE.md`): be the place the Czech Church's own data is *read*, on three fronts
that compound and that an entrant can't copy in two weeks:
1. **Search presence on the liturgical peaks.** Feast pages (Dušičky now, Christmas and the
   Triduum next) and 4,000 church pages that age into the index year after year. Rank on
   "mše dušičky <město>" is earned once a year and accrues.
2. **Parishes as distribution.** The embed widget on parish websites, and the data-quality
   report back to ČBK. Each parish that embeds is a relationship and a backlink.
3. **Invitation as the growth loop** (mechanic C): every invite brings a person to a church
   page with the app one tap away.

What we deliberately do not rely on: owning the data. It is the Church's, maintained by
parishes; if ČBK ships its own app, the right response is to offer them ours.

Scored honestly at the end of this round: still **1–2**. The feast pages shipped on
27 Oct and are not yet indexed; the embed has no parish yet. The score moves to 3 when
Search Console shows `/dusicky/` and `/kostel/` impressions and the first parish embeds.

## Sources (all accessed 2026-10-27)

- https://bohosluzby.cirkev.cz
- https://apps.apple.com/tt/app/farnost-do-kapsy/id1609757101
- https://apps.apple.com/app/id793979123 (LiturgieCz)
- https://apps.apple.com/cz/app/audiokostel/id1522194154?l=cs
- https://www.apha.cz/farnosti/ (404) and apha.cz newsletter PDFs, e.g. https://apha.cz/wp-content/uploads/2024/12/zpravodajpa-24-12.pdf
- https://kostelec.dpv.cz/wp-content/uploads/sites/6/2024/04/Farni-listy-–-ZMRTVYCHVSTANI-PANE-31.3.2024.pdf
- https://srdcepane.cz/wp-content/uploads/2024/12/Oznameni-2024-12-15.pdf
- https://www.dokostola.sk
- https://apps.apple.com/sk/app/dokostola/id1589411662?l=sk
- https://www.omse.sk (HTTP 503)
- https://eobchod.ssv.sk/obchod_homedir/data/745/prilohy/direktorium-2026-ukazka.pdf
- https://www.msze.info
- https://antyweb.pl/msze-pl-na-iphona-ale-bez-opcji-check-in
- https://www.bankier.pl/wiadomosc/Aplikacja-Drogowskaz-wskaze-msze-i-nabozenstwa-w-calej-Polsce-8087451.html
- https://masstimes.org/components/about/about.html
- https://projects.propublica.org/nonprofits/organizations/650724755
- https://apps.apple.com/us/app/-/id825001975 (Mass Times for Travel)
- https://discovermass.com/about-us/
- https://catholicmasstimes.com/llms.txt
- https://catholicmasstimes.com/?p=5091
- https://donorbox.org/catholic-mass-times
- https://apps.apple.com/us/app/-/id789923520 (Catholic Mass Times)
- https://appgoblin.info/apps/789923520
- https://justuseapp.com/en/app/789923520/catholic-mass-times/reviews
- https://www.ncregister.com/cna/global-mass-finding-app-surpasses-2-million-downloads
- https://www.methodist.org.uk/for-churches/digital-church/digital-training-blog/how-to-set-up-your-churchs-google-business-profile/
- https://stevefogg.com/2026/05/29/why-your-church-needs-a-google-business-profile-in-2026/
- https://apps.appfollow.io/ios/laudate-1-catholic-app/499428207?country=in
- https://apps.apple.com/us/app/mass-times-usa-and-canada/id6538727087

# Owner tasks — Kam na mši

The steps only Pavol can do. Tick them here, or paste them into your task list (Notion's
free block limit refused them on 2026-10-07). Newest batch first.

## Ship what merged on 2026-10-07

- [ ] **iOS build**: `fastlane ios beta` on the mini, then submit. It carries the iOS 15
      blank-app fix, the share-link fix and the late-GPS fix. Until then, iOS 15–16.3 users
      see a blank app.
- [ ] **Search Console + Seznam Webmaster**: submit `https://bohosluzby.dravec.org/sitemap.xml`
      (now 4 031 URLs, all 4 000 church pages). 10 minutes. This is the channel attempt the
      kill criterion asks for.
- [ ] **ČBK email**: review the Gmail draft "Kvalita dat v rejstříku bohoslužeb" (to
      bohosluzby@cirkev.cz), attach or link `docs/registry-quality.md` + the CSV, send if
      you agree. Nothing was sent.
- [ ] **Gate decision** for the overdue 2026-09-03 kill criterion: ITERATE to 2026-12-31 or
      MAINTAIN (recommendation in `docs/EVOLVE.md`).

## Android release (Play)

1. [ ] **Play Console account** (by 9 Oct): play.google.com/console, personal account, 25 USD
       once. Identity verification can take days; nothing else starts before it clears.
2. [ ] **Upload key** (9 Oct, 5 min on the Mac):
       - `git pull`, then `scripts/android-keystore.sh` (needs a JDK for `keytool`, and `gh`).
       - It sets 4 repo secrets.
       - **Save the printed password in 1Password**, and back up `~/.config/kam-na-msi/`.
3. [ ] **Tag** (10 Oct): `git tag android-v1.2.0 && git push origin android-v1.2.0`.
       - The workflow attaches a signed `.aab` and an `.apk` to a GitHub Release.
       - Self-check the `.apk` on a phone: airplane mode, deny location, reminder, share link
         (must be `bohosluzby.dravec.org/kostel/…`), back gesture.
4. [ ] **Create the app + closed test** (12 Oct):
       - *Create app* (Kam na mši, Czech, free).
       - *Closed testing → Create release* with the `.aab`.
       - *Store listing* from `docs/store/play-metadata.md`; phone screenshots are in
         `store-assets/android/phone/` (1080×1920: map, list, detail).
       - *App content*: data safety, IARC, audience, no ads.
5. [ ] **12 testers for 14 days** (from 13 Oct): family, friends, the parish list. They opt in
       via the closed-testing link and keep the app installed. Earliest production request is
       about 27 Oct.
6. [ ] **Production** (from 28 Oct): *Production → Create release* with the same `.aab`.
       - Optional: *Setup → API access* → service account with Release manager → repo secret
         `PLAY_SERVICE_ACCOUNT_JSON`. Every later `android-v*` tag then uploads itself.

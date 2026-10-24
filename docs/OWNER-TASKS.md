# Owner tasks — Kam na mši

The steps only Pavol can do. Tick them here, or paste them into your task list (Notion's
free block limit refused them on 2026-10-07). Newest batch first.

## Clean-up after the hosted-Mac run (2026-10-24)

- [ ] **Revoke certificate NXW2P6X576**: developer.apple.com → Certificates, the Apple
      Distribution certificate created 2026-10-24. Fastlane `cert` minted it on a GitHub
      runner, and its private key was lost with the runner, so nothing can sign with it.
      Revoking it frees the slot (Apple caps distribution certificates). **Keep
      KL8QSY327N**, which is the one in use. Also delete the profile "org.dravec.bohosluzby
      AppStore 1792863723", which is tied to the dead certificate. CI can no longer create
      certificates (Fastfile, `RELEASE_KEYCHAIN` branch).

## iOS 1.3 (2026-10-14)

- [x] Apple agreement accepted (2026-10-14); ASC API answers again.
- [ ] **TestFlight check**: build 80 (1.3) is in internal testing (77–79 expired). Install it, check the app opens
      (ideally on an iOS 15–16.3 device too), ☆ uložit, city chips, share link.
- [ ] **Submit for Review** in App Store Connect → 1.3 (notes + screenshots
      uploaded). Build 80 attached. Nothing was submitted.

## Ship what merged on 2026-10-07

- [x] **iOS build**: done as 1.3 build 80 (2026-10-14); see the iOS 1.3 section.
- [ ] **Search Console + Seznam Webmaster**: submit `https://bohosluzby.dravec.org/sitemap.xml`
      (now 4 031 URLs, all 4 000 church pages). 10 minutes. This is the channel attempt the
      kill criterion asks for.
- [ ] **ČBK email**: review the Gmail draft "Kvalita dat v rejstříku bohoslužeb" (to
      bohosluzby@cirkev.cz), attach or link `docs/registry-quality.md` + the CSV, send if
      you agree. Nothing was sent.
- [ ] **Parish embed test**: offer the two-line snippet (`docs/EMBED.md`) to 3 parishes,
      for example your own and two whose websites are alive. First test: 3 embeds, then
      clicks with `utm_source=embed`.
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

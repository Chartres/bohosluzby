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
- [x] TestFlight check + Submit: App Store Connect reports 1.3 as **approved** (seen
      2026-10-24 when an upload was refused because "train 1.3 is closed"). New builds are
      **1.4**, on TestFlight after every merge to main.

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

Your steps, in order, each as short as it gets: **`docs/ANDROID-RELEASE.md`** (4 Nov 2026,
replaces the October list that stood here).

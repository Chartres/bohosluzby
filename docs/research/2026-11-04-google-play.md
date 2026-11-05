# Google Play: publishing a new free Capacitor app (research as of 2026-11-04)

Scope: a new free Android app (Capacitor/WebView) with no ads and no accounts, foreground location, and anonymous analytics events, published from a Play developer account.
Pages were fetched on 2026-11-04. "Page date" is the *Last updated* stamp that developer.android.com and developers.google.com show. Play Console Help (support.google.com) pages have **no** last-updated stamp, so for those I give the dates written in the text, or "(no date shown)".

Repo context (read-only check): `android/variables.gradle` has `targetSdkVersion = 36`, `compileSdkVersion = 36` and `minSdkVersion = 24`. The Capacitor 8 plugins are core, filesystem, geolocation, haptics, local-notifications, share, splash-screen and status-bar.

---

## 1. Target API level

- **Current rule (since 31 Aug 2026):** "New apps and app updates must target Android 16 (API level 36) or higher to be submitted to Google Play." Wear OS and Automotive may target 35; TV and XR may target 34. Source: https://developer.android.com/google/play/requirements/target-sdk (Last updated 2026-10-28). The Help Center says the same: https://support.google.com/googleplay/android-developer/answer/11926878 (no date shown; it lists the 31 Aug 2026 deadline).
- **Existing apps:** "Existing apps must target Android 15 (API level 35) or higher to remain available to new users" on newer OS versions. Same sources.
- **Extension:** developers could "request an extension to November 1, 2026". That date has now passed. Same sources.
- **Next deadline:** **not announced.** Neither page names a later date or level, including the target-sdk page updated 2026-10-28. *Inference:* Google's yearly pattern points to API 37 (Android 17) around 31 Aug 2027. No Google source confirms this.
- **This repo:** target 36 meets the current rule.

## 2. App bundles, Play App Signing, keys

- **AAB:** "From August 2021, new apps are required to publish with the Android App Bundle on Google Play." Source: https://developer.android.com/guide/app-bundle (Last updated 2026-06-24).
- **Play App Signing:** "Play App Signing is required for new apps so that they can use AABs." Source: https://developer.android.com/guide/app-bundle/faq (Last updated 2026-10-06).
- **Upload key vs app signing key:**
  - You sign the upload with the **upload key**. It must be RSA ≥2048 bits. "If compromised or lost, Google can reset it for you."
  - Google holds the **app signing key** and uses it to sign the APKs that users get. It "cannot be reset if you manage it yourself and lose it."
  - Source: https://support.google.com/googleplay/android-developer/answer/9842756 (no date shown).
- **New in 2026, quantum-ready hybrid signing:** "Create a new app. Your app will be automatically enrolled in quantum-ready, hybrid signing with Google-generated keys." This combines RSA-4096 with ML-DSA-65, plus a separate classical key for Android ≤16, so an app ends up with **three keys**. API providers that pin SHA fingerprints need all three registered. Hybrid signing "is not compatible with v4 signing". You can opt out to your own key "before a release is rolled out in the open testing or production track." Same source (9842756).
  - This repo has no Google Maps or Firebase keys pinned to SHA fingerprints (it uses OSM tiles), so this probably matters little here.
- **Upload key reset:**
  1. Create a new keystore.
  2. Export the certificate with `keytool -export -rfc -keystore upload-keystore.jks -alias upload -file upload_certificate.pem`.
  3. Go to Play Console → *Protected with Play → Play Store protection → Manage Play app signing*, then "Upload key certificate" → **Request upload key reset**, give a reason, upload the PEM.
  - Configuring Play App Signing requires admin permission.
  - The page **does not state** how long a reset takes.
  - Source: 9842756 (no date shown).

## 3. Play Developer API (androidpublisher v3): service account

- **Linking a Cloud project is no longer required:** "You no longer need to link your developer account to a Google Cloud Project in order to access the Google Play Developer API." Current steps:
  1. Create or reuse a GCP project.
  2. Enable the Google Play Developer API.
  3. Create a service account (and a JSON key, or Workload Identity Federation).
  4. In Play Console, go to **Users & permissions → Invite new users**, paste the service account email, grant rights, and click **Invite user**.
  - Source: https://developers.google.com/android-publisher/getting_started (Last updated 2025-12-18).
- **Permissions to upload to internal testing** (Play Console permission names): https://support.google.com/googleplay/android-developer/answer/9844686 (no date shown).
  - **"Release apps to testing tracks"**: "Upload draft apps. Create, edit, and roll out releases to testing tracks … Does not allow users to publish apps to production." This is the minimum for internal or closed uploads.
  - **"Manage testing tracks and edit tester lists"**: needed if the API or CI also edits tester lists or track configuration.
  - **"Manage store presence"**: needed for listing text and graphics (fastlane metadata or images).
  - **"Release to production, exclude devices, and use Play App Signing"**: production only. Leave it off for an internal-only bot.
  - **"Manage policy declarations"**: Data safety and similar forms. The API cannot fill these anyway.
  - Permissions can be granted at account level or per app.
- **First upload via the API is not possible. It must be done in the Console:** "You can only use this API to make changes to an existing app (that has at least one APK uploaded); thus, you will have to upload at least one APK through the Play Console before you can use this API. Furthermore, you cannot use this API to … fill out the legal consents required for publishing." Source: https://developers.google.com/android-publisher/edits (Last updated 2025-12-18). The API also cannot create the app entry. (*Inference:* no create-app method exists in the v3 reference.)
- **Release status values:** `draft` ("APKs are not being served to users"), `inProgress`, `halted`, `completed`. Source: https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks (Last updated 2026-09-28). "Draft releases can be created via the API for later deployment through the Google Play Console." Source: https://developers.google.com/android-publisher/tracks (Last updated 2025-12-18).
- **Draft apps:** while the app is still a *draft app*, that is, setup not finished and never published, the API rejects non-draft releases with `Only releases with status draft may be created on draft app`. Use `status: draft` and roll out from the Console, or finish the setup tasks first. *This is not in Google's docs.* It comes from third-party reports, for example https://learn.microsoft.com/answers/questions/822890/ (2022) and https://docs.flutterflow.io/google-play-draft-release-error (undated).

## 4. fastlane supply

- **Current version:** fastlane **2.241.2**, released 2026-10-26. Source: https://rubygems.org/api/v1/gems/fastlane.json (fetched 2026-11-04).
- **Docs:** https://docs.fastlane.tools/actions/supply/ (no date shown).
  - `track`: production / beta / alpha / **internal**.
  - `release_status`: completed, **draft**, halted, inProgress. The docs say "draft" means you "complete the release at some other time".
  - `json_key` (path) or **`json_key_data`** (raw JSON). These accept service-account, Workload Identity or ADC credentials; `.p12` is deprecated.
  - `aab`; `skip_upload_apk`, `skip_upload_aab`, **`skip_upload_metadata`** (changelogs excluded), `skip_upload_changelogs`, **`skip_upload_images`** (screenshots excluded), **`skip_upload_screenshots`**; `sync_image_upload`; `rollout`.
  - Example: `fastlane supply --aab app.aab --track internal --release_status draft --json_key_data "$PLAY_JSON" --skip_upload_metadata --skip_upload_images --skip_upload_screenshots`
- **Setup:** the docs now say to invite the service account email in Users and Permissions, and to optionally use Workload Identity Federation for GitHub Actions. Check the key with `fastlane run validate_play_store_json_key json_key:<file>`.
- **Known first-upload limitation:** "Before using supply to connect to Google Play Store, you'll need to set up your app manually first by uploading at least one build to Google Play Store. See fastlane/fastlane#14686." Otherwise the API returns `applicationNotFound`. Sources: supply docs and https://github.com/fastlane/fastlane/issues/14686 (opened 2019-04-26). This matches Google's edits page in §3.

## 5. Store listing limits and graphics

- **Text limits:** app name **30**, short description **80**, full description **4,000** characters. "Character limits apply to both full-width and half-width characters." Source: https://support.google.com/googleplay/android-developer/answer/9859152 (no date shown). The short description rules also ban emoji, "Best/#1/Free", calls to action and ALL CAPS: https://support.google.com/googleplay/android-developer/answer/9866151.
- **Graphics** (source: https://support.google.com/googleplay/android-developer/answer/9866151, no date shown):
  - **App icon:** 32-bit PNG with alpha, **512×512**, ≤1024 KB.
  - **Feature graphic (required):** JPEG or 24-bit PNG with no alpha, **1024×500**.
  - **Screenshots:**
    - "You must provide a minimum of **two** screenshots across different device types". Up to **8 per device type**.
    - JPEG or 24-bit PNG with no alpha. Minimum side 320 px, maximum side 3840 px, and the long side ≤ **2×** the short side.
    - *Recommended*, and needed for promotion formats: ≥4 screenshots at ≥1080 px, 9:16 portrait (≥1080×1920).
    - The existing 1080×1920 `phone` device in `e2e/store-shots.spec.ts` fits this.
  - **Tablets and Chromebooks:** "For Chromebook and tablets, you **can** add a minimum of 4 screenshots". Sizes are 1,080–7,680 px at 16:9 or 9:16.
    - The page makes TV, Wear, Automotive and XR screenshots mandatory when you distribute to them. It does **not** make tablet screenshots mandatory.
    - *Inference:* tablet screenshots are optional for publishing, but without them the app is less eligible for large-screen featuring.
  - **Video:** optional YouTube URL. Ads must be off and the video public or unlisted.

## 6. App content declarations (Policy and programs → App content)

Overview page: https://support.google.com/googleplay/android-developer/answer/9859455 (no date shown).

- **Privacy policy (required for every app):** "You must link to a privacy policy on your store listing **and within your app**, even if your app doesn't access personal or sensitive user data." It must be a public HTTPS page, open worldwide without a login, not a PDF, and specific to the app.
- **Ads:** declare Yes or No. Here the answer is **No**.
- **App access / sign-in details:** needed only if parts of the app are restricted. Here there are no accounts, so "all functionality available without special access". *Inference:* location could count as a restriction ("restricted based on … location"). The city picker gives full access without location, so you can mention that in the instructions.
- **Target audience and content:** pick age groups. Including under-13s brings in the Families policy. *Recommendation:* 18+ or 13+ only, to avoid Families. Source: https://support.google.com/googleplay/android-developer/answer/9867159.
- **Content rating (IARC questionnaire):** required. Unrated apps "may be removed". You give an email for IARC correspondence and choose a category, for example "Reference, News, or Educational" or "All other app types". Source: https://support.google.com/googleplay/android-developer/answer/9859655 (no date shown).
- **Data safety form:** source https://support.google.com/googleplay/android-developer/answer/10787469. The change log's latest entry is 5 Dec 2023.
  - Required for every app on closed, open or production tracks. Apps **exclusively on internal testing are exempt** (since 24 Oct 2022). Apps that collect nothing must still submit the form and link a privacy policy.
  - **"Collect" = transmitting data off the device**, including by SDKs and by a WebView "if your app is in control of the code" (here it is, since the bundled app runs in the WebView).
  - **On-device only is out of scope:** "User data accessed by your app that is only processed locally on the user's device and not sent off device does not need to be disclosed." So **location used only on-device to sort churches is not "collected".**
  - **Ephemeral:** data sent off-device but kept only in memory for the real-time request must still go in the form, but is **not shown** on the listing. Example given: a weather app that sends location.
  - **Pseudonymous data must be disclosed.** Analytics events with a stable client or session ID count as "App activity / App interactions" (and possibly "Device or other IDs") collected for **Analytics**. Only data "fully anonymized so that it can no longer be associated with an individual user" escapes *sharing* disclosure.
  - Approximate location *inferred via IP* counts as location if it is collected.
  - Service providers (for example a hosted DB such as Supabase processing on your behalf) are **not "sharing"**.
  - *Inference for this app:*
    - Declare "collected: App interactions (Analytics), not shared, encrypted in transit". Add "Other user-generated content" or feedback if the footer FeedbackCard sends text, and "Crash logs / Diagnostics" if `error` events carry stack traces.
    - Location is **not** collected, provided coordinates never reach the analytics payload or any server, including tile requests. OSM tile URLs reveal the area viewed. That is arguably ephemeral or a service-provider fetch, but decide consciously.
- **Health apps declaration:** **required for all apps.** Choose "My app doesn't provide any health features". Mandatory since 31 Aug 2024. Source: https://support.google.com/googleplay/android-developer/answer/14738291.
- **Financial features declaration:** **required for all apps** on closed, open or production tracks. Choose "My app doesn't provide any financial features". Source: https://support.google.com/googleplay/android-developer/answer/13849271 (deadline was 31 Aug 2023).
- **Government apps:** declaration on App content: answer **No**. Source: https://support.google.com/googleplay/android-developer/answer/10523915 (in effect since 31 Jan 2023).
- **News & Magazine:** a self-declaration applies only to apps in the News & Magazines category or that call themselves news. Answer **No / not a news app**, and use a category such as "Lifestyle" or "Maps & Navigation". Source: https://support.google.com/googleplay/android-developer/answer/9935326 (declaration required from 27 Aug 2025 per search summary).
- **Permissions declaration:** `ACCESS_FINE/COARSE_LOCATION` in the foreground needs no declaration form. Only background location (`ACCESS_BACKGROUND_LOCATION`) triggers the location permissions declaration and a video. *Inference from general policy, not re-fetched.* The geolocation plugin must not add the background permission.
  - Also check: `@capacitor/local-notifications` may pull in `SCHEDULE_EXACT_ALARM`. If so, Play asks for an exact-alarm declaration, or you switch to `USE_EXACT_ALARM` or inexact alarms. *Not verified in this pass; check the merged manifest.*

## 7. Personal accounts: testing requirement, identity and verification

- **Closed test before production:**
  - Applies to "**personal** Google Play Console accounts created **after November 13, 2023**".
  - Rule: "a closed test … with a minimum of **12 testers** who have been opted in **continuously for at least 14 days**."
  - The **Production** page (Test and release → Production) and Pre-registration "remain disabled until developers meet these testing requirements".
  - Apply on the **Dashboard** ("Apply for production"), answering three groups of questions: closed test, app, production readiness.
  - Review "usually takes seven days or less".
  - Closed testing requires "Complete app setup". Internal testing needs nothing. Open testing only unlocks after production access.
  - Source: https://support.google.com/googleplay/android-developer/answer/14151465 (no date shown; the text contains only the 13 Nov 2023 cutoff).
  - History: the count was 20, then cut to 12 on 11 Dec 2024. That date comes from third-party guides, for example https://www.testerscommunity.com/google-play-closed-testing. The 12 figure is confirmed on Google's page.
  - **Organization accounts:** the article is addressed only to personal accounts created after the cutoff. *Inference:* organization accounts are exempt. Google's page does not say "exempt" in so many words.
  - **How to tell if it applies:** practically, the Production page is greyed out or locked, and the Dashboard shows an "Apply for production" / closed-testing checklist. Account type (personal or organization) appears in Play Console under *Settings → Developer account → Account details* (*inferred from the Help pages' navigation, not verified in a live Console*).
- **Device verification (new personal accounts):** before an app can go live, verify access to a real non-rooted Android 10+ device. Go to Home → "Verify that you have access to an Android mobile device" → scan the QR code → Play Console mobile app → Verify. Source: https://support.google.com/googleplay/android-developer/answer/14316361 (states "starting in early 2024").
- **Identity verification:**
  - Personal accounts verify legal name and address through the Payments profile. Contact email, contact phone and developer email are verified by OTP.
  - **Organization accounts need a D-U-N-S number** (free from Dun & Bradstreet). Government bodies can get help without one.
  - You **must** choose an organization account for financial, health, VPN or government apps. A church Mass-times finder needs none of these, so a personal account is fine.
  - Sources: https://support.google.com/googleplay/android-developer/answer/13628312, https://support.google.com/googleplay/android-developer/answer/13634885, https://support.google.com/googleplay/android-developer/answer/10841920 (no dates shown).
- **Trader status (EEA/UK):** "all active developer accounts must declare whether they are a trader or non-trader … by **February 1, 2027**".
  - Traders show name, address, phone and email on the listing. Non-traders show only email and country.
  - A free hobby or community app is "unlikely to be a trader".
  - Source: 13628312.
- **Android developer verification (sideloading):**
  - "Starting September 30, 2026", certified devices in **Brazil, Indonesia, Singapore and Thailand** only install apps registered to verified developers. It expands "globally … in 2027".
  - Play developers are "automatically registered if you distribute your app through Google Play". Package registration is done in Play Console (new permission: "Register and manage package names for Android developer verification" in 9844686).
  - **This does not block Play publishing.** It matters for the sideloaded `.apk` on GitHub Releases: in those four countries now, and globally from 2027, that APK should be signed with a key registered to the verified account.
  - Source: https://developer.android.com/developer-verification/guides (Last updated 2026-08-18).

## 8. Other 2025–2026 items

- **16 KB page size:** "all apps targeting Android 15 (API level 35) and higher must support 16 KB memory page sizes on 64-bit devices on Google Play. Starting **February 1, 2027**, if your app updates don't support 16 KB memory page sizes, you won't be able to release these updates." "If your app only uses code written in the Java programming language or in Kotlin, including all libraries or SDKs, then your app already supports 16 KB devices." Source: https://developer.android.com/guide/practices/page-sizes (Last updated 2026-10-16).
  - *Inference:* the Capacitor core plugins listed are Java/Kotlin only, so this is likely fine. Confirm with APK Analyzer (no `lib/*.so`) or the Play Console compatibility warning.
- **Edge-to-edge and predictive back:** these are Android 15/16 *platform behaviours* for apps targeting 35/36. Edge-to-edge is enforced, and the opt-out is removed at target 36. They are **not Play review gates.** *Inference.* At target 36, check that the WebView handles insets (status-bar plugin, `env(safe-area-inset-*)`).
- **Play Integrity:** not required for publishing (no source makes it mandatory).
- **2-Step Verification:** recommended ("Protect your Play Console access by enforcing 2-Step Verification for all users" in 9842756). Google accounts generally require it for Console sign-in. *Not re-verified.*
- **Registration fee:** the one-time fee is still mentioned (13628312). Amount not re-checked (historically US$25).

---

## Uncertain / not confirmed from a primary source

1. **Next target API deadline** (likely API 37, Aug 2027): no Google announcement found as of 2026-11-04.
2. **Organization accounts exempt from 12×14:** implied by the article's scope ("personal accounts created after Nov 13 2023"), not stated as an explicit exemption on the page I read.
3. **Whether the 12×14 test is per app or per account:** the wording is per app ("run a closed test for their app"). In practice each new app from a post-cutoff personal account needs its own test. Third-party guides disagree.
4. **Exact Console path showing account type:** I could not view a live Console. *Settings → Developer account → Account details* is inferred.
5. **"Only releases with status draft may be created on draft app":** documented only by third parties, not by Google. Treat as real: it is widely reported and matches the API's draft semantics.
6. **Upload key reset turnaround:** the current help page gives no duration. Historically about 48 h, unconfirmed.
7. **Tablet screenshots:** not mandatory per 9866151 wording ("can add"). Whether the Console blocks a submission without them when the app supports large screens: not observed; believed not to.
8. **Data safety treatment of OSM tile requests and IP-derived coarse location:** policy text supports "ephemeral / service provider", but it is a judgement call.
9. **News & Magazine declaration date** (27 Aug 2025) came from a search summary of 9935326, not a full read.
10. **Exact-alarm or other permission declarations triggered by `@capacitor/local-notifications`:** not checked against the merged manifest.

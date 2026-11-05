// Play policy gates for the Android release (flywheel docs/standards/release-mobile.md).
//   node scripts/android-gates.mjs --gradle android/variables.gradle      target API ≥ Play's floor
//   node scripts/android-gates.mjs --badging badging.txt [--allow PERM]   merged-manifest permissions
// badging.txt is `aapt2 dump badging app.apk`. Both run in release-android.yml before
// any upload; a failure here costs a minute, a rejected upload costs a day.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// "New apps and app updates must target Android 16 (API level 36) or higher" since
// 31 Aug 2026 (developer.android.com/google/play/requirements/target-sdk, checked
// 4 Nov 2026). Google raises it each August; bump here and re-vendor.
export const TARGET_SDK_FLOOR = 36

// Permissions that bring a Play Console declaration form, a review, or a Data safety
// answer the product may not have given. A plugin can add one to the merged manifest
// without anyone writing it (local-notifications → SCHEDULE_EXACT_ALARM), so the
// gate reads the built APK, not the source manifest.
export const DECLARATION_PERMISSIONS = {
  'android.permission.ACCESS_BACKGROUND_LOCATION': 'background location: declaration form + video, separate review',
  'android.permission.SCHEDULE_EXACT_ALARM': 'exact alarms: likely a declaration unless the app is an alarm/calendar app (unverified; @capacitor/local-notifications ≥ 8.3 adds it — inexact reminders need it removed)',
  'android.permission.USE_EXACT_ALARM': 'exact alarms: only for alarm and calendar apps',
  'com.google.android.gms.permission.AD_ID': 'advertising ID: Data safety must declare Device IDs, ads declaration',
  'android.permission.QUERY_ALL_PACKAGES': 'all-packages visibility: declaration, rarely approved',
  'android.permission.MANAGE_EXTERNAL_STORAGE': 'all-files access: declaration, rarely approved',
  'android.permission.READ_MEDIA_IMAGES': 'photo access: declaration unless core to the app (use the photo picker)',
  'android.permission.READ_MEDIA_VIDEO': 'video access: declaration unless core to the app (use the photo picker)',
  'android.permission.READ_SMS': 'SMS: restricted, declaration',
  'android.permission.READ_CALL_LOG': 'call log: restricted, declaration',
  'android.permission.FOREGROUND_SERVICE_LOCATION': 'foreground service type: declaration + video',
  'android.permission.REQUEST_INSTALL_PACKAGES': 'installing packages: declaration',
}

/** targetSdkVersion from Capacitor's android/variables.gradle (or any gradle text). */
export function targetSdk(gradle) {
  const m = /targetSdkVersion\s*=?\s*(\d+)/.exec(gradle)
  return m ? Number(m[1]) : null
}

export function checkTargetSdk(gradle, floor = TARGET_SDK_FLOOR) {
  const sdk = targetSdk(gradle)
  if (sdk === null) return ['targetSdkVersion not found in the gradle file']
  if (sdk < floor) return [`targetSdkVersion is ${sdk}; Play accepts new apps and updates only at ${floor} or higher — raise it in android/variables.gradle`]
  return []
}

/** Permission names from `aapt2 dump badging`. */
export function permissions(badging) {
  return [...badging.matchAll(/^uses-permission: name='([^']+)'/gm)].map((m) => m[1])
}

/** Permissions still requested on Android 13+ (an entry capped by maxSdkVersion < 33 is not). */
function current(badging) {
  return [...badging.matchAll(/^uses-permission: name='([^']+)'(?:.*maxSdkVersion='(\d+)')?/gm)].filter((m) => !m[2] || Number(m[2]) >= 33).map((m) => m[1])
}

export function checkPermissions(badging, allow = []) {
  return current(badging)
    .filter((p) => p in DECLARATION_PERMISSIONS && !allow.includes(p))
    .map((p) => `${p} is in the built manifest (${DECLARATION_PERMISSIONS[p]}). Remove it (tools:node="remove" in AndroidManifest.xml) or pass --allow ${p} once Play Console has the declaration`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const opt = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const allow = args.flatMap((a, i) => (args[i - 1] === '--allow' ? [a] : []))
  const gradle = opt('--gradle')
  const badging = opt('--badging')
  if (!gradle && !badging) {
    console.error('usage: android-gates.mjs --gradle android/variables.gradle | --badging badging.txt [--allow PERMISSION]')
    process.exit(2)
  }
  const errors = [
    ...(gradle ? checkTargetSdk(readFileSync(gradle, 'utf8')) : []),
    ...(badging ? checkPermissions(readFileSync(badging, 'utf8'), allow) : []),
  ]
  for (const e of errors) console.error(`✗ ${e}`)
  if (errors.length) process.exit(1)
  if (gradle) console.log(`✓ targetSdkVersion ≥ ${TARGET_SDK_FLOOR}`)
  if (badging) console.log('✓ no permission that needs a Play declaration')
}

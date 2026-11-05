// scripts/android-gates.mjs — the release workflow's two Play policy gates, run before
// an upload Play would reject: target API at Play's floor, and no policy-sensitive
// permission in the merged manifest unless the product declared it on purpose.
// Run: node --test scripts/*.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { TARGET_SDK_FLOOR, checkPermissions, checkTargetSdk, permissions, targetSdk } from './android-gates.mjs'

const SCRIPT = fileURLToPath(new URL('./android-gates.mjs', import.meta.url))
const GRADLE = `ext {
    minSdkVersion = 24
    compileSdkVersion = 36
    targetSdkVersion = 36
    androidxActivityVersion = '1.11.0'
}`
const BADGING = `package: name='org.dravec.x' versionCode='142' versionName='1.5.0' platformBuildVersionName='16'
sdkVersion:'24'
targetSdkVersion:'36'
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.ACCESS_COARSE_LOCATION'
uses-permission: name='android.permission.ACCESS_FINE_LOCATION'
uses-permission: name='android.permission.POST_NOTIFICATIONS'
application-label:'X'`

describe('target API', () => {
  it('reads targetSdkVersion from Capacitor variables.gradle', () => {
    assert.equal(targetSdk(GRADLE), 36)
    assert.equal(targetSdk('targetSdkVersion=35'), 35)
    assert.equal(targetSdk('compileSdkVersion = 36'), null)
  })

  it('passes at the floor and fails below it, naming the floor', () => {
    assert.equal(TARGET_SDK_FLOOR, 36)
    assert.deepEqual(checkTargetSdk(GRADLE), [])
    assert.match(checkTargetSdk(GRADLE.replace('targetSdkVersion = 36', 'targetSdkVersion = 35'))[0], /35.*36/)
    assert.match(checkTargetSdk('nothing here')[0], /not found/)
  })
})

describe('permissions', () => {
  it('lists the permissions aapt2 badging prints', () => {
    assert.deepEqual(permissions(BADGING), [
      'android.permission.INTERNET',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ])
  })

  it('passes foreground location and notifications (no declaration form)', () => {
    assert.deepEqual(checkPermissions(BADGING), [])
  })

  it('flags permissions that need a Play declaration, unless allowed on purpose', () => {
    const risky = `${BADGING}
uses-permission: name='android.permission.ACCESS_BACKGROUND_LOCATION'
uses-permission: name='android.permission.SCHEDULE_EXACT_ALARM'
uses-permission: name='com.google.android.gms.permission.AD_ID'`
    const errors = checkPermissions(risky)
    assert.equal(errors.length, 3)
    assert.match(errors.join('\n'), /ACCESS_BACKGROUND_LOCATION/)
    assert.match(errors.join('\n'), /SCHEDULE_EXACT_ALARM/)
    assert.match(errors.join('\n'), /AD_ID/)
    assert.deepEqual(checkPermissions(risky, ['android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.SCHEDULE_EXACT_ALARM', 'com.google.android.gms.permission.AD_ID']), [])
  })

  it('ignores an entry capped below Android 13 (maxSdkVersion < 33): it is not requested there', () => {
    assert.deepEqual(checkPermissions(`${BADGING}\nuses-permission: name='android.permission.READ_MEDIA_IMAGES' maxSdkVersion='32'`), [])
    assert.equal(checkPermissions(`${BADGING}\nuses-permission: name='android.permission.READ_MEDIA_IMAGES' maxSdkVersion='34'`).length, 1)
  })
})

describe('CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'))
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })

  it('exits 0 on a clean build and 1 with the reason otherwise', () => {
    writeFileSync(join(dir, 'variables.gradle'), GRADLE)
    writeFileSync(join(dir, 'badging.txt'), BADGING)
    assert.equal(run('--gradle', join(dir, 'variables.gradle'), '--badging', join(dir, 'badging.txt')).status, 0)

    writeFileSync(join(dir, 'old.gradle'), 'targetSdkVersion = 34')
    const r = run('--gradle', join(dir, 'old.gradle'))
    assert.equal(r.status, 1)
    assert.match(r.stderr, /34/)
  })

  it('--allow lets a product keep a permission it declared in Play Console', () => {
    writeFileSync(join(dir, 'bg.txt'), `${BADGING}\nuses-permission: name='android.permission.ACCESS_BACKGROUND_LOCATION'`)
    assert.equal(run('--badging', join(dir, 'bg.txt')).status, 1)
    assert.equal(run('--badging', join(dir, 'bg.txt'), '--allow', 'android.permission.ACCESS_BACKGROUND_LOCATION').status, 0)
  })

  it('with no input it says how to call it', () => {
    const r = run()
    assert.equal(r.status, 2)
    assert.match(r.stderr, /--gradle/)
  })
})

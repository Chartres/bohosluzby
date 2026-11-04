// The app manifest strips the exact-alarm permissions a plugin may merge in
// (@capacitor/local-notifications 8.3+ adds SCHEDULE_EXACT_ALARM). Reminders fire
// 30 min before a Mass; minutes of drift are fine, and without the permission the
// plugin falls back to an inexact alarm (LocalNotificationManager.setExactIfPossible).
// Play wants a declaration for exact alarms; android-gates.mjs fails the build on them.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')

describe('AndroidManifest.xml', () => {
  it('declares the tools namespace', () => {
    assert.match(manifest, /xmlns:tools="http:\/\/schemas\.android\.com\/tools"/)
  })
  for (const perm of ['SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM']) {
    it(`removes ${perm} from the merged manifest`, () => {
      assert.match(manifest, new RegExp(`<uses-permission\\s+android:name="android\\.permission\\.${perm}"\\s+tools:node="remove"\\s*/>`))
    })
  }
})

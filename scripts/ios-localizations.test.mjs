// The App Store lists an app's languages from the .lproj folders inside the bundle, not
// from CFBundleLocalizations. Kam na mši shipped with only Base.lproj, so the store said
// "English" (iTunes lookup, 7 Nov 2026) although the app is Czech first. Every language
// in CFBundleLocalizations needs a <lang>.lproj with InfoPlist.strings (the location
// prompt in that language), wired into the Xcode project's Resources phase.
// Run: node --test scripts/*.test.mjs
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const APP = fileURLToPath(new URL('../ios/App/App/', import.meta.url))
const plist = readFileSync(`${APP}Info.plist`, 'utf8')
const pbx = readFileSync(fileURLToPath(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url)), 'utf8')
const langs = [...(/<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist)?.[1] ?? '').matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1])
const strings = (lang) => readFileSync(`${APP}${lang}.lproj/InfoPlist.strings`, 'utf8')

describe('iOS localizations (what the App Store lists as languages)', () => {
  it('declares Czech and English', () => {
    assert.deepEqual([...langs].sort(), ['cs', 'en'])
  })

  for (const lang of ['cs', 'en']) {
    it(`${lang}.lproj/InfoPlist.strings exists and carries the location prompt and the name`, () => {
      assert.ok(existsSync(`${APP}${lang}.lproj/InfoPlist.strings`))
      const s = strings(lang)
      for (const key of ['NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription', 'CFBundleDisplayName'])
        assert.match(s, new RegExp(`^"?${key}"?\\s*=\\s*"[^"]+";`, 'm'), `${lang}: ${key}`)
    })

    it(`the Xcode project ships ${lang} (knownRegions, variant group, Resources phase)`, () => {
      assert.match(/knownRegions = \(([\s\S]*?)\);/.exec(pbx)?.[1] ?? '', new RegExp(`\\b${lang},`))
      assert.match(pbx, new RegExp(`path = ${lang}\\.lproj/InfoPlist\\.strings;`))
    })
  }

  it('InfoPlist.strings is in the Resources build phase', () => {
    const phase = /isa = PBXResourcesBuildPhase;[\s\S]*?files = \(([\s\S]*?)\);/.exec(pbx)?.[1] ?? ''
    assert.match(phase, /InfoPlist\.strings in Resources/)
  })

  it('the Czech prompt matches Info.plist; the English one is English', () => {
    const base = /<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)[1]
    assert.ok(strings('cs').includes(base))
    assert.doesNotMatch(/NSLocationWhenInUseUsageDescription" = "([^"]+)"/.exec(strings('en'))[1], /[ěščřžýáíéůú]/) // the name stays Czech
  })
})

// Google Play listing checks (scripts/play-listing.mjs): the metadata fastlane
// supply uploads must stay inside Play's limits, or the upload is rejected after
// the build. Limits and sources: flywheel docs/standards/release-mobile.md.
// Run: node --test scripts/*.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkListing, pngSize } from './play-listing.mjs'

const LOC = 'cs-CZ' // any locale; the product's default comes from the stamp
const check = (root) => checkListing(root, { defaultLocale: LOC })

/** A minimal valid PNG header of the given size (IHDR is all the checker reads). */
function png(w, h) {
  const b = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'ascii')
  b.writeUInt32BE(w, 16)
  b.writeUInt32BE(h, 20)
  return b
}

function listing({ title = 'Kam na mši', short = 'Nejbližší mše svatá podle polohy.', full = 'Popis.', shots = 3, shot = [1080, 1920], icon = [512, 512], feature = [1024, 500], en = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'play-'))
  const cs = join(root, LOC)
  mkdirSync(join(cs, 'images', 'phoneScreenshots'), { recursive: true })
  writeFileSync(join(cs, 'title.txt'), title)
  writeFileSync(join(cs, 'short_description.txt'), short)
  writeFileSync(join(cs, 'full_description.txt'), full)
  writeFileSync(join(cs, 'images', 'icon.png'), png(...icon))
  writeFileSync(join(cs, 'images', 'featureGraphic.png'), png(...feature))
  for (let i = 1; i <= shots; i++) writeFileSync(join(cs, 'images', 'phoneScreenshots', `${i}.png`), png(...shot))
  if (en) {
    mkdirSync(join(root, 'en-US'))
    writeFileSync(join(root, 'en-US', 'title.txt'), 'Kam na mši')
    writeFileSync(join(root, 'en-US', 'short_description.txt'), 'Nearest Catholic Mass.')
    writeFileSync(join(root, 'en-US', 'full_description.txt'), 'Description.')
  }
  return root
}

describe('pngSize', () => {
  it('reads width and height from the IHDR chunk', () => {
    assert.deepEqual(pngSize(png(1080, 1920)), { width: 1080, height: 1920 })
  })
  it('rejects a file that is not a PNG', () => {
    assert.equal(pngSize(Buffer.from('GIF89a........................')), null)
  })
})

const has = (errors, re) => assert.ok(errors.some((e) => re.test(e)), `${re} not in ${JSON.stringify(errors)}`)

describe('checkListing', () => {
  it('passes a listing inside every limit', () => {
    assert.deepEqual(check(listing()), [])
  })

  it('counts characters, not bytes: diacritics are one character each', () => {
    assert.deepEqual(check(listing({ title: 'Kam na mši – katolické mše ČŘŽ' })), []) // 30 chars, more bytes
  })

  it('flags text over the limits (title 30, short 80, full 4000) and empty text', () => {
    const errors = check(listing({ title: 'x'.repeat(31), short: 'y'.repeat(81), full: 'z'.repeat(4001) }))
    has(errors, /cs-CZ\/title\.txt.*31.*30/)
    has(errors, /cs-CZ\/short_description\.txt.*81.*80/)
    has(errors, /cs-CZ\/full_description\.txt.*4001.*4000/)
    const empty = check(listing({ short: '  ' }))
    assert.equal(empty.length, 1)
    has(empty, /short_description\.txt is empty/)
  })

  it('rejects price and ranking words in the title and short description (Play metadata policy)', () => {
    has(check(listing({ short: 'Nejbližší mše svatá. Zdarma, offline.' })), /short_description\.txt.*"Zdarma"/)
    has(check(listing({ short: 'Najbližšia omša. Zadarmo.' })), /"Zadarmo"/)
    has(check(listing({ title: 'Best Mass app' })), /title\.txt.*"Best"/)
    has(check(listing({ short: 'Mše svatá, která je #1' })), /"#1"/)
    assert.deepEqual(check(listing({ full: 'Zdarma, bez reklam.' })), []) // fine in the full description
    assert.deepEqual(check(listing({ short: 'Topografie a novinky z farnosti' })), []) // words that merely contain them
  })

  it('needs the default language with its graphics; other locales may reuse them', () => {
    assert.deepEqual(check(listing({ en: true })), [])
    const errors = check(listing({ icon: [500, 500], feature: [1024, 512] }))
    has(errors, /icon\.png.*512x512/)
    has(errors, /featureGraphic\.png.*1024x500/)
    has(checkListing(listing(), { defaultLocale: 'sk-SK' }), /sk-SK\/ missing/)
  })

  it('wants 2–8 phone screenshots between 16:9 and 9:16, sides 320–3840 px', () => {
    has(check(listing({ shots: 1 })), /2–8 phone screenshots, found 1/)
    has(check(listing({ shots: 9 })), /2–8 phone screenshots, found 9/)
    has(check(listing({ shot: [1320, 2868] })), /aspect/) // the iPhone 6.9" shot
    has(check(listing({ shot: [300, 533] })), /320–3840/)
  })

  it('rejects unwritten text: a stamped skeleton says TODO until someone writes the listing', () => {
    has(check(listing({ short: 'TODO: one line on what the app does' })), /short_description\.txt.*TODO/)
  })

  it('release notes (changelogs/*.txt) stay within Play\'s 500 characters', () => {
    const root = listing()
    mkdirSync(join(root, LOC, 'changelogs'))
    writeFileSync(join(root, LOC, 'changelogs', 'default.txt'), 'n'.repeat(500))
    assert.deepEqual(check(root), [])
    writeFileSync(join(root, LOC, 'changelogs', 'default.txt'), 'ň'.repeat(501))
    has(check(root), /changelogs\/default\.txt has 501 characters, Play allows 500/)
    writeFileSync(join(root, LOC, 'changelogs', 'default.txt'), 'TODO')
    has(check(root), /changelogs\/default\.txt.*TODO/)
  })

  it('CLI: exits 1 with the reasons, 0 when clean; --default-locale picks the language', () => {
    const script = fileURLToPath(new URL('./play-listing.mjs', import.meta.url))
    const ok = spawnSync(process.execPath, [script, listing(), '--default-locale', LOC], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stderr)
    const bad = spawnSync(process.execPath, [script, listing({ shots: 1 }), '--default-locale', LOC], { encoding: 'utf8' })
    assert.equal(bad.status, 1)
    assert.match(bad.stderr, /found 1/)
  })
})

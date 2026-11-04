// Google Play listing checks (scripts/play-listing.mjs): the metadata fastlane
// supply uploads must stay inside Play's limits, or the upload is rejected after
// the build. Limits: docs/ANDROID-RELEASE.md (sources and dates there).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkListing, pngSize } from './play-listing.mjs'

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
  const cs = join(root, 'cs-CZ')
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
    expect(pngSize(png(1080, 1920))).toEqual({ width: 1080, height: 1920 })
  })
  it('rejects a file that is not a PNG', () => {
    expect(pngSize(Buffer.from('GIF89a........................'))).toBeNull()
  })
})

describe('checkListing', () => {
  it('passes a listing inside every limit', () => {
    expect(checkListing(listing())).toEqual([])
  })

  it('counts characters, not bytes: Czech diacritics are one character each', () => {
    expect(checkListing(listing({ title: 'Kam na mši – katolické mše ČŘŽ' }))).toEqual([]) // 30 chars, more bytes
  })

  it('flags text over the limits (title 30, short 80, full 4000) and empty text', () => {
    const errors = checkListing(listing({ title: 'x'.repeat(31), short: 'y'.repeat(81), full: 'z'.repeat(4001) }))
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/cs-CZ\/title\.txt.*31.*30/),
        expect.stringMatching(/cs-CZ\/short_description\.txt.*81.*80/),
        expect.stringMatching(/cs-CZ\/full_description\.txt.*4001.*4000/),
      ]),
    )
    expect(checkListing(listing({ short: '  ' }))).toEqual([expect.stringMatching(/short_description\.txt is empty/)])
  })

  it('needs the default language (cs-CZ) with its graphics; other locales may reuse them', () => {
    expect(checkListing(listing({ en: true }))).toEqual([])
    const errors = checkListing(listing({ icon: [500, 500], feature: [1024, 512] }))
    expect(errors).toEqual(expect.arrayContaining([expect.stringMatching(/icon\.png.*512x512/), expect.stringMatching(/featureGraphic\.png.*1024x500/)]))
  })

  it('wants 2–8 phone screenshots between 16:9 and 9:16, sides 320–3840 px', () => {
    expect(checkListing(listing({ shots: 1 }))).toEqual([expect.stringMatching(/2–8 phone screenshots, found 1/)])
    expect(checkListing(listing({ shots: 9 }))).toEqual([expect.stringMatching(/2–8 phone screenshots, found 9/)])
    expect(checkListing(listing({ shot: [1320, 2868] }))).toEqual(expect.arrayContaining([expect.stringMatching(/aspect/)])) // the iPhone 6.9" shot
    expect(checkListing(listing({ shot: [300, 533] }))).toEqual(expect.arrayContaining([expect.stringMatching(/320–3840/)]))
  })

  it('the committed listing passes', () => {
    expect(checkListing('store-assets/android/metadata')).toEqual([])
  })
})

// Google Play store listing — the source of truth fastlane supply uploads:
//   store-assets/android/metadata/<locale>/{title,short_description,full_description}.txt
//   store-assets/android/metadata/<default locale>/images/{icon.png,featureGraphic.png,phoneScreenshots/*.png}
// The default language carries the graphics; other locales carry text only and Play
// shows the default-language graphics for them. Template from flywheel
// docs/standards/release-mobile.md; limits sourced there.
// Graphics are generated, never hand-edited:
//   node scripts/play-graphics.mjs                        → icon + feature graphic
//   npx playwright test e2e/store-shots.spec.ts -g phone --grep-invert iphone → phone screenshots
// Check (also in release-android.yml):  node scripts/play-listing.mjs [root] [--default-locale xx-YY]
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_LOCALE = 'cs-CZ' // the Play listing's default language
// changelogs/<versionCode|default>.txt: 500 characters (supply's release notes).
const TEXT_LIMITS = { 'title.txt': 30, 'short_description.txt': 80, 'full_description.txt': 4000 }
// Play's metadata policy: no price, promotion or ranking claims in the title or short
// description ("free", "best", "#1", "top", "new"…); the full description may say it.
// English, Czech and Slovak; add a language's words when a product lists in it.
const PROMO = /(?:^|[^\p{L}\p{N}#])(zdarma|zadarmo|free|best|nejlepší|najlepší|top|#1|no\.\s?1|sale|sleva|zľava|new|nov[ýáé])(?=$|[^\p{L}\p{N}])/iu

/** Width/height from a PNG's IHDR chunk, or null if it isn't a PNG. */
export function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('ascii', 12, 16) !== 'IHDR') return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/** Play counts characters, not bytes. */
const chars = (s) => [...s].length

/** Every way the listing under `root` would be rejected by Play; [] when it's fine. */
export function checkListing(root, { defaultLocale = DEFAULT_LOCALE } = {}) {
  const DEF = defaultLocale
  const errors = []
  if (!existsSync(join(root, DEF))) return [`${DEF}/ missing (the default language)`]
  for (const locale of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    for (const [file, max] of Object.entries(TEXT_LIMITS)) {
      const path = join(root, locale, file)
      if (!existsSync(path)) {
        errors.push(`${locale}/${file} missing`)
        continue
      }
      const text = readFileSync(path, 'utf8').replace(/\n+$/, '')
      if (!text.trim()) errors.push(`${locale}/${file} is empty`)
      else if (/^TODO\b/.test(text.trim())) errors.push(`${locale}/${file} still says TODO — write it before the first build`)
      else if (chars(text) > max) errors.push(`${locale}/${file} has ${chars(text)} characters, Play allows ${max}`)
      const promo = file !== 'full_description.txt' && PROMO.exec(text)
      if (promo) errors.push(`${locale}/${file} uses "${promo[1]}" — Play rejects price/ranking words in the title and short description`)
    }
  }

  // Release notes ("What's new" on the listing): 500 characters per locale.
  for (const locale of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const dir = join(root, locale, 'changelogs')
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.txt'))) {
      const text = readFileSync(join(dir, f), 'utf8').replace(/\n+$/, '')
      if (/^TODO\b/.test(text.trim())) errors.push(`${locale}/changelogs/${f} still says TODO — write it before the first build`)
      else if (chars(text) > 500) errors.push(`${locale}/changelogs/${f} has ${chars(text)} characters, Play allows 500`)
    }
  }

  const img = join(root, DEF, 'images')
  const sized = (file, w, h) => {
    const path = join(img, file)
    if (!existsSync(path)) return errors.push(`${DEF}/images/${file} missing (${w}x${h} PNG)`)
    const s = pngSize(readFileSync(path))
    if (!s || s.width !== w || s.height !== h) errors.push(`${DEF}/images/${file} must be a ${w}x${h} PNG${s ? `, is ${s.width}x${s.height}` : ''}`)
  }
  sized('icon.png', 512, 512)
  sized('featureGraphic.png', 1024, 500)

  const dir = join(img, 'phoneScreenshots')
  const shots = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : []
  if (shots.length < 2 || shots.length > 8) errors.push(`Play wants 2–8 phone screenshots, found ${shots.length}`)
  for (const f of shots) {
    const s = pngSize(readFileSync(join(dir, f)))
    if (!s) {
      errors.push(`phoneScreenshots/${f} is not a PNG`)
      continue
    }
    const [lo, hi] = [Math.min(s.width, s.height), Math.max(s.width, s.height)]
    if (lo < 320 || hi > 3840) errors.push(`phoneScreenshots/${f} is ${s.width}x${s.height}; each side must be 320–3840 px`)
    if (hi / lo > 16 / 9 + 1e-9) errors.push(`phoneScreenshots/${f} is ${s.width}x${s.height}; the aspect must be between 16:9 and 9:16`)
  }
  return errors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const i = args.indexOf('--default-locale')
  const defaultLocale = i >= 0 ? args.splice(i, 2)[1] : DEFAULT_LOCALE
  const root = args[0] ?? 'store-assets/android/metadata'
  const errors = checkListing(root, { defaultLocale })
  for (const e of errors) console.error(`✗ ${e}`)
  if (errors.length) process.exit(1)
  console.log(`✓ ${root}: Play listing within limits`)
}

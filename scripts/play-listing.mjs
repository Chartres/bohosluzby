// Google Play store listing — the source of truth fastlane supply uploads:
//   store-assets/android/metadata/<locale>/{title,short_description,full_description}.txt
//   store-assets/android/metadata/cs-CZ/images/{icon.png,featureGraphic.png,phoneScreenshots/*.png}
// cs-CZ is the default language and carries the graphics; other locales (en-US)
// carry text only and Play shows the default-language graphics for them.
// Graphics are generated, never hand-edited:
//   node scripts/play-graphics.mjs                        → icon + feature graphic
//   npx playwright test e2e/store-shots.spec.ts -g phone --grep-invert iphone → phone screenshots
// Check (also runs in `npm test`):  node scripts/play-listing.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_LOCALE = 'cs-CZ'
const TEXT_LIMITS = { 'title.txt': 30, 'short_description.txt': 80, 'full_description.txt': 4000 }
// Play's metadata policy: no price, promotion or ranking claims in the title or short
// description ("free", "best", "#1", "top", "new"…); the full description may say it.
const PROMO = /(?:^|[^\p{L}\p{N}#])(zdarma|free|best|nejlepší|top|#1|no\.\s?1|sale|sleva|new|nov[ýáé])(?=$|[^\p{L}\p{N}])/iu

/** Width/height from a PNG's IHDR chunk, or null if it isn't a PNG. */
export function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('ascii', 12, 16) !== 'IHDR') return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/** Play counts characters, not bytes. */
const chars = (s) => [...s].length

/** Every way the listing under `root` would be rejected by Play; [] when it's fine. */
export function checkListing(root) {
  const errors = []
  if (!existsSync(join(root, DEFAULT_LOCALE))) return [`${DEFAULT_LOCALE}/ missing (the default language)`]
  for (const locale of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    for (const [file, max] of Object.entries(TEXT_LIMITS)) {
      const path = join(root, locale, file)
      if (!existsSync(path)) {
        errors.push(`${locale}/${file} missing`)
        continue
      }
      const text = readFileSync(path, 'utf8').replace(/\n+$/, '')
      if (!text.trim()) errors.push(`${locale}/${file} is empty`)
      else if (chars(text) > max) errors.push(`${locale}/${file} has ${chars(text)} characters, Play allows ${max}`)
      const promo = file !== 'full_description.txt' && PROMO.exec(text)
      if (promo) errors.push(`${locale}/${file} uses "${promo[1]}" — Play rejects price/ranking words in the title and short description`)
    }
  }

  const img = join(root, DEFAULT_LOCALE, 'images')
  const sized = (file, w, h) => {
    const path = join(img, file)
    if (!existsSync(path)) return errors.push(`${DEFAULT_LOCALE}/images/${file} missing (${w}x${h} PNG)`)
    const s = pngSize(readFileSync(path))
    if (!s || s.width !== w || s.height !== h) errors.push(`${DEFAULT_LOCALE}/images/${file} must be a ${w}x${h} PNG${s ? `, is ${s.width}x${s.height}` : ''}`)
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
  const root = process.argv[2] ?? 'store-assets/android/metadata'
  const errors = checkListing(root)
  for (const e of errors) console.error(`✗ ${e}`)
  if (errors.length) process.exit(1)
  console.log(`✓ ${root}: Play listing within limits`)
}

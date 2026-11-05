#!/usr/bin/env node
// Check a product's whats-new.json and its HTML animations (docs/standards/whats-new.md):
//   node scripts/check-whats-new.mjs whats-new.json [--public public]
// Products vendor this next to src/platform/whats-new.ts and run it in CI. It holds the two
// promises of the sheet: plain words (one short sentence, no hype) and light animations
// (self-contained CSS, no scripts, nothing fetched, a reduced-motion stop, a few KB).
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MAX_ITEMS = 3
export const MAX_WORDS = 16
export const HTML_BUDGET_KB = 24
export const MEDIA_BUDGET_KB = 400

// Words that sell instead of saying what changed. English, Czech, Slovak (stems where the
// languages inflect). Extend when a product writes in another language.
const HYPE = [
  'seamless', 'seamlessly', 'effortless', 'effortlessly', 'powerful', 'exciting', 'excited', 'thrilled', 'delightful',
  'magic', 'magical', 'revolutionary', 'game-changer', 'supercharge', 'elevate', 'unlock', 'awesome', 'amazing',
  'incredible', 'stunning', 'blazing', 'lightning-fast', 'cutting-edge', 'next-level', 'robust', 'intuitive', 'streamlined',
  'experience', 'enhanced', 'game changer',
]
const HYPE_STEMS = ['úžasn', 'skvěl', 'skvel', 'revoluční', 'revolučn', 'bezproblémov', 'perfektn', 'intuitivn', 'intuitívn', 'zážit', 'dokonal', 'senzačn', 'fantastick']

const EMOJI = /\p{Extended_Pictographic}/u

/** One plain sentence: the reasons it isn't, or []. */
export function checkText(text) {
  const t = String(text ?? '').trim()
  const errors = []
  if (!t) return ['text is empty']
  if (t.includes('!')) errors.push('no exclamation marks: say what changed')
  if (EMOJI.test(t)) errors.push('no emoji')
  if (/[.?…]\s+\p{Lu}/u.test(t)) errors.push('one sentence per item')
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length > MAX_WORDS) errors.push(`${words.length} words; ${MAX_WORDS} at most`)
  const lower = t.toLowerCase()
  for (const w of HYPE) if (new RegExp(`(^|[^\\p{L}])${w.replace('-', '[- ]')}($|[^\\p{L}])`, 'u').test(lower)) errors.push(`"${w}" sells instead of saying what changed`)
  for (const s of HYPE_STEMS) {
    const m = new RegExp(`(?:^|[^\\p{L}])(${s}\\p{L}*)`, 'u').exec(lower)
    if (m) errors.push(`"${m[1]}" sells instead of saying what changed`)
  }
  return errors
}

/** A self-contained CSS animation: the reasons it isn't, or []. */
export function checkHtml(html) {
  const errors = []
  const kb = Buffer.byteLength(html) / 1024
  if (kb > HTML_BUDGET_KB) errors.push(`${kb.toFixed(1)} KB; the budget is ${HTML_BUDGET_KB} KB (CSS shapes, not embedded images)`)
  if (/<script\b/i.test(html)) errors.push('no script: the frame is sandboxed and scripts never run')
  if (/\son[a-z]+\s*=/i.test(html)) errors.push('no inline event handler')
  if (/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i.test(html) || /url\(\s*["']?(?:https?:)?\/\//i.test(html) || /@import/i.test(html))
    errors.push('nothing fetched from outside: inline everything')
  if (/<link\b|<iframe\b|<object\b|<embed\b/i.test(html)) errors.push('self-contained: no <link>, <iframe>, <object> or <embed>')
  if (!/prefers-reduced-motion\s*:\s*reduce/i.test(html)) errors.push('needs @media (prefers-reduced-motion: reduce) that stops the animation')
  if (!/@keyframes|transition/i.test(html)) errors.push('no @keyframes or transition: nothing moves')
  return errors
}

/** Every problem in a release file, each prefixed with its item id. */
export function checkRelease(path, { publicDir = 'public' } = {}) {
  let r
  try {
    r = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    return [`${path}: ${e.message}`]
  }
  const errors = []
  if (!r.version || !/^\d+(\.\d+)*/.test(r.version)) errors.push('version missing (the version the app reports)')
  const items = Array.isArray(r.items) ? r.items : []
  if (items.length > MAX_ITEMS) errors.push(`${items.length} items; ${MAX_ITEMS} at most`)
  const seen = new Set()
  for (const item of items) {
    const id = item.id ?? '?'
    if (seen.has(id)) errors.push(`duplicate id "${id}"`)
    seen.add(id)
    if (!item.alt?.trim()) errors.push(`${id}: alt text missing (what the animation shows)`)
    for (const e of checkText(item.text)) errors.push(`${id}: ${e}`)
    for (const key of ['media', 'still']) {
      const src = item[key]
      if (!src) continue
      if (!/^\/(?!\/)/.test(src)) {
        errors.push(`${id}: ${src} must be a site path (/whats-new/…)`)
        continue
      }
      const file = join(publicDir, src)
      if (!existsSync(file)) {
        errors.push(`${id}: ${src} not found under ${publicDir}`)
        continue
      }
      if (/\.html?$/i.test(src)) for (const e of checkHtml(readFileSync(file, 'utf8'))) errors.push(`${id}: ${src}: ${e}`)
      else if (statSync(file).size / 1024 > MEDIA_BUDGET_KB) errors.push(`${id}: ${src} is over ${MEDIA_BUDGET_KB} KB`)
    }
  }
  return errors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const i = args.indexOf('--public')
  const publicDir = i >= 0 ? args.splice(i, 2)[1] : 'public'
  const path = args[0] ?? 'whats-new.json'
  const errors = checkRelease(path, { publicDir })
  for (const e of errors) console.error(`✗ ${e}`)
  if (errors.length) process.exit(1)
  console.log(`✓ ${path}: plain words, light animations`)
}

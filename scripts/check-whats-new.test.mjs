// scripts/check-whats-new.mjs — the release file and its HTML animations, checked before they ship
// (docs/standards/whats-new.md). Products vendor it next to whats-new.ts and run it in CI.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { HTML_BUDGET_KB, checkHtml, checkRelease, checkText } from './check-whats-new.mjs'

const SCRIPT = fileURLToPath(new URL('./check-whats-new.mjs', import.meta.url))
const GOOD_HTML = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;font:14px system-ui}.b{animation:p 3s infinite}
@keyframes p{50%{transform:scale(.95)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style><div class="b">Kopírovat odkaz</div>`
const has = (errors, re) => assert.ok(errors.some((e) => re.test(e)), `${re} not in ${JSON.stringify(errors)}`)

describe('checkText — one plain sentence', () => {
  it('passes a short factual sentence in any of the fleet languages', () => {
    assert.deepEqual(checkText('Kopírovat odkaz otevře mapu přesně v ten den.'), [])
    assert.deepEqual(checkText('The list shows masses for the next seven days.'), [])
    assert.deepEqual(checkText('Výsledky testu uvidíte aj po zatvorení aplikácie.'), [])
  })

  it('refuses more than one sentence, exclamation marks and emoji', () => {
    has(checkText('Maps load faster. Lists too.'), /one sentence/)
    has(checkText('Maps load faster!'), /exclamation/)
    has(checkText('Maps load faster 🚀.'), /emoji/)
  })

  it('refuses hype words in English, Czech and Slovak', () => {
    has(checkText('A seamless way to find Mass.'), /"seamless"/)
    has(checkText('We are excited to bring dark mode.'), /"excited"/)
    has(checkText('Unlock the power of offline maps.'), /"unlock"/)
    has(checkText('Úžasný nový pohled na mapu.'), /"úžasný"/i)
    has(checkText('Skvelý režim pre tmavé noci.'), /"skvelý"/i)
  })

  it('refuses a long sentence: 16 words at most', () => {
    has(checkText('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen.'), /17 words/)
  })
})

describe('checkHtml — a CSS animation, nothing else', () => {
  it('passes keyframes with a reduced-motion stop', () => {
    assert.deepEqual(checkHtml(GOOD_HTML), [])
  })

  it('refuses scripts, event handlers and anything fetched from elsewhere', () => {
    has(checkHtml(GOOD_HTML + '<script>alert(1)</script>'), /script/)
    has(checkHtml(GOOD_HTML.replace('<div class="b">', '<div class="b" onclick="x()">')), /event handler/)
    has(checkHtml(GOOD_HTML + '<img src="https://example.org/a.png">'), /outside/)
    has(checkHtml(GOOD_HTML.replace('font:14px system-ui', "background:url(//cdn.example.org/x.png)")), /outside/)
    has(checkHtml(GOOD_HTML + '<link rel="stylesheet" href="/app.css">'), /self-contained/)
  })

  it('needs a reduced-motion rule and stays under the budget', () => {
    has(checkHtml(GOOD_HTML.replace(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\}\}/, '')), /prefers-reduced-motion/)
    has(checkHtml(GOOD_HTML + `<!--${'x'.repeat(HTML_BUDGET_KB * 1024)}-->`), new RegExp(`${HTML_BUDGET_KB} KB`))
  })
})

describe('checkRelease', () => {
  function product({ items, html = GOOD_HTML } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'wn-'))
    mkdirSync(join(root, 'public/whats-new/1.6.0'), { recursive: true })
    writeFileSync(join(root, 'public/whats-new/1.6.0/a.html'), html)
    const release = { version: '1.6.0', changelog: '/changelog/', items: items ?? [{ id: 'a', text: 'Kopírovat odkaz otevře mapu přesně v ten den.', alt: 'Mapa se přepne na rok 1985', media: '/whats-new/1.6.0/a.html' }] }
    writeFileSync(join(root, 'whats-new.json'), JSON.stringify(release))
    return root
  }

  it('passes a release with an HTML animation that exists', () => {
    const root = product()
    assert.deepEqual(checkRelease(join(root, 'whats-new.json'), { publicDir: join(root, 'public') }), [])
  })

  it('names the item for every problem: count, ids, alt, text, missing or bad media', () => {
    const root = product({
      html: '<p>no animation rules</p>',
      items: [
        { id: 'a', text: 'Fine.', alt: 'x', media: '/whats-new/1.6.0/a.html' },
        { id: 'a', text: 'A seamless change.', alt: '' },
        { id: 'c', text: 'Fine.', alt: 'c', media: '/whats-new/1.6.0/missing.html' },
        { id: 'd', text: 'Fine.', alt: 'd' },
      ],
    })
    const errors = checkRelease(join(root, 'whats-new.json'), { publicDir: join(root, 'public') })
    has(errors, /4 items/)
    has(errors, /duplicate id "a"/)
    has(errors, /a: alt/)
    has(errors, /a: .*"seamless"/)
    has(errors, /c: .*missing\.html.*not found/)
    has(errors, /a: .*a\.html.*prefers-reduced-motion/)
  })

  it('needs a version', () => {
    const root = product()
    writeFileSync(join(root, 'whats-new.json'), JSON.stringify({ items: [] }))
    has(checkRelease(join(root, 'whats-new.json'), { publicDir: join(root, 'public') }), /version/)
  })

  it('CLI: exit 0 when clean, 1 with reasons', () => {
    const root = product()
    const ok = spawnSync(process.execPath, [SCRIPT, join(root, 'whats-new.json'), '--public', join(root, 'public')], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stderr)
    writeFileSync(join(root, 'public/whats-new/1.6.0/a.html'), '<script></script>')
    const bad = spawnSync(process.execPath, [SCRIPT, join(root, 'whats-new.json'), '--public', join(root, 'public')], { encoding: 'utf8' })
    assert.equal(bad.status, 1)
    assert.match(bad.stderr, /script/)
  })
})

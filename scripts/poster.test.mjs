// The church notice-board poster (Pavol, 24 Nov 2026): one QR to /app/, signature look.
//   node --test --experimental-strip-types scripts/poster.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { posterHtml, QR_MM } from './poster.mjs'

const html = await posterHtml({ fonts: '' })

test('one QR code, for /app/ (iPhone → App Store, the rest → web)', () => {
  assert.equal((html.match(/<svg[^>]*class="qr"/g) ?? []).length, 1)
  assert.match(html, /data-url="https:\/\/bohosluzby\.dravec\.org\/app\/"/)
})

test('the QR prints at least 45 mm wide', () => {
  assert.ok(QR_MM >= 45)
  assert.match(html, new RegExp(`\\.qr \\{[^}]*width: ${QR_MM}mm`))
})

test('the words Pavol asked for, in Czech, plain', () => {
  for (const s of ['Kam na mši', 'Mše svatá poblíž, právě teď', 'Naskenujte telefonem', 'bohosluzby.dravec.org', 'Data z rejstříku bohoslužeb ČBK a z ohlášek farností'])
    assert.ok(html.includes(s), s)
  assert.doesNotMatch(html.replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>|<!doctype html>/gi, ''), /!/)
})

test('A4 portrait, the glass band and the ribbon', () => {
  assert.match(html, /@page \{ size: A4 portrait; margin: 0 \}/)
  assert.match(html, /<canvas id="glass"/)
  assert.match(html, /class="ribbon"/)
})

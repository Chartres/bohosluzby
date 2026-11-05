// scripts/android-keystore.sh — the owner runs it once at the Mac mini.
// Run: node --test scripts/*.test.mjs It must
// set the GitHub secrets without ever showing a secret value on screen (Pavol,
// 2026-11-04: "as hands-free as possible"; values never pass through a terminal
// he might screen-share). Run here with stub keytool/gh/security on PATH.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('./android-keystore.sh', import.meta.url))

function sandbox({ gh = true, security = false, ghFails = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ks-'))
  const bin = join(root, 'bin')
  const log = join(root, 'gh-secrets')
  mkdirSync(bin)
  mkdirSync(log)
  const stub = (name, body) => {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`)
    chmodSync(join(bin, name), 0o755)
  }
  // keytool: -genkeypair writes a fake keystore; -list prints a fingerprint
  stub('keytool', `case "$*" in *-genkeypair*) for a in "$@"; do [ -n "$prev" ] && [ "$prev" = "-keystore" ] && echo fake-jks > "$a"; prev="$a"; done;; *-list*) echo "SHA256: AA:BB:CC";; esac`)
  if (gh) stub('gh', `if [ "$1 $2" = "secret set" ]; then ${ghFails ? 'exit 1' : `cat > "${log}/$3"`}; elif [ "$1 $2" = "auth status" ]; then exit 0; fi`)
  if (security) stub('security', `cat > /dev/null; for a in "$@"; do [ "$prev" = "-w" ] && echo -n "$a" > "${root}/keychain"; prev="$a"; done`)
  return { root, bin, log, out: join(root, 'cfg') }
}

function run(sb, args = []) {
  const PATH = `${sb.bin}:/usr/bin:/bin`
  return spawnSync('bash', [SCRIPT, ...args], { env: { PATH, HOME: sb.root, OUT_DIR: sb.out, REPO: 'o/r', SERVICE: 'test android upload key' }, encoding: 'utf8' })
}

describe('android-keystore.sh', () => {
  it('is valid bash', () => {
    execFileSync('bash', ['-n', SCRIPT])
  })

  it('sets the four signing secrets through gh and never prints a secret value', () => {
    const sb = sandbox()
    const r = run(sb)
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.deepEqual(readdirSync(sb.log).sort(), ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'])
    const pass = readFileSync(join(sb.log, 'ANDROID_KEYSTORE_PASSWORD'), 'utf8')
    const b64 = readFileSync(join(sb.log, 'ANDROID_KEYSTORE_BASE64'), 'utf8')
    assert.ok(pass.length >= 24)
    const shown = r.stdout + r.stderr
    assert.ok(!shown.includes(pass))
    assert.ok(!shown.includes(b64))
    assert.ok(shown.includes('SHA256: AA:BB:CC')) // the public certificate fingerprint is fine to show
  })

  it('keeps the password for the owner without showing it: macOS Keychain, else a 600 file', () => {
    const withKeychain = sandbox({ security: true })
    assert.equal(run(withKeychain).status, 0)
    assert.equal(readFileSync(join(withKeychain.root, 'keychain'), 'utf8'), readFileSync(join(withKeychain.log, 'ANDROID_KEYSTORE_PASSWORD'), 'utf8'))

    const plain = sandbox()
    assert.equal(run(plain).status, 0)
    const file = join(plain.out, 'android-upload.pass')
    assert.ok(existsSync(file))
    assert.equal(statSync(file).mode & 0o777, 0o600)
  })

  it('keeps the password before touching GitHub, so a failed gh call never strands the keystore', () => {
    const sb = sandbox({ ghFails: true })
    const r = run(sb)
    assert.notEqual(r.status, 0)
    assert.ok(existsSync(join(sb.out, 'android-upload.pass')))
  })

  it('never puts the password on a command line keytool runs with', () => {
    assert.doesNotMatch(readFileSync(SCRIPT, 'utf8'), /-storepass\s+"\$/)
  })

  it('refuses to overwrite an existing keystore', () => {
    const sb = sandbox()
    assert.equal(run(sb).status, 0)
    const again = run(sb)
    assert.notEqual(again.status, 0)
    assert.match(again.stdout + again.stderr, /already exists/)
  })

  it('without gh it stops and says what to install — it does not print the values instead', () => {
    const sb = sandbox({ gh: false })
    const r = run(sb)
    assert.notEqual(r.status, 0)
    assert.match(r.stdout + r.stderr, /gh/)
    assert.ok(!existsSync(join(sb.out, 'android-upload.jks')))
  })

  it('an unstamped copy (placeholders left) stops before creating anything', () => {
    const sb = sandbox()
    // in a stamped product the script has real values: put a placeholder back in a copy
    const copy = join(sb.root, 'unstamped.sh')
    // the token is built at runtime: the stamp would fill a literal one in this file too
    const token = `${'__'}SLUG__`
    writeFileSync(copy, readFileSync(SCRIPT, 'utf8').replace(/^SERVICE=".*"$/m, `SERVICE="\${SERVICE:-${token} android upload key}"`))
    const r = spawnSync('bash', [copy], { env: { PATH: `${sb.bin}:/usr/bin:/bin`, HOME: sb.root, OUT_DIR: sb.out, REPO: 'o/r' }, encoding: 'utf8' })
    assert.notEqual(r.status, 0)
    assert.match(r.stdout + r.stderr, /never stamped/)
    assert.deepEqual(readdirSync(sb.log), [])
  })

  it('--play-json FILE stores the Play service account key as a secret without printing it', () => {
    const sb = sandbox()
    const key = join(sb.root, 'key.json')
    writeFileSync(key, '{"type":"service_account","private_key":"-----SECRET-----"}')
    const r = run(sb, ['--play-json', key])
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.ok(readFileSync(join(sb.log, 'PLAY_SERVICE_ACCOUNT_JSON'), 'utf8').includes('SECRET'))
    assert.ok(!(r.stdout + r.stderr).includes('SECRET'))
    assert.ok(!existsSync(join(sb.out, 'android-upload.jks'))) // only the JSON, no new keystore
  })
})

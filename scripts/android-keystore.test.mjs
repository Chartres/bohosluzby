// scripts/android-keystore.sh — the owner runs it once at the Mac mini. It must
// set the GitHub secrets without ever showing a secret value on screen (Pavol,
// 2026-11-04: "as hands-free as possible"; values never pass through a terminal
// he might screen-share). Run here with stub keytool/gh/security on PATH.
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(process.cwd(), 'scripts/android-keystore.sh')

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
  return spawnSync('bash', [SCRIPT, ...args], { env: { PATH, HOME: sb.root, OUT_DIR: sb.out, REPO: 'o/r' }, encoding: 'utf8' })
}

describe('android-keystore.sh', () => {
  it('is valid bash', () => {
    execFileSync('bash', ['-n', SCRIPT])
  })

  it('sets the four signing secrets through gh and never prints a secret value', () => {
    const sb = sandbox()
    const r = run(sb)
    expect(r.status).toBe(0)
    expect(readdirSync(sb.log).sort()).toEqual(['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'])
    const pass = readFileSync(join(sb.log, 'ANDROID_KEYSTORE_PASSWORD'), 'utf8')
    const b64 = readFileSync(join(sb.log, 'ANDROID_KEYSTORE_BASE64'), 'utf8')
    expect(pass.length).toBeGreaterThanOrEqual(24)
    const shown = r.stdout + r.stderr
    expect(shown).not.toContain(pass)
    expect(shown).not.toContain(b64)
    expect(shown).toContain('SHA256: AA:BB:CC') // the public certificate fingerprint is fine to show
  })

  it('keeps the password for the owner without showing it: macOS Keychain, else a 600 file', () => {
    const withKeychain = sandbox({ security: true })
    expect(run(withKeychain).status).toBe(0)
    expect(readFileSync(join(withKeychain.root, 'keychain'), 'utf8')).toBe(readFileSync(join(withKeychain.log, 'ANDROID_KEYSTORE_PASSWORD'), 'utf8'))

    const plain = sandbox()
    expect(run(plain).status).toBe(0)
    const file = join(plain.out, 'android-upload.pass')
    expect(existsSync(file)).toBe(true)
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  it('keeps the password before touching GitHub, so a failed gh call never strands the keystore', () => {
    const sb = sandbox({ ghFails: true })
    const r = run(sb)
    expect(r.status).not.toBe(0)
    expect(existsSync(join(sb.out, 'android-upload.pass'))).toBe(true)
  })

  it('never puts the password on a command line keytool runs with', () => {
    expect(readFileSync(SCRIPT, 'utf8')).not.toMatch(/-storepass\s+"\$/)
  })

  it('refuses to overwrite an existing keystore', () => {
    const sb = sandbox()
    expect(run(sb).status).toBe(0)
    const again = run(sb)
    expect(again.status).not.toBe(0)
    expect(again.stdout + again.stderr).toMatch(/already exists/)
  })

  it('without gh it stops and says what to install — it does not print the values instead', () => {
    const sb = sandbox({ gh: false })
    const r = run(sb)
    expect(r.status).not.toBe(0)
    expect(r.stdout + r.stderr).toMatch(/gh/)
    expect(existsSync(join(sb.out, 'android-upload.jks'))).toBe(false)
  })

  it('--play-json FILE stores the Play service account key as a secret without printing it', () => {
    const sb = sandbox()
    const key = join(sb.root, 'key.json')
    writeFileSync(key, '{"type":"service_account","private_key":"-----SECRET-----"}')
    const r = run(sb, ['--play-json', key])
    expect(r.status).toBe(0)
    expect(readFileSync(join(sb.log, 'PLAY_SERVICE_ACCOUNT_JSON'), 'utf8')).toContain('SECRET')
    expect(r.stdout + r.stderr).not.toContain('SECRET')
    expect(existsSync(join(sb.out, 'android-upload.jks'))).toBe(false) // only the JSON, no new keystore
  })
})

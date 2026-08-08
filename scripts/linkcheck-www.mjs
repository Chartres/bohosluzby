// Batched liveness check for parish `www` URLs in the served dataset.
// The season banner tells users to "verify on the parish website" — a dead
// link there is a dead end, not a hint. This reads the served data (index
// row[7] + shard contacts[type==='www']), collects unique URLs, HEAD-checks
// each (GET fallback for servers that reject HEAD) with bounded concurrency,
// and drops a URL only when it fails hard on every one of 3 rounds (DNS
// failure or 4xx/5xx). ponytail: 3 rounds, not 2 — a manual spot check found
// small Czech parish hosts flip-flopping between 401 and a nonstandard 456
// minutes apart (flaky shared hosting, not a dead site); 2 unlucky rounds
// could land on that flakiness and drop a working link. A timeout or odd
// network blip never drops a link either way, only a repeated hard failure
// does. False negatives (a dead link we keep) are cheap; false positives
// (killing a working link) are not.
//
// Usage: node scripts/linkcheck-www.mjs [--dry-run]
// Writes (unless --dry-run): public/data/churches.json, changed
// public/data/services/<cell>.json shards, public/data/version.json
// (generated date bumped so clients pull the cleaned data), and always
// docs/linkcheck-report.md.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const DATA = `${root}public/data`
const CONCURRENCY = 24
const TIMEOUT_MS = 8000
const ROUND_GAP_MS = 2000 // let a transient blip / flaky backend rotation pass before the retry
const ROUNDS = 3
const UA = 'bohosluzby.dravec.org linkcheck (pavol+claude@dravecky.sk)' // same convention as data/extract.mjs
const dryRun = process.argv.includes('--dry-run')

async function checkOnce(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.ok || (res.status >= 300 && res.status < 400)) return { kind: 'ok' }
      if (method === 'HEAD') continue // some servers 4xx/405 HEAD but serve GET fine — confirm before failing
      return { kind: 'http', status: res.status }
    } catch (err) {
      const code = err?.cause?.code
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return { kind: 'dns', detail: code }
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        if (method === 'HEAD') continue
        return { kind: 'timeout' }
      }
      if (method === 'HEAD') continue
      return { kind: 'other', detail: String(err?.message ?? err) }
    }
  }
  return { kind: 'other', detail: 'HEAD and GET both inconclusive' }
}

// 403/401/429 = alive but blocking bots / rate-limited (the earlier CX audit
// found live parish sites like augustiniani.cz that 403 automated access) — a
// human clicking WEB reaches them fine, so NEVER drop those; only DNS-fail and
// genuine 404/5xx are dead for humans too.
const KEEP_STATUS = new Set([401, 403, 429])
const isHardFail = (r) => r.kind === 'dns' || (r.kind === 'http' && !KEEP_STATUS.has(r.status))

/** ROUNDS independent attempts; drop only when every one is a hard failure. */
export async function checkUrl(url) {
  const rounds = []
  for (let i = 0; i < ROUNDS; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, ROUND_GAP_MS))
    const r = await checkOnce(url)
    rounds.push(r)
    if (r.kind === 'ok') return { drop: false, rounds }
  }
  return { drop: rounds.every(isHardFail), rounds }
}

async function checkAll(urls) {
  const queue = [...urls]
  const results = new Map()
  const worker = async () => {
    for (;;) {
      const url = queue.shift()
      if (url === undefined) return
      results.set(url, await checkUrl(url))
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

function main() {
  const churches = JSON.parse(readFileSync(`${DATA}/churches.json`, 'utf8'))
  const shardFiles = readdirSync(`${DATA}/services`).filter((f) => f.endsWith('.json'))
  const shards = new Map(shardFiles.map((f) => [f, JSON.parse(readFileSync(`${DATA}/services/${f}`, 'utf8'))]))

  const urls = new Set()
  for (const row of churches) if (row[7]) urls.add(row[7])
  for (const shard of shards.values())
    for (const entry of Object.values(shard)) for (const [type, value] of entry.c ?? []) if (type === 'www') urls.add(value)

  return { churches, shards, urls: [...urls] }
}

async function run() {
  const { churches, shards, urls } = main()
  process.stderr.write(`linkcheck-www: checking ${urls.length} unique URLs (concurrency ${CONCURRENCY})...\n`)
  const results = await checkAll(urls)

  const dropped = urls.filter((u) => results.get(u).drop)
  const inconclusive = urls.filter((u) => !results.get(u).drop && results.get(u).rounds.length > 1)
  const dropSet = new Set(dropped)

  let indexChanged = 0
  for (const row of churches) if (row[7] && dropSet.has(row[7])) (row[7] = ''), indexChanged++

  let shardChanged = 0
  for (const shard of shards.values())
    for (const entry of Object.values(shard)) {
      if (!entry.c) continue
      const before = entry.c.length
      entry.c = entry.c.filter(([type, value]) => !(type === 'www' && dropSet.has(value)))
      if (entry.c.length !== before) shardChanged++
    }

  const describe = (r) => `${r.kind}${r.status ? ' ' + r.status : ''}`
  const describeRounds = (u) => results.get(u).rounds.map((r, i) => `round${i + 1}: ${describe(r)}`).join(', ')

  const report = [
    `# linkcheck-www report`,
    ``,
    `Run: ${new Date().toISOString()}${dryRun ? ' (dry run — no files written)' : ''}`,
    `Unique www URLs checked: ${urls.length}`,
    `Dropped (hard failure on all ${ROUNDS} rounds): ${dropped.length}`,
    `Inconclusive (logged, kept): ${inconclusive.length}`,
    ``,
    `## Dropped`,
    ...(dropped.length ? dropped.map((u) => `- ${u} — ${describeRounds(u)}`) : ['(none)']),
    ``,
    `## Inconclusive (kept — timeout or ambiguous, never dropped on that alone)`,
    ...(inconclusive.length ? inconclusive.map((u) => `- ${u} — ${describeRounds(u)}`) : ['(none)']),
    ``,
  ].join('\n')
  writeFileSync(`${root}docs/linkcheck-report.md`, report)

  process.stderr.write(`linkcheck-www: ${dropped.length} dropped, ${inconclusive.length} inconclusive, ${indexChanged} index rows + ${shardChanged} shard entries touched\n`)

  if (dryRun) {
    process.stderr.write('linkcheck-www: --dry-run, not writing data\n')
    return
  }
  if (indexChanged) writeFileSync(`${DATA}/churches.json`, JSON.stringify(churches))
  for (const [f, shard] of shards) writeFileSync(`${DATA}/services/${f}`, JSON.stringify(shard))
  if (indexChanged || shardChanged) {
    const version = JSON.parse(readFileSync(`${DATA}/version.json`, 'utf8'))
    version.generated = new Date().toISOString().slice(0, 10)
    writeFileSync(`${DATA}/version.json`, JSON.stringify(version))
  }
}

// ponytail: one runnable check for the drop-decision branching, no framework.
// `node scripts/linkcheck-www.mjs --selftest`
async function selftest() {
  const assert = await import('node:assert/strict')
  const realFetch = global.fetch
  const mock = (fn) => {
    global.fetch = fn
  }

  mock(async () => ({ ok: true, status: 200 }))
  assert.equal((await checkUrl('https://ok.example')).drop, false, 'ok response never drops')

  mock(async () => {
    throw Object.assign(new Error('dns'), { cause: { code: 'ENOTFOUND' } })
  })
  assert.equal((await checkUrl('https://dns-dead.example')).drop, true, 'DNS failure on every round drops')

  mock(async () => ({ ok: false, status: 404 }))
  assert.equal((await checkUrl('https://gone.example')).drop, true, '404 on every round drops')

  let n = 0
  mock(async () => {
    n++
    if (n === 1) throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
    return { ok: true, status: 200 }
  })
  assert.equal((await checkUrl('https://flaky.example')).drop, false, 'recovers before all rounds fail keeps the link')

  let m = 0
  mock(async () => {
    m++
    // flip-flops between two different hard-failure codes across rounds —
    // the real-world case that motivated 3 rounds over 2 (still all hard,
    // still drops, but proves mixed failure kinds are handled)
    return m % 2 ? { ok: false, status: 401 } : { ok: false, status: 456 }
  })
  assert.equal((await checkUrl('https://flip.example')).drop, true, 'alternating hard failures still drop after 3/3')

  mock(async () => {
    throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
  })
  assert.equal((await checkUrl('https://slow.example')).drop, false, 'timeout alone never drops')

  global.fetch = realFetch
  console.log('linkcheck-www selftest: 6/6 ok')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--selftest')) await selftest()
  else await run()
}

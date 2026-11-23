// The native apps pull new data only when version.json's timestamp moves (src/lib/dataStore.ts).
// It moved only on a registry refresh, so corrections and photos merged after 29 Oct 2026 never
// reached the apps (found 23 Nov, roráty pass). The build stamps it with the last data commit.
// Run: node --test scripts/*.test.mjs
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { stampVersion } from './data-version.mjs'

const committed = { generated: '2026-10-27', timestamp: '2026-10-29T02:42:40.864Z', churches: 3992 }

describe('stampVersion', () => {
  it('a later data commit moves the timestamp (UTC ISO), and only the timestamp', () => {
    const v = stampVersion(committed, '2026-11-22T09:57:33+01:00')
    assert.deepEqual(v, { generated: '2026-10-27', timestamp: '2026-11-22T08:57:33.000Z', churches: 3992 })
  })

  it('never moves it back, and keeps it when git gives nothing (shallow clone, no git)', () => {
    assert.deepEqual(stampVersion(committed, '2026-10-01T00:00:00Z'), committed)
    assert.deepEqual(stampVersion(committed, ''), committed)
    assert.deepEqual(stampVersion(committed, 'not a date'), committed)
  })

  it('works on a version.json without a timestamp (older snapshots)', () => {
    assert.equal(stampVersion({ generated: '2026-07-03', churches: 1 }, '2026-07-04T00:00:00Z').timestamp, '2026-07-04T00:00:00.000Z')
  })
})

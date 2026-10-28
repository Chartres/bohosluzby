// Signals contract test — vendor as src/platform/flywheel-events.contract.test.ts
// together with src/platform/flywheel-events.json (a copy of the flywheel repo's
// data/signals/allowlist.json). Source: flywheel docs/standards/signals/.
//
// Fails this app's CI when its source sends an event name the shared insert
// policy does not accept. Such an event is lost: the insert fails RLS and
// flywheel-client swallows the error, so nothing else would tell you
// (autoskola start_topic, zbrojni start_weak_drill, council council_*, Oct 2026).
//
// A new name: add it to flywheel's data/signals/allowlist.json in a flywheel PR
// first (the platform applies the policy migration), then refresh the vendored
// copy here. Prefer the shared taxonomy + props over a new name:
// track('key_action', { action: 'drill' }) needs no policy change.
import { describe, expect, it } from 'vitest'
import allow from './flywheel-events.json'

const sources = import.meta.glob(['/src/**/*.{ts,tsx,js,jsx}', '!/src/**/*.test.*', '!/src/**/*.spec.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Same rules as flywheel scripts/signals.mjs extractEventNames().
const TRACK_LITERAL = /(?:^|[^\w])track\(\s*(['"`])([a-z][a-z0-9_]*)\1/g
const TRACK_IDENT = /(?:^|[^\w])track\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g
const IMPLIED: [RegExp, string][] = [
  [/(?:^|[^\w])conversion\(\s*[{)]/, 'conversion'],
  [/(?:^|[^\w])logError\(\s*[\w.]+\s*[,)]/, 'error'],
  [/(?:^|[^\w])feedback\(\s*\{/, 'feedback_given'],
]

export function extractEventNames(text: string): Set<string> {
  const names = new Set<string>()
  for (const m of text.matchAll(TRACK_LITERAL)) names.add(m[2])
  for (const m of text.matchAll(TRACK_IDENT)) {
    const decl = text.match(new RegExp(`(?:const|let)\\s+${m[1]}\\s*=\\s*([^\\n;]+)`))
    if (!decl) continue
    for (const lit of decl[1].matchAll(/(?:^|[?:])\s*(['"`])([a-z][a-z0-9_]*)\1/g)) names.add(lit[2])
  }
  for (const [re, name] of IMPLIED) if (re.test(text)) names.add(name)
  return names
}

describe('signals contract', () => {
  const allowed = new Set<string>((allow as { events: string[] }).events)

  it('every event name the app sends is on the shared allow-list', () => {
    const rejected: string[] = []
    for (const [file, text] of Object.entries(sources)) {
      for (const n of extractEventNames(text)) if (!allowed.has(n)) rejected.push(`${n} (${file})`)
    }
    expect(rejected, 'add these to flywheel data/signals/allowlist.json first, or send key_action + props').toEqual([])
  })

  it('the extractor still sees calls (guards against a silent regex break)', () => {
    expect([...extractEventNames("track('page_view')\nconst n = a ? 'x_done' : 'y_done'\ntrack(n)")].sort()).toEqual([
      'page_view',
      'x_done',
      'y_done',
    ])
  })
})

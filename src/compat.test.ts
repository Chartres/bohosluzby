// The iOS app's deployment target is iOS 15.0 (ios/App), and WebKit before
// 16.4 has no regex lookbehind. A lookbehind LITERAL is a parse error for the
// whole bundle: the app renders blank and logs nothing, because analytics ships
// in the same bundle. (notes.ts carried one from 2026-07-09 to 2026-10-07.)
const sources = import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

it('no regex lookbehind in app code (iOS 15 WebKit cannot parse it)', () => {
  expect(Object.keys(sources).length).toBeGreaterThan(20) // the glob really saw the app
  const offenders = Object.entries(sources)
    .filter(([, code]) => /\(\?<[=!]/.test(code))
    .map(([file]) => file)
  expect(offenders).toEqual([])
})

it('no bare Safari 15.4+ APIs in app code (regress silently on iOS 15.0–15.3)', () => {
  // Each pattern is an API absent in Safari ≤15.3 that throws or returns wrong results
  // without a polyfill. crypto.randomUUID must use ?. (optional chain) — bare call throws.
  const checks: Array<[string, RegExp, ((f: string) => boolean)?]> = [
    ['Object.hasOwn(', /Object\.hasOwn\(/],
    // flywheel-client.ts IS the polyfill (uses bare call inside a typeof guard) — excluded
    ['crypto.randomUUID() bare call', /crypto\.randomUUID\(\)/, (f) => !f.includes('flywheel-client')],
    ['.structuredClone(', /\bstructuredClone\(/],
    ['.at(-', /\.at\(-/],
    ['.findLast(', /\.findLast\(/],
    ['.toSorted(', /\.toSorted\(/],
  ]
  for (const [label, pattern, include] of checks) {
    const offenders = Object.entries(sources)
      .filter(([file, code]) => pattern.test(code) && (include ? include(file) : true))
      .map(([file]) => file)
    expect(offenders, label).toEqual([])
  }
})

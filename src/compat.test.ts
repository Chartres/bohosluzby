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

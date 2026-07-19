import { lang, t, langLabel, cs, en } from './i18n'

const setNavLang = (value: string) =>
  Object.defineProperty(window.navigator, 'language', { value, configurable: true })

afterEach(() => {
  setNavLang('cs-CZ') // vitest.setup.ts default — keep other test files unaffected
})

describe('lang() — device language maps to cs or en', () => {
  it('cs-CZ → cs', () => {
    setNavLang('cs-CZ')
    expect(lang()).toBe('cs')
  })
  it('sk-SK → cs (Slovak reads Czech UI)', () => {
    setNavLang('sk-SK')
    expect(lang()).toBe('cs')
  })
  it('en-US → en', () => {
    setNavLang('en-US')
    expect(lang()).toBe('en')
  })
  it('de-DE → en (anything else falls back to English)', () => {
    setNavLang('de-DE')
    expect(lang()).toBe('en')
  })
})

describe('t() — reads the current language per call', () => {
  it('returns Czech by default', () => {
    setNavLang('cs-CZ')
    expect(t('day_now')).toBe('hned')
  })
  it('returns English once the device language changes', () => {
    setNavLang('en-US')
    expect(t('day_now')).toBe('now')
  })
})

describe('langLabel() — display name for a normalized Czech language adverb', () => {
  it('cs: identity — the adverb is already the Czech UI', () => {
    setNavLang('cs-CZ')
    expect(langLabel('latinsky')).toBe('latinsky')
  })
  it('en: maps known adverbs to English names', () => {
    setNavLang('en-US')
    expect(langLabel('latinsky')).toBe('Latin')
  })
  it('en: falls back to the raw adverb for anything unmapped', () => {
    setNavLang('en-US')
    expect(langLabel('esperantsky')).toBe('esperantsky')
  })
})

describe('every English key mirrors a Czech key', () => {
  it('cs and en dictionaries cover the exact same key set', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(cs).sort())
  })
  it('no value is left empty in either language', () => {
    for (const v of Object.values(cs)) expect(v.length).toBeGreaterThan(0)
    for (const v of Object.values(en)) expect(v.length).toBeGreaterThan(0)
  })
})

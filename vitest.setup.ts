import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom does not expose a global localStorage on an opaque origin. Provide a
// deterministic in-memory implementation so storage-backed code is testable.
if (typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>()
    get length() {
      return this.store.size
    }
    clear() {
      this.store.clear()
    }
    getItem(key: string) {
      return this.store.has(key) ? this.store.get(key)! : null
    }
    key(index: number) {
      return Array.from(this.store.keys())[index] ?? null
    }
    removeItem(key: string) {
      this.store.delete(key)
    }
    setItem(key: string, value: string) {
      this.store.set(key, String(value))
    }
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  })
}

// jsdom logs "Not implemented" for scrollTo; the router calls it on navigation.
window.scrollTo = () => {}

// jsdom defaults navigator.language to en-US; the existing 212 tests assert
// Czech UI strings. Pin it to cs-CZ so lang() resolves to 'cs' by default —
// tests that want English redefine navigator.language for that test only.
Object.defineProperty(window.navigator, 'language', { value: 'cs-CZ', configurable: true })

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

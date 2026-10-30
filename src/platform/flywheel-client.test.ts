import { describe, expect, it } from 'vitest'
import { resolveIds } from './flywheel-client'

describe('resolveIds — randomUUID fallback', () => {
  it('returns UUID-shaped strings when crypto.randomUUID is unavailable', () => {
    // Simulate iOS 15.0–15.3 where crypto.randomUUID is absent
    const original = crypto.randomUUID
    // @ts-expect-error intentional deletion for test
    delete crypto.randomUUID
    try {
      // Use fresh in-memory storage so readId always generates a new UUID
      const store = new Map<string, string>()
      const mockStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
        removeItem: (k: string) => { store.delete(k) },
        clear: () => { store.clear() },
        key: (_i: number) => null,
        get length() { return store.size },
      } as Storage
      const { visitor_id, session_id } = resolveIds(mockStorage)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(visitor_id).toMatch(uuidRe)
      expect(session_id).toMatch(uuidRe)
    } finally {
      crypto.randomUUID = original
    }
  })
})

// Moje kostely: starred churches, on this device only (no account, no sync —
// the same privacy posture as the rest of the app). No nudges: a list, not a push.
import { getFavorites, isFavorite, subscribeFavorites, toggleFavorite, FAVORITES_MAX } from './favorites'

beforeEach(() => localStorage.clear())

it('toggles a church in and out, persisted on the device', () => {
  expect(getFavorites()).toEqual([])
  expect(toggleFavorite('10001')).toBe(true)
  expect(isFavorite('10001')).toBe(true)
  expect(JSON.parse(localStorage.getItem('bohosluzby:favorites')!)).toEqual(['10001'])
  expect(toggleFavorite('10001')).toBe(false)
  expect(getFavorites()).toEqual([])
})

it('notifies subscribers (the list and the star stay in step)', () => {
  const seen = vi.fn()
  const off = subscribeFavorites(seen)
  toggleFavorite('1')
  off()
  toggleFavorite('2')
  expect(seen).toHaveBeenCalledTimes(1)
})

it('keeps the newest first and caps the list', () => {
  for (let i = 0; i < FAVORITES_MAX + 3; i++) toggleFavorite(String(i))
  const favs = getFavorites()
  expect(favs).toHaveLength(FAVORITES_MAX)
  expect(favs[0]).toBe(String(FAVORITES_MAX + 2))
})

it('survives junk in storage', () => {
  localStorage.setItem('bohosluzby:favorites', '{not json')
  expect(getFavorites()).toEqual([])
  localStorage.setItem('bohosluzby:favorites', JSON.stringify([1, 'a', null]))
  expect(getFavorites()).toEqual(['a'])
})

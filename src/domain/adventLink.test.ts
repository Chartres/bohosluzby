// Option A of the in-app roráty link (Pavol's decision page, 25 Nov 2026; screenshots in
// docs/review/shots/2026-11-22-roraty-link-*): one line under the day row in Advent that
// opens the roráty page (/advent/<town>/) of the nearest town that has one.
import { adventLink } from './adventLink'
import type { City } from './cities'

const city = (name: string, slug: string, count: number, lat: number, lng: number): City => ({ name, slug, count, lat, lng, churches: [] })
const CITIES = [
  city('Praha', 'praha', 115, 50.08, 14.43),
  city('Brno', 'brno', 41, 49.19, 16.61),
  city('Malá Ves', 'mala-ves', 1, 50.1, 14.44), // too few churches: no season page
]
const PRAGUE = { lat: 50.0875, lng: 14.4213 }
const at = (iso: string) => new Date(`${iso}T09:00:00Z`)

describe('adventLink', () => {
  it('from a week before the 1st Sunday of Advent to Christmas Eve', () => {
    // Advent 2026 starts Sun 29 Nov
    expect(adventLink(at('2026-11-21'), PRAGUE, CITIES)).toBeNull()
    expect(adventLink(at('2026-11-22'), PRAGUE, CITIES)).not.toBeNull()
    expect(adventLink(at('2026-12-24'), PRAGUE, CITIES)).not.toBeNull()
    expect(adventLink(at('2026-12-25'), PRAGUE, CITIES)).toBeNull()
    expect(adventLink(at('2026-07-01'), PRAGUE, CITIES)).toBeNull()
  })

  it('opens the nearest town that has a roráty page (3+ churches)', () => {
    expect(adventLink(at('2026-11-30'), PRAGUE, CITIES)).toEqual({ href: 'https://bohosluzby.dravec.org/advent/praha/', town: 'Praha' })
    expect(adventLink(at('2026-11-30'), { lat: 49.2, lng: 16.6 }, CITIES)?.href).toBe('https://bohosluzby.dravec.org/advent/brno/')
  })

  it('without a position it opens the list of towns', () => {
    expect(adventLink(at('2026-11-30'), null, CITIES)).toEqual({ href: 'https://bohosluzby.dravec.org/advent/', town: '' })
  })
})

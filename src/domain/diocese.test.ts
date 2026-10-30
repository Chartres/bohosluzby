// The /dusicky/ hub groups towns by diocese, read from the registry id prefix.
import { DIOCESES, dioceseKey, dioceseOfTown } from './diocese'
import churches from '../../public/data/churches.json'

describe('dioceseKey', () => {
  it.each([
    ['10001', '1'], // katedrála sv. Víta
    ['20001', '2'],
    ['3001000001', '3'],
    ['8000001234567', '8'],
  ])('%s → %s', (id, key) => expect(dioceseKey(id)).toBe(key))

  it('gives nothing for an id outside the scheme', () => {
    expect(dioceseKey('9123')).toBe('')
    expect(dioceseKey('')).toBe('')
  })

  it('places the cathedral towns in their own diocese (real registry ids)', () => {
    const rows = churches as unknown as [string, string, string][]
    const town = (name: string) => dioceseOfTown(rows.filter((r) => r[2].endsWith(name)).map((r) => r[0]))
    expect(town('Praha 1')).toBe('1')
    expect(town('Litoměřice')).toBe('2')
    expect(town('Hradec Králové')).toBe('3')
    expect(town('České Budějovice')).toBe('4')
    expect(town('Ostrava')).toBe('5')
    expect(town('Plzeň')).toBe('6')
    expect(town('Olomouc')).toBe('7')
    expect(town('Brno')).toBe('8')
  })

  it('names all eight Czech dioceses once', () => {
    expect(DIOCESES).toHaveLength(8)
    expect(new Set(DIOCESES.map((d) => d.key)).size).toBe(8)
  })
})

describe('dioceseOfTown', () => {
  it('takes the majority', () => expect(dioceseOfTown(['5001', '7001', '7002'])).toBe('7'))
})

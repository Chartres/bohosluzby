// public/embed.js — the parish-website widget (evolve pick #5). Plain script,
// no dependencies; tested through the API it hangs on window.
import '../public/embed.js'

type Api = {
  nextServices: (d: unknown, now: Date, n: number) => { label: string; time: string; type: string; note: string; lang: string }[]
  render: (el: HTMLElement, d: unknown, now: Date) => void
  init: (root?: ParentNode) => Promise<void>
}
const api = () => (window as unknown as { KamNaMsi: Api }).KamNaMsi

const DATA = {
  v: 1,
  id: '1',
  name: 'kostel sv. Havla',
  city: 'Praha 1',
  url: 'https://bohosluzby.dravec.org/kostel/1/',
  updated: '2026-06-01',
  s: [
    ['5', '18:00', 'česky', 'mše sv.', ''],
    ['5', '07:00', 'česky', 'mše sv.', ''],
    ['7', '09:00', 'latinsky', 'mše sv.', 'tridentská'],
    ['1', '18:00', 'česky', 'mše sv.', ''],
  ],
  x: [['2026-07-04', '10:00', 'česky', 'poutní mše', '']],
}
// Friday 3 Jul 2026, 17:00 Prague (CEST = UTC+2)
const NOW = new Date('2026-07-03T15:00:00Z')

it('lists the next services in Prague time, skipping today’s past ones', () => {
  const next = api().nextServices(DATA, NOW, 3)
  expect(next.map((s) => `${s.label} ${s.time} ${s.type}`)).toEqual([
    'dnes 18:00 mše sv.',
    'zítra 10:00 poutní mše',
    'ne 09:00 mše sv.',
  ])
})

it('renders text safely, with a tagged link to the full ordo', () => {
  const el = document.createElement('div')
  api().render(el, { ...DATA, name: '<img src=x onerror=alert(1)>' }, NOW)
  expect(el.querySelector('img')).toBeNull()
  expect(el.textContent).toContain('dnes 18:00')
  expect(el.textContent).toContain('tridentská')
  const a = el.querySelector('a')!
  expect(a.href).toMatch(/^https:\/\/bohosluzby\.dravec\.org\/kostel\/1\/\?utm_source=embed&utm_medium=farnost&utm_campaign=/)
})

it('init fills every placeholder from its JSON, once, and leaves the fallback on failure', async () => {
  document.body.innerHTML =
    '<div data-kam-na-msi="1"><a href="#">fallback</a></div><div data-kam-na-msi="404"><a href="#">fallback</a></div>'
  const fetchMock = vi.fn(async (url: string) =>
    url.endsWith('/embed/1.json') ? new Response(JSON.stringify(DATA)) : new Response('nf', { status: 404 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  await api().init(document)
  await api().init(document) // second call is a no-op
  const [ok, missing] = document.querySelectorAll('[data-kam-na-msi]')
  expect(ok.textContent).toContain('kostel sv. Havla')
  expect(missing.textContent).toBe('fallback')
  expect(fetchMock).toHaveBeenCalledTimes(2)
  vi.unstubAllGlobals()
})

it('honours a run mask: a service its note excludes is skipped', () => {
  const masked = {
    ...DATA,
    from: '2026-07-03',
    s: [
      ['5', '18:00', 'česky', 'mše sv.', 'kromě července', '0'.repeat(60)],
      ['7', '09:00', 'latinsky', 'mše sv.', 'tridentská'],
    ],
    x: [],
  }
  expect(api().nextServices(masked, NOW, 3).map((s) => `${s.label} ${s.time}`)).toEqual(['ne 09:00'])
})

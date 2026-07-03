// Small deterministic dataset + shared helpers for e2e: Prague-centre churches,
// fixed clock Monday 6 Jul 2026 09:00 Prague (07:00 UTC) → ordinary time, green.
import type { Page } from '@playwright/test'
import type { IndexRow } from '../src/domain/data'

export async function mockData(page: Page, { delayMs = 0 } = {}) {
  await page.route('**/data/churches.json', async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    await route.fulfill({ json: INDEX })
  })
  await page.route('**/data/services/*.json', async (route) => {
    const cell = route.request().url().match(/services\/(.+)\.json/)?.[1]
    if (cell === '50-14') await route.fulfill({ json: SHARD_50_14 })
    else await route.fulfill({ status: 404, body: 'not found' })
  })
}

/** Screenshot into the committed shots dir (visual persona review). */
export const shot = async (page: Page, name: string, fullPage = false) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.screenshot({ path: `e2e/shots/${name}.png`, fullPage, animations: 'disabled' })
}

export const FIXED_NOW = new Date('2026-07-06T07:00:00Z')
export const PRAGUE = { latitude: 50.0875, longitude: 14.4213 }
export const REMOTE = { latitude: 48.75, longitude: 13.55 } // Šumava, nothing near

export const INDEX: IndexRow[] = [
  ['1', 'kostel Nejsvětějšího Salvátora', 'Praha 1', 50.0862, 14.4165, 0, '50-14', 'https://www.farnostsalvator.cz'],
  ['2', 'katedrála sv. Víta, Václava a Vojtěcha', 'Praha 1', 50.0908, 14.3999, 1, '50-14', 'https://www.katedralasvatehovita.cz'],
  ['3', 'kostel sv. Havla', 'Praha 1', 50.0855, 14.4229, 0, '50-14'],
  ['4', 'kostel Panny Marie Sněžné', 'Praha 1', 50.0827, 14.4227, 0, '50-14'],
  ['5', 'kostel sv. Klimenta (řeckokatolická katedrála)', 'Praha 1', 50.0868, 14.4159, 0, '50-14'],
  ['6', 'kostel sv. Ludmily', 'Praha 2', 50.0755, 14.4378, 1, '50-14'],
]

type Row = [string, string, string, 0 | 1, string, string]
const svc = (days: string, time: string, lang = 'česky', greek: 0 | 1 = 0, type = 'mše sv.', note = ''): Row => [
  days,
  time,
  lang,
  greek,
  type,
  note,
]

export const SHARD_50_14 = {
  '1': {
    u: '2026-06-14',
    p: 'Akademická farnost Praha',
    pa: 'Křižovnické nám. 4, Praha 1',
    c: [['www', 'https://www.farnostsalvator.cz']],
    s: [svc('1234567', '12:00'), svc('7', '20:00')],
  },
  '2': {
    u: '2026-06-20',
    p: 'farnost u katedrály sv. Víta',
    pa: '',
    c: [['www', 'https://www.katedralasvatehovita.cz']], // transform mirrors index www here
    s: [svc('12345', '09:30'), svc('6', '07:00'), svc('7', '08:30')],
  },
  '3': {
    u: '2026-05-30',
    p: '',
    pa: '',
    c: [],
    s: [
      svc('1', '19:30', 'Latine', 0, 'mše sv.', 'tridentská'),
      svc('1', '10:30', 'česky', 0, 'mše sv.', 'kromě července a srpna'), // provably not on 6 Jul
    ],
  },
  '4': {
    u: '2026-06-01',
    p: 'farnost Panny Marie Sněžné',
    pa: '',
    c: [],
    s: [svc('123456', '18:00'), svc('7', '09:00'), svc('7', '11:30')],
    x: [['2026-07-06', '15:00', 'česky', 0, 'pobožnost', 'první pondělí v měsíci'] as Row],
  },
  '5': {
    u: '2026-06-10',
    p: 'řeckokatolická farnost Praha',
    pa: '',
    c: [],
    s: [svc('1234567', '17:00', 'ukrajinsky', 1, 'sv. liturgie', '')],
  },
  '6': {
    u: '2026-06-18',
    p: 'farnost sv. Ludmily',
    pa: '',
    c: [],
    s: [
      svc('12345', '16:30'),
      svc('7', '09:00'),
      svc('1', '15:00', 'česky', 0, 'mše sv.', 'dle ohlášení'), // unverifiable → warning rubric
    ],
  },
}

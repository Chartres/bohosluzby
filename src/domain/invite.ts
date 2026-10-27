// Mechanic C — pozvat (docs/SIGNATURE.md): one person invites another to one
// Mass, in their own messenger and words. We only prefill the plain facts:
// the next date this service really runs (its note respected), the time, the
// church and its page. No pressure, no counting — the link carries
// utm_source=pozvani so we learn how many invitations were opened, nothing more.
import { nextReminderAt, pragueDay, pragueToday } from './occurrences'
import { runsAt } from './notes'
import { churchUrl } from './site'
import type { Lang } from '../i18n'

type InviteService =
  | { days: string; time: string; type: string; note: string }
  | { date: string; time: string; type: string; note: string }

// Czech "v + accusative", Date.getUTCDay order
const KDY_CS = ['v neděli', 'v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu']
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const isMass = (type: string) => !type.trim() || /mše|liturgi/i.test(type)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function inviteFor(
  church: { id: string; name: string; city: string },
  service: InviteService,
  now: Date,
  lang: Lang,
): { text: string; url: string } | null {
  const time = /^\d{1,2}:\d{2}/.exec(service.time.trim())?.[0]
  if (!time) return null
  const spec = 'days' in service ? { days: service.days, time } : { date: service.date, time }
  const start = nextReminderAt(spec, now, 0, 366, (s) => runsAt(service.note, s))
  if (!start) return null

  const { y, m, d } = pragueToday(start)
  const day = Date.UTC(y, m - 1, d)
  const offset = Math.round((day - pragueDay(now).getTime()) / 86_400_000)
  const dow = new Date(day).getUTCDay()
  const city = church.city.includes(',') ? church.city.slice(church.city.lastIndexOf(',') + 1).trim() : church.city
  const place = church.name.includes(city) || !city ? church.name : `${church.name} (${city})`
  const url = `${churchUrl(church.id)}?utm_source=pozvani`

  if (lang === 'en') {
    const when = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : `${DAY_EN[dow]} ${d} ${MONTH_EN[m - 1]}`
    const what = isMass(service.type) ? 'Will you come to Mass with me?' : `Will you come with me? ${service.type.trim()},`
    return { text: `${what} ${when} at ${time}, ${place}.`, url }
  }
  const kdy = offset === 0 ? 'dnes' : offset === 1 ? 'zítra' : `${KDY_CS[dow]} ${d}. ${m}.`
  const text = isMass(service.type)
    ? `Půjdeš se mnou na mši svatou? ${cap(kdy)} v ${time}, ${place}.`
    : `Půjdeš se mnou? ${cap(service.type.trim())} ${kdy} v ${time}, ${place}.`
  return { text, url }
}

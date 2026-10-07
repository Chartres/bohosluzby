// Moje kostely (evolve pick #2): the starred churches' next service, above the
// nearby list and regardless of distance. A glance, not a feed — and no nudge:
// nothing here ever notifies.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { decodeShard, type Church, type ChurchServices } from './domain/data'
import { rankUpcoming } from './domain/ranking'
import { dayLabel, fmtTime } from './domain/format'
import { loadData } from './lib/dataStore'
import { favoritesSnapshot, subscribeFavorites } from './lib/favorites'
import { t } from './i18n'

export function MyChurches({
  index,
  origin,
  onOpen,
}: {
  index: Church[]
  origin: { lat: number; lng: number }
  onOpen: (id: string) => void
}) {
  const ids = useSyncExternalStore(subscribeFavorites, favoritesSnapshot)
  const churches = useMemo(() => {
    const byId = new Map(index.map((c) => [c.id, c]))
    return ids.map((id) => byId.get(id)).filter((c): c is Church => Boolean(c))
  }, [ids, index])
  const [services, setServices] = useState<Map<string, ChurchServices> | null>(null)

  useEffect(() => {
    if (churches.length === 0) return
    let cancelled = false
    const cells = [...new Set(churches.map((c) => c.cell))]
    Promise.all(cells.map((cell) => loadData<Parameters<typeof decodeShard>[0]>(`services/${cell}.json`).catch(() => ({}))))
      .then((shards) => {
        if (cancelled) return
        const m = new Map<string, ChurchServices>()
        for (const shard of shards) for (const [id, s] of decodeShard(shard)) m.set(id, s)
        setServices(m)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [churches])

  if (churches.length === 0 || !services) return null
  const now = new Date()
  const next = new Map(
    rankUpcoming(now, origin, churches, services, { limit: churches.length }).map((u) => [u.church.id, u]),
  )
  return (
    <section aria-label={t('mine_title')} className="mt-6">
      <h2 className="rubric border-b border-hairline pb-1">{t('mine_title')}</h2>
      <ul>
        {churches.map((c) => {
          const u = next.get(c.id)
          return (
            <li key={c.id} className="flex items-baseline gap-4 border-b border-hairline py-2">
              <p className="w-28 shrink-0 text-sm text-ink-faded">
                {u ? (
                  <>
                    <span className="font-display text-base font-semibold tabular-nums text-ink">{fmtTime(u.start)}</span>{' '}
                    <span>{dayLabel(now, u.start)}</span>
                  </>
                ) : (
                  '—'
                )}
              </p>
              <button
                type="button"
                className="min-w-0 flex-1 text-left underline decoration-hairline underline-offset-2 hover:text-ink"
                onClick={() => onOpen(c.id)}
              >
                {c.name}
              </button>
              {!u && <span className="text-xs text-ink-faded">{t('mine_none_soon')}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

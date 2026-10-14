// Moje kostely (evolve pick #2): the starred churches' next service, above the
// nearby list and regardless of distance. A glance, not a feed — and no nudge:
// nothing here ever notifies.
import { type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { decodeShard, type Church, type ChurchServices } from './domain/data'
import { rankUpcoming } from './domain/ranking'
import { dayLabel, fmtTime } from './domain/format'
import { loadData } from './lib/dataStore'
import { favoritesSnapshot, subscribeFavorites, toggleFavorite } from './lib/favorites'
import { track } from './analytics'
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
            <SwipeRow
              key={c.id}
              label={`${t('fav_remove')}: ${c.name}`}
              onRemove={() => {
                toggleFavorite(c.id)
                track('key_action', { action: 'favorite', on: false })
              }}
            >
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
            </SwipeRow>
          )
        })}
      </ul>
    </section>
  )
}

// Swipe left to reveal "Odebrat" (the iOS Mail/Outlook list gesture); removal
// needs the tap, so a stray swipe never deletes. The action stays in the DOM
// for keyboard and screen-reader users and slides the row open when focused.
const ACTION_PX = 96

function SwipeRow({ label, onRemove, children }: { label: string; onRemove: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState<number | null>(null) // live offset while the finger is down
  const start = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null)
  const base = open ? -ACTION_PX : 0
  const x = drag ?? base
  return (
    <li className="relative overflow-hidden border-b border-hairline">
      <button
        type="button"
        aria-label={label}
        onClick={onRemove}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="absolute inset-y-0 right-0 bg-rubric text-sm font-semibold text-paper"
        style={{ width: ACTION_PX }}
      >
        {t('fav_remove_short')}
      </button>
      <div
        data-swipe
        className={`relative flex items-baseline gap-4 bg-paper py-2 ${drag === null ? 'transition-transform duration-150' : ''}`}
        style={{ transform: `translateX(${x}px)`, touchAction: 'pan-y' }}
        onTouchStart={(e) => {
          const p = e.touches[0]
          start.current = { x: p.clientX, y: p.clientY, horizontal: null }
        }}
        onTouchMove={(e) => {
          const s = start.current
          if (!s) return
          const p = e.touches[0]
          const dx = p.clientX - s.x
          const dy = p.clientY - s.y
          if (s.horizontal === null && Math.abs(dx) + Math.abs(dy) > 8) s.horizontal = Math.abs(dx) > Math.abs(dy)
          if (s.horizontal) setDrag(Math.min(0, Math.max(-ACTION_PX * 1.5, base + dx)))
        }}
        onTouchEnd={() => {
          if (start.current?.horizontal && drag !== null) setOpen(drag < -ACTION_PX / 2)
          start.current = null
          setDrag(null)
        }}
      >
        {children}
      </div>
    </li>
  )
}

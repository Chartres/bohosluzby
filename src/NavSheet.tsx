// "Navigovat" chooser — a bottom sheet of navigation apps (Apple Maps, Google
// Maps, Mapy.cz). iOS offers no system picker for this; universal links open
// the installed app directly. Styled like the ordo filter sheet.
import { useEffect } from 'react'
import { navApps } from './lib/nav-apps'
import { track } from './analytics'

export type NavTarget = { name: string; lat: number; lng: number }

export function NavSheet({ target, onClose }: { target: NavTarget; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <button
        type="button"
        aria-label="Zavřít navigaci"
        className="fixed inset-0 z-40 bg-ink/20"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-label={`Navigovat: ${target.name}`}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-paper px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <p className="rubric">navigovat</p>
        <p className="font-display mt-1 truncate text-base font-semibold">{target.name}</p>
        <ul className="mt-2">
          {navApps(target.lat, target.lng).map((app) => (
            <li key={app.name}>
              <a
                className="flex min-h-11 items-center border-t border-hairline text-base underline decoration-hairline underline-offset-2 hover:text-ink"
                href={app.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  track('key_action', { action: 'navigate', app: app.name })
                  onClose()
                }}
              >
                {app.name}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="rubric mt-2 w-full border-t border-hairline pt-3 pb-1 text-center"
          onClick={onClose}
        >
          zavřít
        </button>
      </div>
    </>
  )
}

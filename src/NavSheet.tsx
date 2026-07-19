// "Navigovat" chooser — a bottom sheet of navigation apps (Apple Maps, Google
// Maps, Mapy.cz). iOS offers no system picker for this; universal links open
// the installed app directly. Styled like the ordo filter sheet.
import { useEffect } from 'react'
import { navApps } from './lib/nav-apps'
import { track } from './analytics'
import { t, verifyBanner } from './i18n'
import { verifySeason } from './domain/liturgical'

export type NavTarget = { name: string; lat: number; lng: number }

export function NavSheet({ target, onClose }: { target: NavTarget; onClose: () => void }) {
  const season = verifySeason(new Date())
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
        aria-label={t('nav_close_aria')}
        className="fixed inset-0 z-[1190] bg-ink/20"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-label={`${t('nav_rubric')}: ${target.name}`}
        className="fixed inset-x-0 bottom-0 z-[1200] border-t border-hairline bg-paper px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <p className="rubric">{t('nav_rubric')}</p>
        <p className="font-display mt-1 truncate text-base font-semibold">{target.name}</p>
        {/* last look before the person walks — repeat the season advisory */}
        {season && <p className="mt-1 text-sm text-rubric">{verifyBanner(season)}</p>}
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
          {t('close')}
        </button>
      </div>
    </>
  )
}

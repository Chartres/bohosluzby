import { useMemo, useState } from 'react'
import type { Church } from './domain/data'
import { aggregateCities, searchPlaces, type City } from './domain/cities'
import { churchCount, t } from './i18n'

/** Unified typeahead over every municipality and church, diacritics-insensitive
 * ("ceske" finds České Budějovice, "tyn" finds Matky Boží před Týnem), keyboard
 * navigable (↑/↓/Enter, Escape = zpět). Replaces the <datalist> picker, which
 * Chromium truncates at 512 suggestions — the 3 259-city list ended at "Dubí". */
export function SearchPicker({
  index,
  onPickCity,
  onPickChurch,
  onClose,
}: {
  index: Church[]
  onPickCity: (city: City) => void
  onPickChurch: (id: string) => void
  onClose?: () => void
}) {
  const [value, setValue] = useState('')
  const [hi, setHi] = useState(0)
  const cities = useMemo(() => aggregateCities(index), [index])
  const results = useMemo(() => searchPlaces(cities, index, value), [cities, index, value])
  const clamp = Math.min(hi, Math.max(results.length - 1, 0))

  const pick = (r: (typeof results)[number]) => {
    if (r.kind === 'city') onPickCity(r.city)
    else onPickChurch(r.church.id)
  }

  return (
    <div className="mt-6 max-w-md">
      {onClose && (
        <p className="mb-3">
          <button
            type="button"
            onClick={onClose}
            className="rubric underline decoration-hairline underline-offset-2 hover:text-ink"
          >
            {t('back_to_list')}
          </button>
        </p>
      )}
      <label className="rubric block" htmlFor="city">
        {t('search_label')}
      </label>
      <input
        id="city"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="city-options"
        aria-activedescendant={results.length > 0 ? `city-option-${clamp}` : undefined}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setHi(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHi(Math.min(clamp + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHi(Math.max(clamp - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (results[clamp]) pick(results[clamp])
          } else if (e.key === 'Escape') {
            e.preventDefault()
            if (value) setValue('')
            else onClose?.()
          }
        }}
        placeholder={t('search_placeholder')}
        autoComplete="off"
        autoFocus={Boolean(onClose)} // opened by an explicit "změnit" tap — jump right in
        className="mt-2 min-h-11 w-full rounded-sm border border-hairline bg-white/60 px-3 text-base"
      />
      <ul id="city-options" role="listbox" aria-label={t('search_results_aria')} className="mt-1">
        {results.map((r, i) => (
          <li key={r.kind === 'city' ? `c-${r.city.slug}` : `k-${r.church.id}`} role="presentation">
            <button
              type="button"
              id={`city-option-${i}`}
              role="option"
              aria-selected={i === clamp}
              className={`flex w-full items-baseline justify-between gap-3 border-b border-hairline px-1 py-2.5 text-left text-sm ${
                i === clamp ? 'bg-white/70' : ''
              }`}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(r)}
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <span className="shrink-0 text-xs text-ink-faded">
                {r.kind === 'city' ? `${t('kind_town')} · ${churchCount(r.city.count)}` : r.church.city}
              </span>
            </button>
          </li>
        ))}
        {value.trim().length >= 2 && results.length === 0 && (
          <li className="px-1 py-2.5 text-sm text-ink-faded">{t('search_none')}</li>
        )}
      </ul>
    </div>
  )
}

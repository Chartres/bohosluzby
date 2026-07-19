// Hand-rolled i18n — no library, two languages. Language follows the device:
// cs/sk → Czech (the app's native language), anything else → English. Read
// PER CALL (not cached at module load) so tests can flip navigator.language
// without a module reset. Registry DATA (service types, notes, church/city
// names, feast names) is never translated — only UI chrome goes through here.
export type Lang = 'cs' | 'en'

export function lang(): Lang {
  const l = typeof navigator !== 'undefined' ? (navigator.language ?? 'cs') : 'cs'
  return /^(cs|sk)/i.test(l) ? 'cs' : 'en'
}

export const locale = (): string => (lang() === 'cs' ? 'cs-CZ' : 'en-GB')

// Exported so the mirroring test can assert Object.keys(cs) === Object.keys(en)
// — otherwise there'd be no runtime check that every English string exists.
export const cs = {
  // ---- loading / geolocation ----
  loading_title: 'Hledám bohoslužby poblíž…',
  loading_prompting: 'Povolte prosím přístup k poloze v dialogu prohlížeče.',
  loading_default: 'Načítám data a zjišťuji polohu.',
  pick_manually: 'vybrat obec ručně',
  no_geo_title: 'Bez přístupu k poloze',
  no_geo_body: 'Poloha slouží jen k nalezení nejbližších kostelů — nikam se neodesílá.',
  geo_fail_unavailable:
    'Polohové služby telefonu jsou vypnuté. Zapněte je v nastavení telefonu (Poloha) a pak klepněte na ',
  geo_fail_deadline:
    'Prohlížeč nedostal odpověď na dialog o povolení polohy — možná se nezobrazil. Zkontrolujte, zda smí prohlížeč používat polohu v nastavení telefonu, a klepněte na ',
  geo_fail_denied:
    'Pokud jste ji dříve zablokovali, klepněte na ikonu zámku vedle adresy stránky → Oprávnění → Poloha → Povolit, a pak na ',
  retry: 'zkusit znovu',
  geo_fail_tail: '. Nebo vyhledejte obec či kostel:',
  picking_title: 'Jiná obec nebo kostel',
  nothing_nearby_title: 'V okolí nic nenacházím',
  data_error: 'Data se nepodařilo načíst. Zkuste to prosím znovu.',

  // ---- the hero list ----
  nearest_services: 'Nejbližší bohoslužby',
  last_known_suffix: 'poslední známá',
  last_known_solo: 'poslední známá poloha',
  locating_suffix: ' · zjišťuji aktuální…',
  from_location: 'podle vaší polohy',
  change: 'změnit',
  my_location: 'moje poloha',
  search_cta: 'Hledat obec nebo kostel…',
  map_loading: 'Načítám mapu…',
  map_offline: 'Mapa potřebuje připojení — dlaždice se do zařízení neukládají. Seznam funguje i offline.',
  show_more: 'zobrazit další',
  empty_filtered: 'Zvolenému dni a filtrům neodpovídá žádná bohoslužba v okolí.',
  empty_plain: 'V tento den není v okolí žádná bohoslužba.',
  clear_filters: 'Zrušit filtry',

  // ---- footer ----
  footer_offline: 'offline — zobrazuji uložená data',
  footer_updating: 'aktualizuji…',
  footer_asof_prefix: 'aktuální k',
  footer_free: 'zdarma, bez reklam',
  footer_support: 'Podpořit',

  // ---- liturgical seasons ----
  season_ordinary: 'liturgické mezidobí',
  season_advent: 'doba adventní',
  season_christmas: 'doba vánoční',
  season_lent: 'doba postní',
  season_easter: 'doba velikonoční',

  // ---- day picker / ordo controls ----
  day_now: 'hned',
  day_today: 'dnes',
  day_tomorrow: 'zítra',
  day_sunday_full: 'neděle',
  day_group: 'Den',
  view_group: 'Zobrazení',
  view_list: 'seznam',
  view_map: 'mapa',
  wheelchair_label: 'bezbariérový přístup',
  row_route: 'trasa',
  row_web: 'web',
  day_filters_group: 'Den a filtry',
  rubric_when: 'kdy',
  anytime: 'kdykoli',
  around_word: 'kolem',
  around_time_aria: 'Kolem času',
  band_past_title: 'dnes už proběhlo — přepne na zítra',
  rubric_range: 'okruh',
  nearby_word: 'okolí',
  any_distance: 'vše',
  rubric_what: 'co',
  filters_group_aria: 'Filtry',
  filt_mass_only: 'jen mše svaté',
  filt_barrier_free: 'bezbariérové',
  filt_greek: 'řeckokatolické',
  greek_chip: 'řeckokatolická',
  lang_all: 'jazyk: všechny',
  lang_select_aria: 'Jazyk bohoslužby',
  close_filters_aria: 'Zavřít filtry',
  filters_word: 'filtry',
  done: 'hotovo',
  clear_all: '✕ zrušit',

  // ---- routes ----
  church_not_found_title: 'Kostel nenalezen',
  church_not_found_body: 'Tento odkaz nevede na žádný kostel v rejstříku.',
  detail_route_back: 'Zpět na seznam',
  loading_ellipsis: 'Načítám…',
  back_to_list: '‹ zpět na seznam',
  city_title_suffix: 'mše svatá dnes',

  // ---- search picker ----
  search_label: 'Kostel nebo obec',
  search_placeholder: 'např. Brno nebo sv. Víta',
  search_results_aria: 'Výsledky hledání',
  search_none: 'Nic nenalezeno.',
  kind_town: 'obec',

  // ---- map ----
  map_aria: 'Mapa bohoslužeb',
  map_no_match: 'pro váš výběr nic',
  map_nearest_prefix: ' — nejbližší: ',
  map_none_soon: 'žádná bohoslužba v nejbližších dnech',
  map_open: 'otevřít ›',
  map_at: 'v',

  // ---- nav sheet ----
  nav_close_aria: 'Zavřít navigaci',
  nav_rubric: 'navigovat',
  close: 'zavřít',

  // ---- church detail ----
  schedule_title: 'Pořad bohoslužeb',
  extras_title: 'Mimořádné bohoslužby',
  parish_title: 'Farnost',
  no_regular_services: 'Rejstřík pro tento kostel neuvádí žádné pravidelné bohoslužby.',
  last_verified: 'naposledy ověřeno',
  data_source_note: 'údaje z rejstříku ČBK',
  detail_load_error: 'Rozpis bohoslužeb se nepodařilo načíst. Zkuste to prosím znovu.',
  detail_loading: 'Načítám rozpis…',
  remind: 'připomenout',
  add_calendar: 'do kalendáře',
  remind_denied: 'povolte oznámení v Nastavení',
  remind_failed: 'nepodařilo se — zkuste znovu',
  remind_none: 'žádná nejbližší',
  share: 'sdílet',
  link_copied: 'odkaz zkopírován ✓',
  detail_navigate: 'navigace',
  map_link: 'mapa',
  now_paused: 'nyní se nekoná',
  detail_title_suffix: 'pořad bohoslužeb',
  service_fallback: 'bohoslužba',
  wd_mon: 'pondělí',
  wd_tue: 'úterý',
  wd_wed: 'středa',
  wd_thu: 'čtvrtek',
  wd_fri: 'pátek',
  wd_sat: 'sobota',

  // ---- feedback card ----
  ellis_very: 'Hodně by mi chyběla',
  ellis_somewhat: 'Trochu by mi chyběla',
  ellis_not: 'Nechyběla by mi',
  feedback_thanks: 'Díky, zpětnou vazbu jsme dostali.',
  feedback_cta: 'Našli jste chybu v rozpisu? Napište nám',
  feedback_intro: 'Co chybí? Co nesedí? Píšete přímo autorovi.',
  feedback_rubric: 'Kdyby tahle aplikace zítra zmizela…',
  feedback_placeholder: 'Napište cokoli (volitelné)…',
  feedback_aria: 'Zpětná vazba',
  feedback_close: 'Zavřít',
  feedback_send: 'Odeslat',
} as const

export type Key = keyof typeof cs

export const en: Record<Key, string> = {
  loading_title: 'Looking for services nearby…',
  loading_prompting: 'Please allow location access in the browser dialog.',
  loading_default: 'Loading data and finding your location.',
  pick_manually: 'pick a town manually',
  no_geo_title: 'No location access',
  no_geo_body: "Location is only used to find the nearest churches — it's never sent anywhere.",
  geo_fail_unavailable:
    "Your phone's location services are off. Turn them on in phone settings (Location), then tap ",
  geo_fail_deadline:
    'The browser never got a response to the location permission dialog — it may not have appeared. Check that the browser is allowed to use location in your phone settings, then tap ',
  geo_fail_denied:
    'If you blocked it earlier, tap the lock icon next to the address bar → Permissions → Location → Allow, then tap ',
  retry: 'try again',
  geo_fail_tail: '. Or search for a town or church:',
  picking_title: 'A different town or church',
  nothing_nearby_title: 'Nothing nearby',
  data_error: "Couldn't load data. Please try again.",

  nearest_services: 'Nearest services',
  last_known_suffix: 'last known',
  last_known_solo: 'last known location',
  locating_suffix: ' · locating current…',
  from_location: 'from your location',
  change: 'change',
  my_location: 'my location',
  search_cta: 'search town or church…',
  map_loading: 'loading map…',
  map_offline: "Map needs a connection — tiles aren't stored on the device. The list works offline.",
  show_more: 'show more',
  empty_filtered: 'no services match this day and filters',
  empty_plain: 'no services nearby on this day',
  clear_filters: 'clear filters',

  footer_offline: 'offline — showing saved data',
  footer_updating: 'updating…',
  footer_asof_prefix: 'current as of',
  footer_free: 'free, no ads',
  footer_support: 'Support',

  season_ordinary: 'ordinary time',
  season_advent: 'Advent',
  season_christmas: 'Christmas season',
  season_lent: 'Lent',
  season_easter: 'Easter season',

  day_now: 'now',
  day_today: 'today',
  day_tomorrow: 'tomorrow',
  day_sunday_full: 'sunday',
  day_group: 'Day',
  view_group: 'View',
  view_list: 'list',
  view_map: 'map',
  wheelchair_label: 'step-free access',
  row_route: 'route',
  row_web: 'web',
  day_filters_group: 'day and filters',
  rubric_when: 'when',
  anytime: 'anytime',
  around_word: 'around',
  around_time_aria: 'around time',
  band_past_title: 'already over today — switches to tomorrow',
  rubric_range: 'range',
  nearby_word: 'nearby',
  any_distance: 'any',
  rubric_what: 'what',
  filters_group_aria: 'Filters',
  filt_mass_only: 'masses only',
  filt_barrier_free: 'step-free access',
  filt_greek: 'Greek Catholic',
  greek_chip: 'Greek Catholic',
  lang_all: 'language: all',
  lang_select_aria: 'service language',
  close_filters_aria: 'close filters',
  filters_word: 'filters',
  done: 'done',
  clear_all: '✕ clear',

  church_not_found_title: 'Church not found',
  church_not_found_body: "This link doesn't point to any church in the registry.",
  detail_route_back: 'Back to list',
  loading_ellipsis: 'loading…',
  back_to_list: '‹ back to list',
  city_title_suffix: 'mass today',

  search_label: 'Church or town',
  search_placeholder: 'e.g. Prague or St Vitus',
  search_results_aria: 'search results',
  search_none: 'Nothing found.',
  kind_town: 'town',

  map_aria: 'services map',
  map_no_match: 'nothing for your selection',
  map_nearest_prefix: ' — nearest: ',
  map_none_soon: 'no services in the coming days',
  map_open: 'open ›',
  map_at: 'at',

  nav_close_aria: 'close navigation',
  nav_rubric: 'navigate',
  close: 'close',

  schedule_title: 'Mass times',
  extras_title: 'Special services',
  parish_title: 'Parish',
  no_regular_services: 'The registry lists no regular services for this church.',
  last_verified: 'last verified',
  data_source_note: 'data from the ČBK registry',
  detail_load_error: "Couldn't load the service schedule. Please try again.",
  detail_loading: 'loading schedule…',
  remind: 'remind me',
  add_calendar: 'add to calendar',
  remind_denied: 'enable notifications in Settings',
  remind_failed: "couldn't schedule it — try again",
  remind_none: 'no upcoming service',
  share: 'share',
  link_copied: 'link copied ✓',
  detail_navigate: 'navigate',
  map_link: 'map',
  now_paused: 'not currently held',
  detail_title_suffix: 'mass times',
  service_fallback: 'service',
  wd_mon: 'monday',
  wd_tue: 'tuesday',
  wd_wed: 'wednesday',
  wd_thu: 'thursday',
  wd_fri: 'friday',
  wd_sat: 'saturday',

  ellis_very: "I'd miss it a lot",
  ellis_somewhat: "I'd miss it a little",
  ellis_not: "I wouldn't miss it",
  feedback_thanks: 'Thanks, we got your feedback.',
  feedback_cta: 'Found a mistake in the schedule? Let us know',
  feedback_intro: "What's missing? What's wrong? You're writing straight to the author.",
  feedback_rubric: 'If this app disappeared tomorrow…',
  feedback_placeholder: 'Write anything (optional)…',
  feedback_aria: 'Feedback',
  feedback_close: 'Close',
  feedback_send: 'Send',
}

export function t(k: Key): string {
  return (lang() === 'cs' ? cs : en)[k]
}

// ---- small helpers for strings that don't fit a flat dict (interpolation,
// Czech grammatical plurals) ----

/** "3 kostely" / "3 churches" — Czech plural (1 / 2–4 / 5+), English regular. */
export function churchCount(n: number): string {
  if (lang() === 'cs') {
    const word = n === 1 ? 'kostel' : n < 5 ? 'kostely' : 'kostelů'
    return `${n} ${word}`
  }
  return `${n} ${n === 1 ? 'church' : 'churches'}`
}

/** "filtry (2)" / "filters (2)", or the bare word when nothing is active. */
export function filtersLabel(n: number): string {
  return n ? `${t('filters_word')} (${n})` : t('filters_word')
}

/** "kolem 18:00" / "around 18:00" — the "kdy" pill when a custom time is set. */
export function aroundLabel(cas: string): string {
  return `${t('around_word')} ${cas}`
}

/** "do 5 km" / "within 5 km" — the "okruh" pill/sheet distance options. */
export function withinKmLabel(km: number): string {
  return lang() === 'cs' ? `do ${km} km` : `within ${km} km`
}

/** "Do 30 km od obce Brno není…" / "No services within 30 km of Brno…" —
 * the "nothing nearby" explanation, with or without a named place. */
export function nothingNearbyBody(km: number, place: string | null): string {
  if (lang() === 'cs') {
    const where = place ? `obce ${place}` : 'vaší polohy'
    return `Do ${km} km od ${where} není v rejstříku žádná bohoslužba. Zkuste jinou obec.`
  }
  const where = place ?? 'your location'
  return `No services within ${km} km of ${where} in the registry. Try another town.`
}

/** "✓ připomeneme 30 min předem" / "✓ we'll remind you 30 min before". */
export function reminderScheduledMsg(min: number): string {
  return lang() === 'cs' ? `✓ připomeneme ${min} min předem` : `✓ we'll remind you ${min} min before`
}

/** " · ověřeno 2016" / " · verified 2016" — the list row's stale-data marker. */
export function verifiedYear(iso: string): string {
  const y = iso.slice(0, 4)
  return lang() === 'cs' ? `ověřeno ${y}` : `verified ${y}`
}

/** The detail's verify-before-you-go warning for a stale registry entry. */
export function staleWarning(dateStr: string): string {
  return lang() === 'cs'
    ? `Rozpis byl naposledy ověřen ${dateStr} — před cestou si ho ověřte u farnosti.`
    : `This schedule was last verified ${dateStr} — check with the parish before you go.`
}

/** The local notification's title — "Mše sv. za 30 min" / "Mše sv. in 30 min".
 * The service type stays registry-Czech (it's data); the phrasing localizes. */
export function reminderTitle(type: string, min: number): string {
  const cap = `${type.charAt(0).toUpperCase()}${type.slice(1)}`
  return lang() === 'cs' ? `${cap} za ${min} min` : `${cap} in ${min} min`
}

const LANG_LABEL_EN: Record<string, string> = {
  'česky': 'Czech',
  'latinsky': 'Latin',
  'latinsky (tridentská)': 'Latin (Tridentine)',
  'anglicky': 'English',
  'italsky': 'Italian',
  'španělsky': 'Spanish',
  'francouzsky': 'French',
  'filipínsky': 'Filipino',
  'maďarsky': 'Hungarian',
  'polsky': 'Polish',
  'vietnamsky': 'Vietnamese',
  'německy': 'German',
  'ukrajinsky': 'Ukrainian',
}

/** Display name for a normalized Czech language adverb ("latinsky" →
 * "Latin"). Czech UI keeps the adverb as-is; English maps known values and
 * falls back to the raw adverb for anything not in the table. */
export function langLabel(l: string): string {
  if (lang() === 'cs') return l
  return LANG_LABEL_EN[l] ?? l
}

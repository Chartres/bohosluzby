import { supabase } from './lib/supabase'
import { isLikelyBot } from './lib/telemetry'
import { createFlywheelClient, type SupabaseLike } from './platform/flywheel-client'

/**
 * Usage tracking via the Flywheel Common Platform client (shared across all
 * flywheel apps). First-party, cookieless, fire-and-forget; no-ops when
 * Supabase isn't configured (local/tests) — and for crawlers and automation,
 * which execute JS and would otherwise count as visitors. isLikelyBot covers
 * the client's isAutomatedBrowser list and more, but keeps CUBOT phones.
 */
const fw = createFlywheelClient({
  app: 'bohosluzby',
  supabase: supabase as unknown as SupabaseLike | null,
  isAutomated: () => typeof navigator !== 'undefined' && isLikelyBot(navigator),
})

export const track = fw.track
/** Aha moment: opening a church detail from the hero list — "found a service". */
export const conversion = fw.conversion
export const feedback = fw.feedback
export const logError = fw.logError

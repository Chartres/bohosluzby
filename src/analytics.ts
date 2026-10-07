import { supabase } from './lib/supabase'
import { isLikelyBot } from './lib/telemetry'
import { createFlywheelClient, type SupabaseLike } from './platform/flywheel-client'

/**
 * Usage tracking via the Flywheel Common Platform client (shared across all
 * flywheel apps). First-party, cookieless, fire-and-forget; no-ops when
 * Supabase isn't configured (local/tests) — and for crawlers and automation,
 * which execute JS and would otherwise count as visitors.
 */
const bot = typeof navigator !== 'undefined' && isLikelyBot(navigator)
const fw = createFlywheelClient({
  app: 'bohosluzby',
  supabase: bot ? null : (supabase as unknown as SupabaseLike | null),
})

export const track = fw.track
/** Aha moment: opening a church detail from the hero list — "found a service". */
export const conversion = fw.conversion
export const feedback = fw.feedback
export const logError = fw.logError

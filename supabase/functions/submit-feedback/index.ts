// Edge Function: submit-feedback — the write chokepoint for pilgrim-witness.
// Direct anon INSERT/UPDATE on mass_feedback is REVOKED; every write comes through
// here so we can (1) verify a Cloudflare Turnstile token on web writes, (2) rate-
// limit per device, (3) validate the chip vocabulary, (4) write with the service
// role. Reads stay anon SELECT (RLS status='visible'). docs/PILGRIM-WITNESS-PLAN.md.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// The locked positive-only vocabulary — the function never stores an unknown tag.
const CHIPS = new Set([
  'hluboky_prozitek', 'dotklo_se_me_kazani', 'krasny_zpev', 'vrele_prijeti',
  'vstricne_k_detem', 'rodinna_atmosfera', 'dustojna_atmosfera',
])
const RATE_LIMIT = 40 // max writes per device per hour (generous for a human, blocks scripts)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json({ error: 'bad json' }, 400) }
  const church_id = b.church_id as string, mass_key = b.mass_key as string, device_id = b.device_id as string
  if (!church_id || !mass_key || !device_id) return json({ error: 'missing fields' }, 400)

  // Turnstile: enforced on browser writes only (native sends no Origin and no token).
  // Dormant until TURNSTILE_SECRET is set + a Cloudflare widget exists.
  const secret = Deno.env.get('TURNSTILE_SECRET')
  const token = b.turnstile_token as string | undefined
  if (secret) {
    if (token) {
      const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      }).then((r) => r.json()).catch(() => ({ success: false }))
      if (!v.success) return json({ error: 'turnstile' }, 403)
    } else if (req.headers.get('origin')) {
      return json({ error: 'turnstile required' }, 403) // a browser call must carry a token
    }
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // per-device velocity cap (last hour)
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await admin
    .from('mass_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', device_id)
    .gte('created_at', since)
  if ((count ?? 0) >= RATE_LIMIT) return json({ error: 'rate' }, 429)

  const chips = Array.isArray(b.chips) ? (b.chips as string[]).filter((c) => CHIPS.has(c)) : []
  const { error } = await admin.from('mass_feedback').upsert(
    {
      app: 'bohosluzby',
      church_id,
      mass_key,
      device_id,
      chips,
      status: 'visible',
      weekday: (b.weekday as number) ?? null,
      mass_time: (b.mass_time as string) ?? null,
      rite: (b.rite as string) ?? null,
      lang: (b.lang as string) ?? null,
      mass_date: (b.mass_date as string) ?? null,
    },
    { onConflict: 'church_id,mass_key,device_id' },
  )
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})

#!/usr/bin/env node
// Analytics bundle guard — run it in the deploy job right before the upload, on the exact dist that ships:
//   - run: node scripts/check-analytics.mjs dist # flywheel:analytics-guard
// Fails the deploy when the built JS carries no Supabase URL, i.e. the build ran without VITE_SUPABASE_URL.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (/\.(m?js)$/.test(name)) out.push(p);
  }
  return out;
}

export function bundleHasAnalytics(dir) {
  const files = jsFiles(dir);
  if (!files.length) return { ok: false, reason: `no JS files under ${dir}` };
  // A project URL, not the bare '.supabase.co': supabase-js itself carries '*.supabase.co'
  // (its allowed-hosts list), which would pass a build that has no config.
  const hit = files.find((f) => /https:\/\/[a-z0-9]+\.supabase\.co/.test(readFileSync(f, 'utf8')));
  if (hit) return { ok: true, reason: `analytics config found in ${path.relative(dir, hit)}` };
  return {
    ok: false,
    reason: `no Supabase URL in ${files.length} JS file(s): the build ran without VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, so the deployed app would send no events`,
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const dir = process.argv[2] || 'dist';
  const r = bundleHasAnalytics(dir);
  if (r.ok) {
    console.log(`ok — ${r.reason}`);
  } else {
    console.error(`::error::${r.reason}`);
    process.exit(1);
  }
}

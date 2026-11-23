// version.json's `timestamp` is what makes the native apps pull new data (src/lib/dataStore.ts);
// `generated` stays the registry's scrape date (shown as "aktuální k …"). The build stamps the
// timestamp with the last commit that changed app data, so a correction or photo batch reaches
// the apps without a registry refresh. Used by scripts/prerender.mjs on dist/data/version.json.
import { execFileSync } from 'node:child_process'

/** Paths whose changes the apps must pull. */
export const DATA_PATHS = ['public/data', 'data/corrections.json']

/** The committed version with its timestamp moved forward to `gitTime`, never back. */
export function stampVersion(version, gitTime) {
  const t = Date.parse(gitTime ?? '')
  if (!Number.isFinite(t)) return version
  const iso = new Date(t).toISOString()
  const current = version.timestamp ?? version.generated ?? ''
  return iso > current ? { ...version, timestamp: iso } : version
}

/** ISO time of the last commit touching app data, or '' (no git, or a shallow clone without it). */
export function lastDataCommit(cwd) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', ...DATA_PATHS], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

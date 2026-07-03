// GH Pages serves 404.html for unknown paths — a copy of the SPA keeps deep
// links (/kostel/<id>/) working on first load.
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
copyFileSync(`${root}dist/index.html`, `${root}dist/404.html`)
console.log('wrote dist/404.html (SPA deep-link fallback)')

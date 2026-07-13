import type { CapacitorConfig } from '@capacitor/cli'

// Bohoslužby ships the existing web app (dist/) as a native shell. Offline by
// construction: the whole catalog is bundled JSON precached at build. See
// flywheel/docs/standards/ios-app.md.
const config: CapacitorConfig = {
  appId: 'org.dravec.bohosluzby',
  appName: 'Bohoslužby',
  webDir: 'dist',
  ios: { contentInset: 'automatic' },
}

export default config

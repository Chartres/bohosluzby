import type { CapacitorConfig } from '@capacitor/cli'

// Bohoslužby ships the existing web app (dist/) as a native shell. Offline by
// construction: the whole catalog is bundled JSON precached at build. See
// flywheel/docs/standards/ios-app.md.
const config: CapacitorConfig = {
  appId: 'org.dravec.bohosluzby',
  appName: 'Bohoslužby',
  webDir: 'dist',
  // paper behind the WebView — otherwise the Dynamic Island / safe-area strip
  // shows the native view's black until content scrolls under it
  backgroundColor: '#f6f1e5',
  ios: { contentInset: 'automatic', backgroundColor: '#f6f1e5' },
}

export default config

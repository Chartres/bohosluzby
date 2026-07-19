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
  // contentInset NEVER: 'automatic' let WKWebView add the safe-area inset on
  // top of the header's own env(safe-area-inset-top) padding — a double gap
  // that appeared after the first scroll. CSS owns the safe area alone.
  ios: { contentInset: 'never', backgroundColor: '#f6f1e5' },
}

export default config

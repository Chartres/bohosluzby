import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { platform } from './native'

// Native-only boot, called from main.tsx behind `isNative`. Every call is
// wrapped so a missing plugin or web context is a silent no-op.
export async function initNative(): Promise<void> {
  try {
    // Parchment (#f6f1e5) is a light background → dark status-bar content.
    await StatusBar.setStyle({ style: Style.Light })
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({ color: '#f6f1e5' })
    }
  } catch {
    /* status bar unavailable — ignore */
  }
  try {
    await SplashScreen.hide()
  } catch {
    /* no splash — ignore */
  }
}

/** Status-bar text colour for what's under it: Style.Dark = LIGHT text (for a
 * dark background, e.g. the church photo hero), Style.Light = dark text on
 * parchment. iOS only (Android keeps its own parchment bar). No-op on web. */
export function setStatusBarOnDark(onDark: boolean): void {
  if (platform !== 'ios') return
  StatusBar.setStyle({ style: onDark ? Style.Dark : Style.Light }).catch(() => {})
}

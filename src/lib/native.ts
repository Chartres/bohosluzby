import { Capacitor } from '@capacitor/core'

/** True inside the iOS/Android shell; false on the web (incl. installed PWA). */
export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web'

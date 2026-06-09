/** Erkennung: läuft Omnia als native Capacitor-App (Android/iOS)? */

import { Capacitor } from '@capacitor/core'

export type OmniaNativeInfo = {
  native: boolean
  platform: 'android' | 'ios' | 'web'
}

export function ladeOmniaNativeInfo(): OmniaNativeInfo {
  if (typeof window === 'undefined') return { native: false, platform: 'web' }
  const bridge = (window as Window & { androidBridge?: unknown }).androidBridge
  const iosBridge = (window as Window & { webkit?: { messageHandlers?: { bridge?: unknown } } }).webkit
    ?.messageHandlers?.bridge
  if (Capacitor.isNativePlatform() || bridge) {
    const p = Capacitor.getPlatform()
    if (p === 'android' || bridge) return { native: true, platform: 'android' }
    if (p === 'ios' || iosBridge) return { native: true, platform: 'ios' }
    return { native: true, platform: 'web' }
  }
  return { native: false, platform: 'web' }
}

export function istOmniaNativeApp(): boolean {
  return ladeOmniaNativeInfo().native
}

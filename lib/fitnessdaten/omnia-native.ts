/** Erkennung: läuft Omnia als native Capacitor-App (Android/iOS)? */

export type OmniaNativeInfo = {
  native: boolean
  platform: 'android' | 'ios' | 'web'
}

export function ladeOmniaNativeInfo(): OmniaNativeInfo {
  if (typeof window === 'undefined') return { native: false, platform: 'web' }
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } })
    .Capacitor
  if (!cap?.isNativePlatform?.()) return { native: false, platform: 'web' }
  const p = cap.getPlatform?.() ?? 'web'
  if (p === 'android') return { native: true, platform: 'android' }
  if (p === 'ios') return { native: true, platform: 'ios' }
  return { native: true, platform: 'web' }
}

export function istOmniaNativeApp(): boolean {
  return ladeOmniaNativeInfo().native
}

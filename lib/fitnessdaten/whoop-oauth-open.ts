/** WHOOP-OAuth: In der Native-App extern öffnen (Capacitor blockiert sonst api.prod.whoop.com). */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'

const WHOOP_AUTH_HOST = 'api.prod.whoop.com'

export function istGueltigeWhoopAuthUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname === WHOOP_AUTH_HOST && u.pathname.includes('/oauth/')
  } catch {
    return false
  }
}

export async function oeffneWhoopOAuthUrl(url: string): Promise<void> {
  if (!istGueltigeWhoopAuthUrl(url)) {
    throw new Error('Ungültige WHOOP-Anmelde-URL vom Server.')
  }

  if (istOmniaNativeApp()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
      return
    } catch {
      /* Fallback: WebView (nur wenn allowNavigation in capacitor.config gesetzt) */
    }
  }

  window.location.href = url
}

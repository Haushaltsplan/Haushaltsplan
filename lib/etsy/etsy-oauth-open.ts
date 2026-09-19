/** Etsy-OAuth: In der Native-App extern öffnen. */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'

const ETSY_AUTH_HOSTS = new Set(['www.etsy.com', 'etsy.com'])

export function istGueltigeEtsyAuthUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return ETSY_AUTH_HOSTS.has(u.hostname) && u.pathname.includes('/oauth/')
  } catch {
    return false
  }
}

export async function oeffneEtsyOAuthUrl(url: string): Promise<void> {
  if (!istGueltigeEtsyAuthUrl(url)) {
    throw new Error('Ungültige Etsy-Anmelde-URL vom Server.')
  }

  if (istOmniaNativeApp()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
      return
    } catch {
      /* Fallback WebView */
    }
  }

  window.location.href = url
}

/** Strava-OAuth: In der Native-App extern öffnen. */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'

const STRAVA_AUTH_HOSTS = new Set(['www.strava.com', 'strava.com'])

export function istGueltigeStravaAuthUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return STRAVA_AUTH_HOSTS.has(u.hostname) && u.pathname.includes('/oauth/')
  } catch {
    return false
  }
}

export async function oeffneStravaOAuthUrl(url: string): Promise<void> {
  if (!istGueltigeStravaAuthUrl(url)) {
    throw new Error('Ungültige Strava-Anmelde-URL vom Server.')
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

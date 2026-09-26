'use client'

/**
 * Speichert Deep-Link-URLs sofort in sessionStorage und navigiert zur Auth-Seite.
 */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { useEffect } from 'react'

const APP_ORIGIN =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '')) ||
  'https://haushaltsplan-blue.vercel.app'

const SS_PENDING = 'omnia-pending-auth-url'

function zuAppAuthUrl(raw: string): string | null {
  try {
    // Manche Android-Intents liefern ungewöhnliche Strings
    const normalized = raw.includes('://') ? raw : `de.omnia.haushalt://${raw}`
    const u = new URL(normalized)
    const isCustom = u.protocol.replace(':', '') === 'de.omnia.haushalt'
    const isHttpsAuth = u.protocol === 'https:' && u.pathname.includes('/auth')
    if (!isCustom && !isHttpsAuth) return null

    const zielPath =
      raw.includes('auth/session') || u.pathname.includes('session')
        ? '/auth/session'
        : '/auth/confirm'

    const https = new URL(`${APP_ORIGIN}${zielPath}`)
    u.searchParams.forEach((v, k) => https.searchParams.set(k, v))
    // host=auth path=/confirm → params liegen in search
    if (u.hash) https.hash = u.hash
    return https.toString()
  } catch {
    return null
  }
}

function navigiere(raw: string) {
  const target = zuAppAuthUrl(raw)
  if (!target) return
  try {
    sessionStorage.setItem(SS_PENDING, target)
  } catch {
    /* ignore */
  }
  window.location.replace(target)
}

export function OmniaAuthDeeplink() {
  useEffect(() => {
    if (!istOmniaNativeApp()) return
    let remove: (() => void) | undefined

    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        const launch = await App.getLaunchUrl()
        if (launch?.url) navigiere(launch.url)

        const handle = await App.addListener('appUrlOpen', ({ url }) => {
          navigiere(url)
        })
        remove = () => {
          void handle.remove()
        }
      } catch {
        /* Plugin fehlt / Web */
      }
    })()

    return () => remove?.()
  }, [])

  return null
}

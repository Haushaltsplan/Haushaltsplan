'use client'

/**
 * Speichert Deep-Link-URLs sofort in sessionStorage und navigiert zur Auth-Seite.
 */

import { istOmniaNativeApp } from '@/lib/omnia-native/omnia-native'
import { useEffect } from 'react'

const APP_ORIGIN =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '')) ||
  'https://haushaltsplan-blue.vercel.app'

const SS_PENDING = 'omnia-pending-auth-url'

const CUSTOM_SCHEMES = new Set(['de.omnia.haushalt', 'de.omnia.whoop'])

function zuAppAuthUrl(raw: string): string | null {
  try {
    // Manche Android-Intents liefern ungewöhnliche Strings
    const normalized = raw.includes('://') ? raw : `de.omnia.haushalt://${raw}`
    const u = new URL(normalized)
    const scheme = u.protocol.replace(':', '')
    const isCustom = CUSTOM_SCHEMES.has(scheme)
    const isHttpsAuth = u.protocol === 'https:' && u.pathname.includes('/auth')
    if (!isCustom && !isHttpsAuth) return null

    // Whoop: nur App öffnen / Login — ohne Tokens → Fitness (AuthGate)
    if (scheme === 'de.omnia.whoop') {
      const hostPath = `${u.host}${u.pathname}`.replace(/\/+/g, '/').toLowerCase()
      if (
        hostPath.includes('login') ||
        hostPath.includes('paste') ||
        hostPath === 'auth' ||
        hostPath === 'auth/' ||
        hostPath.startsWith('app/')
      ) {
        if (!u.searchParams.has('access_token') && !u.searchParams.has('omnia_code') && !u.hash.includes('access_token')) {
          return `${APP_ORIGIN}/fitnessdaten`
        }
      }
    }

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

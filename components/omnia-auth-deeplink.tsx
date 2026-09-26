'use client'

/**
 * Fängt Magic-Link / Custom-Scheme-URLs in der Omnia-APK ab und lädt
 * /auth/confirm in der WebView — Session landet in der App, nicht in Chrome.
 */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { useEffect } from 'react'

const APP_ORIGIN =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '')) ||
  'https://haushaltsplan-blue.vercel.app'

function zuHttpsConfirm(raw: string): string | null {
  try {
    const u = new URL(raw)
    const https = new URL(`${APP_ORIGIN}/auth/confirm`)

    // de.omnia.haushalt://auth/confirm?code=…
    if (u.protocol.replace(':', '') === 'de.omnia.haushalt' || u.host === 'auth') {
      u.searchParams.forEach((v, k) => https.searchParams.set(k, v))
      if (u.hash) https.hash = u.hash
      return https.toString()
    }

    // https://…/auth/confirm?…
    if (u.pathname.includes('/auth/confirm') || u.pathname.startsWith('/auth')) {
      u.searchParams.forEach((v, k) => https.searchParams.set(k, v))
      if (u.hash) https.hash = u.hash
      return https.toString()
    }
  } catch {
    /* ignore */
  }
  return null
}

function navigiereZuConfirm(raw: string) {
  const target = zuHttpsConfirm(raw)
  if (!target) return
  if (window.location.href.startsWith(target.split('#')[0]!)) return
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
        if (launch?.url) navigiereZuConfirm(launch.url)

        const handle = await App.addListener('appUrlOpen', ({ url }) => {
          navigiereZuConfirm(url)
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

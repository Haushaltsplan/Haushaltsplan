'use client'

/** Externe Links (mailto/tel/http) in Capacitor über Browser/Intent öffnen. */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { useEffect } from 'react'

export function OmniaExternalLinks() {
  useEffect(() => {
    if (!istOmniaNativeApp()) return

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a?.href) return
      const href = a.href
      const isMail = href.startsWith('mailto:')
      const isTel = href.startsWith('tel:')
      let externalHttp = false
      try {
        const u = new URL(href)
        externalHttp =
          (u.protocol === 'http:' || u.protocol === 'https:') &&
          u.host !== window.location.host
      } catch {
        return
      }
      if (!isMail && !isTel && !externalHttp) return
      // allowNavigation WHOOP/Strava bleiben in allowlist — hier nur echte Externe
      if (externalHttp && /(whoop\.com|strava\.com)/i.test(href)) return

      e.preventDefault()
      void (async () => {
        try {
          const { Browser } = await import('@capacitor/browser')
          if (isMail || isTel) {
            window.location.href = href
            return
          }
          await Browser.open({ url: href })
        } catch {
          window.open(href, '_blank', 'noopener,noreferrer')
        }
      })()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}

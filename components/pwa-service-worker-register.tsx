'use client'

import { useEffect } from 'react'

/**
 * Registriert /sw.js nur über HTTPS (oder localhost) — auf http://<LAN-IP>:3000
 * installieren die meisten Browser die PWA nicht.
 */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const { protocol, hostname } = window.location
    const sicher = protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1'
    if (!sicher) return
    const reg = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* z. B. 404 */
      })
    }
    if (document.readyState === 'complete') reg()
    else window.addEventListener('load', reg, { once: true })
  }, [])
  return null
}

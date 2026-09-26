'use client'

/** Android-Zurück: Modal/History, doppel-Back zum Beenden auf Root. */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

const ROOT_PATHS = new Set(['/', ''])

export function OmniaAndroidBack() {
  const pathname = usePathname()
  const router = useRouter()
  const lastBackRef = useRef(0)

  useEffect(() => {
    if (!istOmniaNativeApp()) return

    let remove: (() => void) | undefined

    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('backButton', ({ canGoBack }) => {
          void (async () => {
          // Offenes Dialog/Sheet schließen
          const openDialog = document.querySelector(
            '[data-omnia-confirm-open="true"], [data-app-modal-open="true"]',
          )
          if (openDialog) {
            openDialog.dispatchEvent(new CustomEvent('omnia-request-close'))
            return
          }

          // Drawer?
          const drawerClose = document.querySelector<HTMLElement>('[data-omnia-drawer-close]')
          if (drawerClose && document.body.classList.contains('omnia-drawer-open')) {
            drawerClose.click()
            return
          }

          if (canGoBack && !ROOT_PATHS.has(pathname ?? '')) {
            router.back()
            return
          }

          if (!ROOT_PATHS.has(pathname ?? '')) {
            router.push('/')
            return
          }

          const now = Date.now()
          if (now - lastBackRef.current < 1800) {
            void App.exitApp()
            return
          }
          lastBackRef.current = now
          try {
            const toast = (await import('react-hot-toast')).default
            toast('Nochmals zurück zum Beenden', { duration: 1600 })
          } catch {
            /* ignore */
          }
          })()
        })
        remove = () => void handle.remove()
      } catch {
        /* ignore */
      }
    })()

    return () => remove?.()
  }, [pathname, router])

  return null
}

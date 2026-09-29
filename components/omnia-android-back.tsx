'use client'

/** Android-Zurück: Modal/History, doppel-Back zum Beenden auf Root. */

import { istOmniaNativeApp, istOmniaWhoopApp } from '@/lib/omnia-native/omnia-native'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

const ROOT_PATHS = new Set(['/', ''])
const WHOOP_ROOT = new Set(['/fitnessdaten', '/'])

export function OmniaAndroidBack() {
  const pathname = usePathname()
  const router = useRouter()
  const lastBackRef = useRef(0)

  useEffect(() => {
    if (!istOmniaNativeApp()) return

    let remove: (() => void) | undefined
    const whoop = istOmniaWhoopApp()
    const roots = whoop ? WHOOP_ROOT : ROOT_PATHS

    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('backButton', ({ canGoBack }) => {
          void (async () => {
          const openDialog = document.querySelector(
            '[data-omnia-confirm-open="true"], [data-app-modal-open="true"]',
          )
          if (openDialog) {
            openDialog.dispatchEvent(new CustomEvent('omnia-request-close'))
            return
          }

          const drawerClose = document.querySelector<HTMLElement>('[data-omnia-drawer-close]')
          if (drawerClose && document.body.classList.contains('omnia-drawer-open')) {
            drawerClose.click()
            return
          }

          const path = pathname ?? ''
          const aufRoot = roots.has(path) || (whoop && path.startsWith('/auth'))

          if (canGoBack && !aufRoot) {
            router.back()
            return
          }

          if (!aufRoot) {
            router.replace(whoop ? '/fitnessdaten' : '/')
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

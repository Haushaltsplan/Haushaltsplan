'use client'

/**
 * Native Chrome: StatusBar, Splash, Keyboard-Insets, Theme-Sync.
 * Nur in der Capacitor-App aktiv.
 */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'

export function OmniaNativeChrome() {
  const { resolvedTheme } = useTheme()
  const splashHidden = useRef(false)

  useEffect(() => {
    if (!istOmniaNativeApp()) return

    let cancelled = false

    void (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        const dark = resolvedTheme !== 'light'
        await StatusBar.setOverlaysWebView({ overlay: true })
        await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
        try {
          await StatusBar.setBackgroundColor({ color: dark ? '#08090d' : '#f5f4f1' })
        } catch {
          /* overlay mode ignoriert Hintergrund oft */
        }
      } catch {
        /* Plugin fehlt in alter APK */
      }

      if (!splashHidden.current) {
        splashHidden.current = true
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen')
          // Kurz warten bis First Paint
          await new Promise((r) => setTimeout(r, 280))
          if (!cancelled) await SplashScreen.hide({ fadeOutDuration: 200 })
        } catch {
          /* ignore */
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [resolvedTheme])

  useEffect(() => {
    if (!istOmniaNativeApp()) return

    let removeShow: (() => void) | undefined
    let removeHide: (() => void) | undefined

    void (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard')
        const show = await Keyboard.addListener('keyboardWillShow', (info) => {
          document.documentElement.style.setProperty(
            '--omnia-keyboard-height',
            `${info.keyboardHeight}px`,
          )
          document.documentElement.classList.add('omnia-keyboard-open')
        })
        const hide = await Keyboard.addListener('keyboardWillHide', () => {
          document.documentElement.style.setProperty('--omnia-keyboard-height', '0px')
          document.documentElement.classList.remove('omnia-keyboard-open')
        })
        removeShow = () => void show.remove()
        removeHide = () => void hide.remove()
      } catch {
        /* fallback: visualViewport */
        const vv = window.visualViewport
        if (!vv) return
        const sync = () => {
          const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
          document.documentElement.style.setProperty('--omnia-keyboard-height', `${kh}px`)
          document.documentElement.classList.toggle('omnia-keyboard-open', kh > 80)
        }
        vv.addEventListener('resize', sync)
        vv.addEventListener('scroll', sync)
        removeShow = () => {
          vv.removeEventListener('resize', sync)
          vv.removeEventListener('scroll', sync)
        }
      }
    })()

    return () => {
      removeShow?.()
      removeHide?.()
      document.documentElement.style.setProperty('--omnia-keyboard-height', '0px')
      document.documentElement.classList.remove('omnia-keyboard-open')
    }
  }, [])

  return null
}

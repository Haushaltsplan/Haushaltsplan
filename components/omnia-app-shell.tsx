'use client'

/**
 * Shell für Omnia + Omnia Whoop.
 * Whoop: Haushalt-Chrome bleibt im DOM, wird per CSS (data-omnia-app=whoop) ausgeblendet —
 * vermeidet Hydration-Mismatch; Route-Lock hält die App auf /fitnessdaten.
 */

import { SiteMobileChrome } from '@/components/site-mobile-chrome'
import { SiteSidebar } from '@/components/site-sidebar'
import { MobileSwipePageNav } from '@/components/mobile-swipe-page-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { PaGlobalAktienSuche } from '@/components/portfolio-analyse/pa-global-aktien-suche'
import { Providers } from '@/app/providers'
import { istOmniaWhoopApp } from '@/lib/omnia-native/omnia-native'
import { useEffect, type ReactNode } from 'react'

export function OmniaAppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      const w = istOmniaWhoopApp()
      document.documentElement.dataset.omniaApp = w
        ? 'whoop'
        : /OmniaCapacitor/i.test(navigator.userAgent || '')
          ? 'haushalt'
          : 'web'
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <div data-omnia-haushalt-chrome className="contents">
        <SiteSidebar />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div data-omnia-haushalt-chrome className="contents">
          <SiteMobileChrome />
        </div>

        <header
          data-omnia-haushalt-chrome
          className="app-glass-bar sticky top-0 z-40 hidden h-12 shrink-0 items-center gap-4 overflow-visible border-b px-6 md:flex"
        >
          <PaGlobalAktienSuche className="mx-auto max-w-xl" />
          <ThemeToggle />
        </header>

        <Providers>
          <main
            id="app-main"
            className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-8 md:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <MobileSwipePageNav>{children}</MobileSwipePageNav>
          </main>
        </Providers>
      </div>
    </div>
  )
}

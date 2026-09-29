'use client'

import { OmniaNativeBoot } from '@/components/omnia-native-boot'
import { OmniaNativeChrome } from '@/components/omnia-native-chrome'
import { OmniaAuthDeeplink } from '@/components/omnia-auth-deeplink'
import { OmniaAndroidBack } from '@/components/omnia-android-back'
import { OmniaOfflineBanner } from '@/components/omnia-offline-banner'
import { OmniaErrorBoundary } from '@/components/omnia-error-boundary'
import { OmniaExternalLinks } from '@/components/omnia-external-links'
import { OmniaWhoopRouteLock } from '@/components/omnia-whoop-route-lock'
import { AppConfirmProvider } from '@/components/app-confirm'
import { PwaServiceWorkerRegister } from '@/components/pwa-service-worker-register'
import { TerminMorgenReminderRunner } from '@/components/termin-morgen-reminder'
import { AuthGate } from '@/components/auth-gate'
import { ZugriffGate } from '@/components/zugriff-gate'
import { AppLockGate } from '@/components/app-lock-gate'
import { ClientStateBootstrap } from '@/components/client-state-bootstrap'
import { ClientStateThemeSync } from '@/components/client-state-theme-sync'
import { installApiAuth } from '@/lib/api-auth-client'
import { sichereSpeicherplatzFuerAuth } from '@/lib/local-storage-safe'
import { istOmniaWhoopApp } from '@/lib/omnia-native/omnia-native'
import { useEffect, useState, type ReactNode } from 'react'

// Token-Anhang für /api-Aufrufe einmalig installieren (vor dem ersten Request).
if (typeof window !== 'undefined') {
  installApiAuth()
  try {
    sichereSpeicherplatzFuerAuth()
  } catch {
    /* ignore */
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [whoopApp, setWhoopApp] = useState(false)

  useEffect(() => {
    installApiAuth()
    try {
      sichereSpeicherplatzFuerAuth()
    } catch {
      /* ignore */
    }
    setWhoopApp(istOmniaWhoopApp())
  }, [])

  return (
    <>
      <OmniaNativeBoot />
      <OmniaNativeChrome />
      <OmniaAuthDeeplink />
      <OmniaWhoopRouteLock />
      <OmniaAndroidBack />
      <OmniaExternalLinks />
      <OmniaErrorBoundary>
        <AppConfirmProvider>
          <AuthGate>
            <AppLockGate>
              <ZugriffGate>
                <ClientStateBootstrap />
                <ClientStateThemeSync />
                <OmniaOfflineBanner />
                {children}
              </ZugriffGate>
            </AppLockGate>
          </AuthGate>
        </AppConfirmProvider>
      </OmniaErrorBoundary>
      <PwaServiceWorkerRegister />
      {!whoopApp ? <TerminMorgenReminderRunner /> : null}
    </>
  )
}

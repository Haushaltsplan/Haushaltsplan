'use client'

import { OmniaNativeBoot } from '@/components/omnia-native-boot'
import { OmniaNativeChrome } from '@/components/omnia-native-chrome'
import { OmniaAuthDeeplink } from '@/components/omnia-auth-deeplink'
import { OmniaAndroidBack } from '@/components/omnia-android-back'
import { OmniaOfflineBanner } from '@/components/omnia-offline-banner'
import { OmniaErrorBoundary } from '@/components/omnia-error-boundary'
import { OmniaExternalLinks } from '@/components/omnia-external-links'
import { AppConfirmProvider } from '@/components/app-confirm'
import { WhoopBleProvider } from '@/components/fitnessdaten/whoop-ble-provider'
import { WhoopCloudAutoSyncRunner } from '@/components/fitnessdaten/whoop-cloud-auto-sync'
import { WhoopBleBackgroundSyncRegister } from '@/components/fitnessdaten/whoop-ble-background-sync'
import { PwaServiceWorkerRegister } from '@/components/pwa-service-worker-register'
import { TerminMorgenReminderRunner } from '@/components/termin-morgen-reminder'
import { AuthGate } from '@/components/auth-gate'
import { ZugriffGate } from '@/components/zugriff-gate'
import { AppLockGate } from '@/components/app-lock-gate'
import { ClientStateBootstrap } from '@/components/client-state-bootstrap'
import { ClientStateThemeSync } from '@/components/client-state-theme-sync'
import { installApiAuth } from '@/lib/api-auth-client'
import { kompaktierenDailyStoreFallsNoetig } from '@/lib/fitnessdaten/daily-records'
import { sichereSpeicherplatzFuerAuth } from '@/lib/local-storage-safe'
import { useEffect, type ReactNode } from 'react'

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
  useEffect(() => {
    installApiAuth()
    try {
      sichereSpeicherplatzFuerAuth()
      kompaktierenDailyStoreFallsNoetig()
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <>
      <OmniaNativeBoot />
      <OmniaNativeChrome />
      <OmniaAuthDeeplink />
      <OmniaAndroidBack />
      <OmniaExternalLinks />
      <WhoopBleProvider>
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
      <WhoopBleBackgroundSyncRegister />
      <WhoopCloudAutoSyncRunner />
      <TerminMorgenReminderRunner />
      </WhoopBleProvider>
    </>
  )
}

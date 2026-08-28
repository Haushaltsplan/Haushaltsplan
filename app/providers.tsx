'use client'

import { OmniaNativeBoot } from '@/components/omnia-native-boot'
import { WhoopBleProvider } from '@/components/fitnessdaten/whoop-ble-provider'
import { WhoopCloudAutoSyncRunner } from '@/components/fitnessdaten/whoop-cloud-auto-sync'
import { WhoopBleBackgroundSyncRegister } from '@/components/fitnessdaten/whoop-ble-background-sync'
import { PwaServiceWorkerRegister } from '@/components/pwa-service-worker-register'
import { FuehrungErinnerungenWatcher } from '@/components/fuehrung/fuehrung-erinnerungen-watcher'
import { TerminMorgenReminderRunner } from '@/components/termin-morgen-reminder'
import { AuthGate } from '@/components/auth-gate'
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
      <WhoopBleProvider>
      <AuthGate>
        <AppLockGate>
          <ClientStateBootstrap />
          <ClientStateThemeSync />
          {children}
        </AppLockGate>
      </AuthGate>
      <PwaServiceWorkerRegister />
      <WhoopBleBackgroundSyncRegister />
      <WhoopCloudAutoSyncRunner />
      <TerminMorgenReminderRunner />
      <FuehrungErinnerungenWatcher />
      </WhoopBleProvider>
    </>
  )
}

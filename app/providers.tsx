'use client'

import { KalenderCloudBootstrap } from '@/components/kalender-cloud-bootstrap'
import { WhoopBleProvider } from '@/components/fitnessdaten/whoop-ble-provider'
import { WhoopCloudAutoSyncRunner } from '@/components/fitnessdaten/whoop-cloud-auto-sync'
import { WhoopBleBackgroundSyncRegister } from '@/components/fitnessdaten/whoop-ble-background-sync'
import { PwaServiceWorkerRegister } from '@/components/pwa-service-worker-register'
import { TerminMorgenReminderRunner } from '@/components/termin-morgen-reminder'
import { AuthGate } from '@/components/auth-gate'
import { AppLockGate } from '@/components/app-lock-gate'
import { installApiAuth } from '@/lib/api-auth-client'
import { useEffect, type ReactNode } from 'react'

// Token-Anhang für /api-Aufrufe einmalig installieren (vor dem ersten Request).
if (typeof window !== 'undefined') {
  installApiAuth()
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    installApiAuth()
  }, [])

  return (
    <WhoopBleProvider>
      <AuthGate>
        <AppLockGate>{children}</AppLockGate>
      </AuthGate>
      <PwaServiceWorkerRegister />
      <WhoopBleBackgroundSyncRegister />
      <KalenderCloudBootstrap />
      <WhoopCloudAutoSyncRunner />
      <TerminMorgenReminderRunner />
    </WhoopBleProvider>
  )
}

'use client'

import { KalenderCloudBootstrap } from '@/components/kalender-cloud-bootstrap'
import { PwaServiceWorkerRegister } from '@/components/pwa-service-worker-register'
import { TerminMorgenReminderRunner } from '@/components/termin-morgen-reminder'
import { AuthGate } from '@/components/auth-gate'
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
    <>
      <AuthGate>{children}</AuthGate>
      <PwaServiceWorkerRegister />
      <KalenderCloudBootstrap />
      <TerminMorgenReminderRunner />
    </>
  )
}

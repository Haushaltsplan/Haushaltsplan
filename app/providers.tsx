'use client'

import { KalenderCloudBootstrap } from '@/components/kalender-cloud-bootstrap'
import { PwaServiceWorkerRegister } from '@/components/pwa-service-worker-register'
import { TerminMorgenReminderRunner } from '@/components/termin-morgen-reminder'
import { AuthGate } from '@/components/auth-gate'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthGate>{children}</AuthGate>
      <PwaServiceWorkerRegister />
      <KalenderCloudBootstrap />
      <TerminMorgenReminderRunner />
    </>
  )
}

'use client'

import { KalenderCloudBootstrap } from '@/components/kalender-cloud-bootstrap'
import { TerminMorgenReminderRunner } from '@/components/termin-morgen-reminder'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <KalenderCloudBootstrap />
      <TerminMorgenReminderRunner />
    </>
  )
}

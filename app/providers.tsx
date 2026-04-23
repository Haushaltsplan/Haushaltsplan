'use client'

import { FinanceCoachProvider } from '@/components/finance-coach'
import { KalenderCloudBootstrap } from '@/components/kalender-cloud-bootstrap'
import { TerminMorgenReminderRunner } from '@/components/termin-morgen-reminder'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FinanceCoachProvider>
      {children}
      <KalenderCloudBootstrap />
      <TerminMorgenReminderRunner />
    </FinanceCoachProvider>
  )
}

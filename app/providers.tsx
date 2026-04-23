'use client'

import { FinanceCoachProvider } from '@/components/finance-coach'
import { TerminMorgenReminderRunner } from '@/components/termin-morgen-reminder'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FinanceCoachProvider>
      {children}
      <TerminMorgenReminderRunner />
    </FinanceCoachProvider>
  )
}

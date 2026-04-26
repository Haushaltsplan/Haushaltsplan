import { FinanceCoachProvider } from '@/components/finance-coach'
import type { ReactNode } from 'react'

export default function FinanzenLayout({ children }: { children: ReactNode }) {
  return <FinanceCoachProvider>{children}</FinanceCoachProvider>
}

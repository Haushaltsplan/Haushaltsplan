import { PaDataProvider } from '@/components/portfolio-analyse/pa-data-provider'
import type { ReactNode } from 'react'

export default function PortfolioanalyseLayout({ children }: { children: ReactNode }) {
  return <PaDataProvider>{children}</PaDataProvider>
}

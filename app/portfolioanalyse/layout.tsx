import { PaDataProvider } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioBeraterProvider } from '@/components/portfolio-analyse/portfolio-berater'
import type { ReactNode } from 'react'

export default function PortfolioanalyseLayout({ children }: { children: ReactNode }) {
  return (
    <PaDataProvider>
      <PortfolioBeraterProvider>{children}</PortfolioBeraterProvider>
    </PaDataProvider>
  )
}

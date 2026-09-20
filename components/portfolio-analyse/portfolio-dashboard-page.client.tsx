'use client'

import { PortfolioDashboardClient } from '@/components/portfolio-analyse/portfolio-dashboard.client'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaInvestorTageszitat } from '@/components/portfolio-analyse/pa-investor-tageszitat'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'

export function PortfolioDashboardPageClient() {
  const { schemaFehlt, hatDaten } = usePortfolioAnalyse()

  return (
    <PortfolioAnalyseShell title="Dashboard">
      <PaInvestorTageszitat />
      {!schemaFehlt && hatDaten ? <PortfolioDashboardClient /> : null}
    </PortfolioAnalyseShell>
  )
}

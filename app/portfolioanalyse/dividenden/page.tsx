import type { Metadata } from 'next'
import { PortfolioAnalysePageClient } from '@/components/portfolio-analyse/portfolio-analyse-subpage.client'

export const metadata: Metadata = {
  title: 'Dividenden · Portfolioanalyse',
}

export default function PortfolioDividendenPage() {
  return (
    <PortfolioAnalysePageClient
      titel="Dividenden Dashboard"
      phase="Phase 5 (Dividenden-KPIs & Heatmap)"
      beschreibung="Erhaltene Dividenden, persönliche Div-Rendite, Prognose und monatliche Heatmap."
    />
  )
}

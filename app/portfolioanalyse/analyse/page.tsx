import type { Metadata } from 'next'
import { PortfolioAnalysePageClient } from '@/components/portfolio-analyse/portfolio-analyse-subpage.client'

export const metadata: Metadata = {
  title: 'Analyse · Portfolioanalyse',
}

export default function PortfolioAnalyseSubPage() {
  return (
    <PortfolioAnalysePageClient
      titel="Portfolioanalyse"
      phase="Phase 3 (Gewichtung, Rendite-Heatmap, Performance Map)"
      beschreibung="Gewichtungsanalyse, Rendite-Details, Kapitalfluss und Steuer-Dashboard — analog zu Parqet."
    />
  )
}

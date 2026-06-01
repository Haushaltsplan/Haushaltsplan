import type { Metadata } from 'next'
import { PortfolioAnalysePageClient } from '@/components/portfolio-analyse-page.client'

export const metadata: Metadata = {
  title: 'Portfolioanalyse',
  description: 'Trade Republic Depot — lokal parsen, anonymisiert auswerten',
}

export default function PortfolioanalysePage() {
  return <PortfolioAnalysePageClient />
}

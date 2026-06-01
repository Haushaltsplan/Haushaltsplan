import type { Metadata } from 'next'
import { PortfolioAnalyseMainClient } from '@/components/portfolio-analyse/portfolio-analyse-main.client'

export const metadata: Metadata = {
  title: 'Analyse · Portfolioanalyse',
}

export default function PortfolioAnalysePage() {
  return <PortfolioAnalyseMainClient />
}

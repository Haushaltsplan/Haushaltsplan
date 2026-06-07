import type { Metadata } from 'next'
import { PortfolioFundamentaldatenClient } from '@/components/portfolio-analyse/portfolio-fundamentaldaten.client'

export const metadata: Metadata = {
  title: 'Fundamentaldaten · Portfolioanalyse',
}

export default function PortfolioFundamentaldatenPage() {
  return <PortfolioFundamentaldatenClient />
}

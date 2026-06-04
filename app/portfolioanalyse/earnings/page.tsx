import type { Metadata } from 'next'
import { PortfolioEarningsDashboardClient } from '@/components/portfolio-analyse/portfolio-earnings-dashboard.client'

export const metadata: Metadata = {
  title: 'Quartalszahlen · Portfolioanalyse',
}

export default function PortfolioEarningsPage() {
  return <PortfolioEarningsDashboardClient />
}

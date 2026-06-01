import type { Metadata } from 'next'
import { PortfolioDividendenDashboardClient } from '@/components/portfolio-analyse/portfolio-dividenden-dashboard.client'

export const metadata: Metadata = {
  title: 'Dividenden · Portfolioanalyse',
}

export default function PortfolioDividendenPage() {
  return <PortfolioDividendenDashboardClient />
}

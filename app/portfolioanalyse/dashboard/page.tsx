import type { Metadata } from 'next'
import { PortfolioDashboardPageClient } from '@/components/portfolio-analyse/portfolio-dashboard-page.client'

export const metadata: Metadata = {
  title: 'Dashboard · Portfolioanalyse',
}

export default function PortfolioDashboardPage() {
  return <PortfolioDashboardPageClient />
}

import type { Metadata } from 'next'
import { PortfolioBoerseClient } from '@/components/portfolio-analyse/portfolio-boerse.client'

export const metadata: Metadata = {
  title: 'Börse · Portfolioanalyse',
}

export default function PortfolioBoersePage() {
  return <PortfolioBoerseClient />
}

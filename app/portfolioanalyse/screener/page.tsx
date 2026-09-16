import type { Metadata } from 'next'
import { PortfolioScreenerClient } from '@/components/portfolio-analyse/portfolio-screener.client'

export const metadata: Metadata = {
  title: 'Aktienscreener · Portfolioanalyse',
}

export default function PortfolioScreenerPage() {
  return <PortfolioScreenerClient />
}

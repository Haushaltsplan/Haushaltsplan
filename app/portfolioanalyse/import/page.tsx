import type { Metadata } from 'next'
import { PortfolioImportClient } from '@/components/portfolio-analyse/portfolio-import.client'

export const metadata: Metadata = {
  title: 'Import · Portfolioanalyse',
}

export default function PortfolioImportPage() {
  return <PortfolioImportClient />
}

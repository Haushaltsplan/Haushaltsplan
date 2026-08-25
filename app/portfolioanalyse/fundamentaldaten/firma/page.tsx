import type { Metadata } from 'next'
import { PortfolioDepotFirmaClient } from '@/components/portfolio-analyse/portfolio-depot-firma.client'

export const metadata: Metadata = {
  title: 'Depot als Firma · Portfolioanalyse',
}

export default function PortfolioDepotFirmaPage() {
  return <PortfolioDepotFirmaClient />
}

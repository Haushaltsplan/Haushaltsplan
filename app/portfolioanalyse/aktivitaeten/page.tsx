import type { Metadata } from 'next'
import { PortfolioAktivitaetenClient } from '@/components/portfolio-analyse/portfolio-aktivitaeten.client'

export const metadata: Metadata = {
  title: 'Aktivitäten · Portfolioanalyse',
}

export default function PortfolioAktivitaetenPage() {
  return <PortfolioAktivitaetenClient />
}

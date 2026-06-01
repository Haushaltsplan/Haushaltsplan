import type { Metadata } from 'next'
import { PortfolioAnalysePageClient } from '@/components/portfolio-analyse/portfolio-analyse-subpage.client'

export const metadata: Metadata = {
  title: 'Aktivitäten · Portfolioanalyse',
}

export default function PortfolioAktivitaetenPage() {
  return (
    <PortfolioAnalysePageClient
      titel="Aktivitäten"
      phase="Phase 5 (gruppierte Transaktionsliste)"
      beschreibung="Alle Käufe, Verkäufe und Dividenden nach Jahr und Monat — mit Filtern und CSV-Export."
    />
  )
}

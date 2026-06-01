import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Portfolioanalyse',
  description: 'Trade Republic Depot — lokal parsen, anonymisiert auswerten',
}

export default function PortfolioanalyseRootPage() {
  redirect('/portfolioanalyse/dashboard')
}

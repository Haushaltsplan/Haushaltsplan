import type { Metadata } from 'next'
import { PortfolioDcfClient } from '@/components/portfolio-analyse/portfolio-dcf.client'

export const metadata: Metadata = {
  title: 'DCF-Rechner · Portfolioanalyse',
}

export default function PortfolioDcfPage() {
  return <PortfolioDcfClient />
}

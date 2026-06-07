import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PortfolioFundamentaldatenClient } from '@/components/portfolio-analyse/portfolio-fundamentaldaten.client'

export const metadata: Metadata = {
  title: 'Fundamentaldaten · Portfolioanalyse',
}

export default function PortfolioFundamentaldatenPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-zinc-500">Fundamentaldaten werden geladen …</p>}>
      <PortfolioFundamentaldatenClient />
    </Suspense>
  )
}

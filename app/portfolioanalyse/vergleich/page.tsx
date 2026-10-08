import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PortfolioTitelVergleichClient } from '@/components/portfolio-analyse/portfolio-titel-vergleich.client'

export const metadata: Metadata = {
  title: 'Titelvergleich · Portfolioanalyse',
}

export default function PortfolioTitelVergleichPage() {
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-[var(--app-text-muted)]">Vergleich wird geladen …</p>
      }
    >
      <PortfolioTitelVergleichClient />
    </Suspense>
  )
}

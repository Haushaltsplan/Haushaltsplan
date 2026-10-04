import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PortfolioDcfClient } from '@/components/portfolio-analyse/portfolio-dcf.client'

export const metadata: Metadata = {
  title: 'DCF-Rechner · Portfolioanalyse',
}

export default function PortfolioDcfPage() {
  return (
    <Suspense
      fallback={<p className="py-16 text-center text-sm text-[var(--app-text-muted)]">DCF-Rechner wird geladen …</p>}
    >
      <PortfolioDcfClient />
    </Suspense>
  )
}

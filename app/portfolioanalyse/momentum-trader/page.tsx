import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MomentumTraderClient } from '@/components/portfolio-analyse/portfolio-momentum-trader.client'

export const metadata: Metadata = {
  title: 'Momentum Trader · Portfolioanalyse',
}

export default function MomentumTraderPage() {
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-[var(--app-text-muted)]">Momentum Trader wird geladen …</p>
      }
    >
      <MomentumTraderClient />
    </Suspense>
  )
}

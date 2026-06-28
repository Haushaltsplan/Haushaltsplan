import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PortfolioWatchlistClient } from '@/components/portfolio-analyse/portfolio-watchlist.client'

export const metadata: Metadata = {
  title: 'Watchlist · Portfolioanalyse',
}

export default function PortfolioWatchlistPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-[var(--app-text-muted)]">Watchlist wird geladen …</p>}>
      <PortfolioWatchlistClient />
    </Suspense>
  )
}

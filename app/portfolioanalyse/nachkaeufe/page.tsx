import type { Metadata } from 'next'
import { Suspense } from 'react'
import { NachkaufRadarClient } from '@/components/portfolio-analyse/portfolio-nachkaeufe.client'

export const metadata: Metadata = {
  title: 'Nachkauf-Radar · Portfolioanalyse',
}

export default function NachkaufRadarPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-[var(--app-text-muted)]">Nachkauf-Radar wird geladen …</p>}>
      <NachkaufRadarClient />
    </Suspense>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FitnessdatenClient } from '@/components/fitnessdaten/fitnessdaten-client'
import { FitnessdatenOmniaGate } from '@/components/fitnessdaten/fitnessdaten-omnia-gate'

export const metadata: Metadata = {
  title: 'Whoop',
  description: 'Omnia Whoop — Recovery, Strain, Vitalwerte und Live-Puls vom Band.',
}

function WhoopLadenFallback() {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center gap-3 px-4 py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" />
      <p className="text-sm text-[var(--app-text-muted)]">Whoop wird geladen …</p>
    </div>
  )
}

export default function FitnessdatenPage() {
  return (
    <Suspense fallback={<WhoopLadenFallback />}>
      <FitnessdatenOmniaGate>
        <FitnessdatenClient />
      </FitnessdatenOmniaGate>
    </Suspense>
  )
}

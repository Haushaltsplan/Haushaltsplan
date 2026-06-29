import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FitnessdatenClient } from '@/components/fitnessdaten/fitnessdaten-client'

export const metadata: Metadata = {
  title: 'Whoop',
  description: 'WHOOP 5.0 in Omnia — Recovery, Strain, Vitalwerte, Verläufe und Live-Puls.',
}

export default function FitnessdatenPage() {
  return (
    <Suspense fallback={null}>
      <FitnessdatenClient />
    </Suspense>
  )
}

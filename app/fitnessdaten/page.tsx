import { FitnessdatenClient } from '@/components/fitnessdaten/fitnessdaten-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fitnessdaten · WHOOP',
  description: 'WHOOP 5.0 lokal in Omnia — Recovery, Strain, Live-Puls und HRV ohne Abo.',
}

export default function FitnessdatenPage() {
  return <FitnessdatenClient />
}

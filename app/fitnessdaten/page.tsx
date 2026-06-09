import { FitnessdatenClient } from '@/components/fitnessdaten/fitnessdaten-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Whoop',
  description: 'WHOOP 5.0 in Omnia — Recovery, Strain, Vitalwerte, Verläufe und Live-Puls.',
}

export default function FitnessdatenPage() {
  return <FitnessdatenClient />
}

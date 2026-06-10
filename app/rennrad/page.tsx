import type { Metadata } from 'next'
import { StravaDashboard } from '@/components/strava-dashboard'

export const metadata: Metadata = {
  title: 'Rennrad',
  description: 'Strava-Radaktivitäten: Jahrestrends, persönliche Bestleistungen und Watt pro Kilogramm.',
}

export default function RennradPage() {
  return <StravaDashboard />
}

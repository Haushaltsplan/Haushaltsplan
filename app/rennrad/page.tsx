import type { Metadata } from 'next'
import { RennradRoutenClient } from '@/components/rennrad-routen-client'

export const metadata: Metadata = {
  title: 'Rennrad',
  description:
    'Routen für Rennrad planen: GPX für Garmin Connect (OpenStreetMap). Hinweise zu Climbfinder und Import.',
}

export default function RennradPage() {
  return <RennradRoutenClient />
}

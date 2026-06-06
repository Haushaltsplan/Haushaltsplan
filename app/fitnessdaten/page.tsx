import { FitnessdatenClient } from '@/components/fitnessdaten/fitnessdaten-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fitnessdaten',
  description:
    'WHOOP-Wearable-Daten lokal auslesen und visualisieren — abofrei über BLE (Flutter-App) und Dashboard in mein-haushalt.',
}

export default function FitnessdatenPage() {
  return <FitnessdatenClient />
}

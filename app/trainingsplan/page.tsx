import type { Metadata } from 'next'
import { TrainingsplanClient } from '@/components/trainingsplan/trainingsplan-client'

export const metadata: Metadata = {
  title: 'Trainingsplan',
  description:
    'Personal Coach: Kraft mit Hanteln & Rudergerät, Rennrad-Plan und Fortschritt bis Ende Februar 2027.',
}

export default function TrainingsplanPage() {
  return <TrainingsplanClient />
}

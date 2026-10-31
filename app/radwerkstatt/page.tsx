import type { Metadata } from 'next'
import { RadwerkstattSeite } from '@/components/radwerkstatt/radwerkstatt.client'

export const metadata: Metadata = {
  title: 'Radwerkstatt',
  description: 'Werkzeug und Verbrauchsmaterial fürs Rennrad: Bestand, Kosten, Bilder und Wunsch-/Bedarfsliste.',
}

export default function RadwerkstattPage() {
  return <RadwerkstattSeite />
}

import type { Metadata } from 'next'
import { EtsyKiAgentClient } from '@/components/etsy/etsy-ki-agent.client'

export const metadata: Metadata = {
  title: 'Etsy KI Agent',
  description: 'KI-Agent für Etsy-Drafts: Fotos analysieren, SEO-Texte erzeugen, Entwurf anlegen.',
}

export default function EtsyKiAgentPage() {
  return <EtsyKiAgentClient />
}

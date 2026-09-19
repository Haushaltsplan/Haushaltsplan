import type { Metadata } from 'next'
import { EtsyHubClient } from '@/components/etsy/etsy-hub.client'

export const metadata: Metadata = {
  title: 'Etsy',
  description: 'Etsy KI Agent (Drafts) und SEO/GEO-Überwachung für bestehende Listings.',
}

export default function EtsyKiAgentPage() {
  return <EtsyHubClient />
}

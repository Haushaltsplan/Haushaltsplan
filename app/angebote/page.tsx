import type { Metadata } from 'next'

import { AngeboteClient } from '@/components/angebote/angebote.client'

export const metadata: Metadata = {
  title: 'Angebote',
}

export default function AngebotePage() {
  return <AngeboteClient />
}

import type { Metadata } from 'next'
import { YoutubeShortsClient } from '@/components/youtube/youtube-shorts.client'

export const metadata: Metadata = {
  title: 'YouTube',
  description: 'Moat-Check-Shorts aus dem Fundamentaldaten-Export erstellen.',
}

export default function YoutubePage() {
  return <YoutubeShortsClient />
}

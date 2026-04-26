import type { Metadata } from 'next'
import { NaturBestimmenClient } from '@/components/natur-bestimmen-client'

export const metadata: Metadata = {
  title: 'Natur bestimmen',
  description: 'Foto: Tiere, Pflanzen und Pilze mit KI ansprechen (Hinweis: keine Fach- oder Essbarkeitsgarantie).',
}

export default function NaturPage() {
  return <NaturBestimmenClient />
}

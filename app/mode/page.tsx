import type { Metadata } from 'next'
import { ModeBerater } from '@/components/modeberater/mode-berater'

export const metadata: Metadata = {
  title: 'Modeberater',
  description: 'Persönlicher KI-Stylist: Profil, Fotos und Kleidung bewerten lassen.',
}

export default function ModePage() {
  return <ModeBerater />
}

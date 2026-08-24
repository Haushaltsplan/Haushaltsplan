import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Modeberater',
  description: 'KI-Stylist mit Profil, Fotos und Shop-Links — kostenloses Gemini-Kontingent.',
}

export default function ModeLayout({ children }: { children: React.ReactNode }) {
  return children
}

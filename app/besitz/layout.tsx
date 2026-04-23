import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Besitz',
  description: 'Eigene Gegenstände mit Einkaufspreis — Kleidung, Schuhe, Elektronik und mehr.',
}

export default function BesitzLayout({ children }: { children: React.ReactNode }) {
  return children
}

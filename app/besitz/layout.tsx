import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Besitz',
  description: 'Gegenstände mit Einkaufspreis',
}

export default function BesitzLayout({ children }: { children: React.ReactNode }) {
  return children
}

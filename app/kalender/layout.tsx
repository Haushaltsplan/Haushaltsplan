import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kalender',
  description: 'Termine und Erinnerungen im Monatsraster',
}

export default function KalenderLayout({ children }: { children: React.ReactNode }) {
  return children
}

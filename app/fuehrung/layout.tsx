import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Führung',
  description: 'Mantra, Führungs-Plan (inkl. Urlaubspause) und Werkzeuge für deine Führungsrolle.',
}

export default function FuehrungLayout({ children }: { children: React.ReactNode }) {
  return children
}

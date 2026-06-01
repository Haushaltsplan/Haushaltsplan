'use client'

import { PaCard } from '@/components/portfolio-analyse/pa-ui'

export function PortfolioPlaceholder({ titel, phase }: { titel: string; phase: string }) {
  return (
    <PaCard className="p-8">
      <h2 className="text-lg font-semibold text-zinc-100">{titel}</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Dieser Bereich kommt in <strong className="font-medium text-teal-400/90">{phase}</strong> — Navigation und
        Dashboard sind bereits vorbereitet.
      </p>
    </PaCard>
  )
}

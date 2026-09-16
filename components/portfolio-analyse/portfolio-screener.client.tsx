'use client'

import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'

export function PortfolioScreenerClient() {
  return (
    <PortfolioAnalyseShell
      title="Aktienscreener"
      description="Qualitätstitel nach Kennzahlen filtern — unabhängig vom Depot."
    >
      <PaCard className="px-6 py-16 text-center sm:px-10">
        <p className="text-lg font-semibold tracking-tight text-[var(--app-text)]">Coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--app-text-muted)]">
          Die Seite steht. Filter, Universum und Datenanbindung kommen, sobald die Premium-Quelle eingerichtet ist.
        </p>
      </PaCard>
    </PortfolioAnalyseShell>
  )
}

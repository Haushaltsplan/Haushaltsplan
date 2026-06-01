'use client'

import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PortfolioPlaceholder } from '@/components/portfolio-analyse/portfolio-placeholder.client'
import { PageSection, PageSectionPanel } from '@/components/page-shell'

export function PortfolioAnalysePageClient({
  titel,
  phase,
  beschreibung,
}: {
  titel: string
  phase: string
  beschreibung: string
}) {
  return (
    <PortfolioAnalyseShell title={titel} description={beschreibung}>
      <PageSection titleId="pa-placeholder-heading" title={titel}>
        <PageSectionPanel>
          <PortfolioPlaceholder titel={titel} phase={phase} />
        </PageSectionPanel>
      </PageSection>
    </PortfolioAnalyseShell>
  )
}

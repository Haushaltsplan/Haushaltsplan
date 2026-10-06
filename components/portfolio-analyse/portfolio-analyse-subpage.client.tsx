'use client'

import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PortfolioPlaceholder } from '@/components/portfolio-analyse/portfolio-placeholder.client'
import { PageSection, PageSectionPanel } from '@/components/page-shell'

export function PortfolioAnalysePageClient({
  titel,
  phase,
}: {
  titel: string
  phase: string
}) {
  return (
    <PortfolioAnalyseShell title={titel}>
      <PageSection titleId="pa-placeholder-heading" title={titel}>
        <PageSectionPanel>
          <PortfolioPlaceholder titel={titel} phase={phase} />
        </PageSectionPanel>
      </PageSection>
    </PortfolioAnalyseShell>
  )
}

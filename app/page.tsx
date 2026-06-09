import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageChrome, PageSection, PageSectionPanel } from '@/components/page-shell'
import { parseWetterOrtId, REGION_HAARBACH } from '@/lib/region-haarbach'
import { StartWhoopPanel } from '@/components/start-whoop-panel'
import {
  StartNewsPortfolioPanel,
  StartNewsRennradPanel,
  StartNewsUmgebungPanel,
  StartNewsWinterPanel,
  StartRegionBlock,
} from '@/components/start-uebersicht-streaming'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Start',
  description: `Region & Übersicht — ${REGION_HAARBACH.name}, ${REGION_HAARBACH.kreis}`,
}

function StartRegionSkeleton() {
  return (
    <PageSection titleId="start-region-heading" title="Region & Wetter" density="compact">
      <PageSectionPanel density="compact">
        <div className="mb-3 h-3 w-44 animate-pulse rounded bg-zinc-800/70" />
        <div className="h-36 animate-pulse rounded-xl bg-zinc-900/55 sm:h-40" />
      </PageSectionPanel>
    </PageSection>
  )
}

function StartNewsPanelSkeleton() {
  return (
    <PageSectionPanel density="compact">
      <div className="h-10 animate-pulse rounded-lg bg-zinc-900/70" />
    </PageSectionPanel>
  )
}

type StartPageProps = { searchParams?: Promise<{ ort?: string }> }

export default async function StartUebersichtPage({ searchParams }: StartPageProps) {
  const sp = searchParams != null ? await searchParams : {}
  const ortId = parseWetterOrtId(sp.ort)

  return (
    <PageChrome density="compact">
      <Suspense fallback={<StartRegionSkeleton />}>
        <StartRegionBlock ortId={ortId} />
      </Suspense>

      <PageSection titleId="start-whoop-heading" title="Whoop" density="compact">
        <StartWhoopPanel />
      </PageSection>

      <PageSection titleId="start-news-heading" title="News & Sport" density="compact">
        <Suspense fallback={<StartNewsPanelSkeleton />}>
          <StartNewsUmgebungPanel />
        </Suspense>
        <Suspense fallback={<StartNewsPanelSkeleton />}>
          <StartNewsPortfolioPanel />
        </Suspense>
        <Suspense fallback={<StartNewsPanelSkeleton />}>
          <StartNewsRennradPanel />
        </Suspense>
        <Suspense fallback={<StartNewsPanelSkeleton />}>
          <StartNewsWinterPanel />
        </Suspense>
      </PageSection>
    </PageChrome>
  )
}

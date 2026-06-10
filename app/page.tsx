import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageChrome, PageSection } from '@/components/page-shell'
import {
  StartFinanzenKompakt,
  StartKalenderKompakt,
  StartPortfolioKompakt,
  StartWhoopKompakt,
} from '@/components/start-home-kompakt'
import { StartWetterKompakt } from '@/components/start-wetter-kompakt'
import { parseWetterOrtId, REGION_HAARBACH } from '@/lib/region-haarbach'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Start',
  description: `Übersicht — ${REGION_HAARBACH.name}, ${REGION_HAARBACH.kreis}`,
}

function StartBlockSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 px-4 py-6">
      <div className="h-4 w-32 animate-pulse rounded bg-zinc-800/80" />
      <div className="mt-4 h-16 animate-pulse rounded-xl bg-zinc-900/60" />
    </div>
  )
}

type StartPageProps = { searchParams?: Promise<{ ort?: string }> }

export default async function StartUebersichtPage({ searchParams }: StartPageProps) {
  const sp = searchParams != null ? await searchParams : {}
  const ortId = parseWetterOrtId(sp.ort)

  return (
    <PageChrome density="compact">
      <Suspense fallback={<StartBlockSkeleton />}>
        <StartWetterKompakt ortId={ortId} />
      </Suspense>

      <PageSection titleId="start-kalender-heading" title="Kalender" density="compact">
        <StartKalenderKompakt />
      </PageSection>

      <PageSection titleId="start-whoop-heading" title="WHOOP" density="compact">
        <StartWhoopKompakt />
      </PageSection>

      <PageSection titleId="start-portfolio-heading" title="Portfolio" density="compact">
        <Suspense fallback={<StartBlockSkeleton />}>
          <StartPortfolioKompakt />
        </Suspense>
      </PageSection>

      <PageSection titleId="start-finanzen-heading" title="Finanzen" density="compact">
        <StartFinanzenKompakt />
      </PageSection>
    </PageChrome>
  )
}

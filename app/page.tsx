import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageChrome } from '@/components/page-shell'
import {
  StartFinanzenKompakt,
  StartKalenderKompakt,
  StartPortfolioKompakt,
  StartWhoopKompakt,
} from '@/components/start-home-kompakt'
import { StartHero } from '@/components/start-home-ui'
import { StartWetterKompakt } from '@/components/start-wetter-kompakt'
import { parseWetterOrtId, REGION_HAARBACH } from '@/lib/region-haarbach'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Start',
  description: `Übersicht — ${REGION_HAARBACH.name}, ${REGION_HAARBACH.kreis}`,
}

function StartBlockSkeleton() {
  return (
    <div className="h-40 animate-pulse rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]" />
  )
}

type StartPageProps = { searchParams?: Promise<{ ort?: string }> }

export default async function StartUebersichtPage({ searchParams }: StartPageProps) {
  const sp = searchParams != null ? await searchParams : {}
  const ortId = parseWetterOrtId(sp.ort)

  return (
    <PageChrome density="compact" className="max-w-2xl mx-auto space-y-4">
      <StartHero />

      <Suspense fallback={<StartBlockSkeleton />}>
        <StartWetterKompakt ortId={ortId} />
      </Suspense>

      <StartKalenderKompakt />
      <StartWhoopKompakt />

      <Suspense fallback={<StartBlockSkeleton />}>
        <StartPortfolioKompakt />
      </Suspense>

      <StartFinanzenKompakt />
    </PageChrome>
  )
}

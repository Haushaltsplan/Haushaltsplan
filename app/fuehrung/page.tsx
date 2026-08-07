import { Suspense } from 'react'
import { FuehrungClient } from '@/components/fuehrung/fuehrung-client'
import { PageChrome } from '@/components/page-shell'

function FuehrungFallback() {
  return (
    <PageChrome density="compact" className="max-w-3xl">
      <p className="text-sm text-[var(--app-text-muted)]">Laden …</p>
    </PageChrome>
  )
}

export default function FuehrungPage() {
  return (
    <Suspense fallback={<FuehrungFallback />}>
      <FuehrungClient />
    </Suspense>
  )
}

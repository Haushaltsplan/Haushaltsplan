import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'
import {
  InvestmentsMarktNasdaq100Panel,
  InvestmentsMarktPortfolioPanel,
  InvestmentsMarktSp500Panel,
  InvestmentsMarktUebersichtPanel,
} from '@/components/investments-markt-streaming'
import { InvestmentsMinuteRefresh } from '@/components/investments-minute-refresh'
import { InvestmentMantra } from '@/components/investment-mantra'
import { InvestmentResearchPrompts } from '@/components/investment-research-prompts'

/** Kurs-/News-Fetches nutzen `next.revalidate`; Wiederholungsbesuche & CDN profitieren. `router.refresh()` aktualisiert weiter manuell/zeitgesteuert. */
export const revalidate = 120

/** Lange Movers-Pipelines (HTTP + optional KI); auf Vercel ggf. Plan-Maximum beachten. */
export const maxDuration = 120

export const metadata: Metadata = {
  title: 'Investments',
  description: 'Portfolio in Parqet verfolgen',
}

function MarktPanelSkeleton() {
  return (
    <PageSectionPanel>
      <div className="space-y-3 animate-pulse">
        <div className="h-3 w-36 rounded bg-zinc-800/90" />
        <div className="h-5 w-52 max-w-full rounded bg-zinc-800/70" />
        <div className="h-28 rounded-xl bg-zinc-900/55 sm:h-32" />
      </div>
    </PageSectionPanel>
  )
}

export default function InvestmentsPage() {
  const parqetUrl =
    typeof process.env.NEXT_PUBLIC_PARQET_PORTFOLIO_URL === 'string'
      ? process.env.NEXT_PUBLIC_PARQET_PORTFOLIO_URL.trim()
      : ''
  const konfiguriert = parqetUrl.length > 0

  return (
    <PageChrome>
      <InvestmentsMinuteRefresh />

      <PageHero
        eyebrow="Investments"
        title="Portfolio in Parqet"
        actions={
          konfiguriert ? (
            <a
              href={parqetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] px-5 py-2.5 text-center text-sm font-medium text-white shadow-md shadow-black/25 backdrop-blur-md transition hover:border-white/25 hover:bg-white/[0.12]"
            >
              Parqet öffnen
            </a>
          ) : (
            <div className="max-w-md rounded-lg border border-orange-900/35 bg-orange-950/15 px-4 py-3 text-sm leading-relaxed text-orange-50">
              <span className="font-semibold text-orange-100">Parqet-Link fehlt.</span>{' '}
              In <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-300">.env.local</code>{' '}
              die Variable{' '}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-teal-400">
                NEXT_PUBLIC_PARQET_PORTFOLIO_URL
              </code>{' '}
              setzen und den Dev-Server neu starten.
            </div>
          )
        }
      />

      <PageSection titleId="investments-markt-heading" title="Markt">
        <Suspense fallback={<MarktPanelSkeleton />}>
          <InvestmentsMarktUebersichtPanel />
        </Suspense>
        <Suspense fallback={<MarktPanelSkeleton />}>
          <InvestmentsMarktPortfolioPanel />
        </Suspense>
        <Suspense fallback={<MarktPanelSkeleton />}>
          <InvestmentsMarktSp500Panel />
        </Suspense>
        <Suspense fallback={<MarktPanelSkeleton />}>
          <InvestmentsMarktNasdaq100Panel />
        </Suspense>
      </PageSection>

      <PageSection titleId="investments-research-heading" title="Research">
        <PageSectionPanel>
          <InvestmentMantra embedded />
        </PageSectionPanel>
        <PageSectionPanel>
          <InvestmentResearchPrompts embedded />
        </PageSectionPanel>
      </PageSection>
    </PageChrome>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'
import { InvestmentsMinuteRefresh } from '@/components/investments-minute-refresh'
import { InvestmentMantra } from '@/components/investment-mantra'
import { InvestmentResearchPrompts } from '@/components/investment-research-prompts'
import { MarketUebersichtSection } from '@/components/market-uebersicht-section'
import { Nasdaq100MoversSection } from '@/components/nasdaq100-movers-section'
import { Sp500MoversSection } from '@/components/sp500-movers-section'
import { ladeMarktUebersicht } from '@/lib/market-uebersicht'
import { ladeNasdaq100MoversBericht } from '@/lib/nasdaq100-tagesmovers'
import { ladeSp500MoversBericht } from '@/lib/sp500-tagesmovers'

export const dynamic = 'force-dynamic'
/** Lange Movers-Pipelines (HTTP + optional KI); auf Vercel ggf. Plan-Maximum beachten. */
export const maxDuration = 120

export const metadata: Metadata = {
  title: 'Investments',
  description: 'Portfolio in Parqet verfolgen',
}

function InvestmentsMarktFallback() {
  return (
    <>
      {[0, 1, 2].map((key) => (
        <PageSectionPanel key={key}>
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-36 rounded bg-zinc-800/90" />
            <div className="h-5 w-52 max-w-full rounded bg-zinc-800/70" />
            <div className="h-28 rounded-xl bg-zinc-900/55 sm:h-32" />
          </div>
        </PageSectionPanel>
      ))}
    </>
  )
}

async function InvestmentsMarktPanels() {
  const [marktUebersicht, sp500Bericht, nasdaq100Bericht] = await Promise.all([
    ladeMarktUebersicht(),
    ladeSp500MoversBericht(),
    ladeNasdaq100MoversBericht(),
  ])

  return (
    <>
      <PageSectionPanel>
        <MarketUebersichtSection embedded uebersicht={marktUebersicht} />
      </PageSectionPanel>
      <PageSectionPanel>
        <Sp500MoversSection embedded bericht={sp500Bericht} />
      </PageSectionPanel>
      <PageSectionPanel>
        <Nasdaq100MoversSection embedded bericht={nasdaq100Bericht} />
      </PageSectionPanel>
    </>
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
        <Suspense fallback={<InvestmentsMarktFallback />}>
          <InvestmentsMarktPanels />
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

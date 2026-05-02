import type { Metadata } from 'next'
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

const revSec = Number(process.env.INVESTMENTS_PAGE_REVALIDATE_SECONDS)
export const revalidate =
  Number.isFinite(revSec) && revSec >= 60 ? Math.floor(revSec) : 300

export const metadata: Metadata = {
  title: 'Investments',
  description: 'Portfolio in Parqet verfolgen',
}

export default async function InvestmentsPage() {
  const marktUebersicht = await ladeMarktUebersicht()
  /** Nacheinander statt parallel: weniger gleichzeitige Gemini-/HTTP-Last (Movers sind schwer). */
  const sp500Bericht = await ladeSp500MoversBericht()
  const nasdaq100Bericht = await ladeNasdaq100MoversBericht()
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
        <PageSectionPanel>
          <MarketUebersichtSection embedded uebersicht={marktUebersicht} />
        </PageSectionPanel>
        <PageSectionPanel>
          <Sp500MoversSection embedded bericht={sp500Bericht} />
        </PageSectionPanel>
        <PageSectionPanel>
          <Nasdaq100MoversSection embedded bericht={nasdaq100Bericht} />
        </PageSectionPanel>
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

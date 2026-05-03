import { PageSectionPanel } from '@/components/page-shell'
import { MarketUebersichtSection } from '@/components/market-uebersicht-section'
import { Nasdaq100MoversSection } from '@/components/nasdaq100-movers-section'
import { PortfolioHoldingsSection } from '@/components/portfolio-holdings-section'
import { Sp500MoversSection } from '@/components/sp500-movers-section'
import { ladeMarktUebersicht } from '@/lib/market-uebersicht'
import { ladeNasdaq100MoversBericht } from '@/lib/nasdaq100-tagesmovers'
import { ladePortfolioKurseBericht } from '@/lib/portfolio-kurse'
import { ladeSp500MoversBericht } from '@/lib/sp500-tagesmovers'

export async function InvestmentsMarktUebersichtPanel() {
  const uebersicht = await ladeMarktUebersicht()
  return (
    <PageSectionPanel>
      <MarketUebersichtSection embedded uebersicht={uebersicht} />
    </PageSectionPanel>
  )
}

export async function InvestmentsMarktPortfolioPanel() {
  const bericht = await ladePortfolioKurseBericht()
  return (
    <PageSectionPanel>
      <PortfolioHoldingsSection embedded bericht={bericht} />
    </PageSectionPanel>
  )
}

export async function InvestmentsMarktSp500Panel() {
  const bericht = await ladeSp500MoversBericht()
  return (
    <PageSectionPanel>
      <Sp500MoversSection embedded bericht={bericht} />
    </PageSectionPanel>
  )
}

export async function InvestmentsMarktNasdaq100Panel() {
  const bericht = await ladeNasdaq100MoversBericht()
  return (
    <PageSectionPanel>
      <Nasdaq100MoversSection embedded bericht={bericht} />
    </PageSectionPanel>
  )
}

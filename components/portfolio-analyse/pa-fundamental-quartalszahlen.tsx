'use client'

import { useEffect, useState } from 'react'
import { PaFundamentalEarningsCallSpalte } from '@/components/portfolio-analyse/pa-fundamental-earnings-call-spalte'
import { PaFundamentalSecBerichte } from '@/components/portfolio-analyse/pa-fundamental-sec-berichte'
import { PaFundamentalBeatMiss } from '@/components/portfolio-analyse/pa-fundamental-beat-miss'
import { PaIconTabs } from '@/components/portfolio-analyse/pa-ui'

const QUARTALSZAHLEN_UNTER_TABS = [
  { id: 'earnings_call' as const, label: 'Earnings Call' },
  { id: 'quartals_jahresberichte' as const, label: 'Quartals- & Jahresberichte', shortLabel: 'Berichte' },
  { id: 'beat_miss' as const, label: 'Beat/Miss', shortLabel: 'Beat/Miss' },
]

export function PaFundamentalQuartalszahlen({
  ticker,
  firmenname,
  isin,
  symbolYahoo,
  selectionKey,
}: {
  ticker: string | null
  firmenname: string | null
  isin?: string | null
  symbolYahoo?: string | null
  selectionKey?: string
}) {
  const [unterTab, setUnterTab] = useState<(typeof QUARTALSZAHLEN_UNTER_TABS)[number]['id']>('earnings_call')

  useEffect(() => {
    setUnterTab('earnings_call')
  }, [selectionKey])

  return (
    <div className="space-y-4">
      <PaIconTabs tabs={QUARTALSZAHLEN_UNTER_TABS} active={unterTab} onChange={setUnterTab} />

      {unterTab === 'earnings_call' ? (
        <PaFundamentalEarningsCallSpalte
          ticker={ticker}
          firmenname={firmenname}
          isin={isin}
          selectionKey={selectionKey}
        />
      ) : unterTab === 'beat_miss' ? (
        <PaFundamentalBeatMiss ticker={ticker} symbolYahoo={symbolYahoo} selectionKey={selectionKey} />
      ) : (
        <PaFundamentalSecBerichte
          ticker={ticker}
          firmenname={firmenname}
          isin={isin}
          selectionKey={selectionKey}
        />
      )}
    </div>
  )
}

'use client'

import { PaFundamentalEarningsCallSpalte } from '@/components/portfolio-analyse/pa-fundamental-earnings-call-spalte'
import { PaFundamentalSecBerichte } from '@/components/portfolio-analyse/pa-fundamental-sec-berichte'

/** Earnings Call (links) + Quartalsberichte SEC (rechts). */
export function PaFundamentalEarningsCall({
  ticker,
  firmenname,
  isin,
  selectionKey,
}: {
  ticker: string | null
  firmenname: string | null
  isin?: string | null
  selectionKey?: string
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
      <PaFundamentalEarningsCallSpalte
        ticker={ticker}
        firmenname={firmenname}
        isin={isin}
        selectionKey={selectionKey}
      />
      <PaFundamentalSecBerichte
        ticker={ticker}
        firmenname={firmenname}
        isin={isin}
        selectionKey={selectionKey}
      />
    </div>
  )
}

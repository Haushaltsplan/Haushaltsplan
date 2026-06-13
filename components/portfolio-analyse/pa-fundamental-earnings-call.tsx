'use client'

import { PaFundamentalEarningsCallSpalte } from '@/components/portfolio-analyse/pa-fundamental-earnings-call-spalte'

/** Earnings Call — eigenes Unter-Tab in den Fundamentaldaten. */
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
    <PaFundamentalEarningsCallSpalte
      ticker={ticker}
      firmenname={firmenname}
      isin={isin}
      selectionKey={selectionKey}
    />
  )
}

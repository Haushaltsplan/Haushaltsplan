'use client'

import { useMemo, useState } from 'react'
import { alleLogoUrls, logoInitialen } from '@/lib/stock-logo-urls'

export function StockLogo({
  symbol,
  className,
  finnhubSlug,
  clearbitDomains,
}: {
  symbol: string
  className?: string
  /** Abweichender Finnhub-Slug (z. B. HLMA statt H11.MU). */
  finnhubSlug?: string
  clearbitDomains?: string[]
}) {
  const urls = useMemo(
    () => alleLogoUrls(symbol, { finnhubSlug, clearbitDomains }),
    [symbol, finnhubSlug, clearbitDomains?.join('|')],
  )
  const [step, setStep] = useState(0)
  const initials = logoInitialen(symbol)

  const imgClass =
    className ?? 'h-8 w-8 shrink-0 rounded-md border border-zinc-800 bg-zinc-950 p-0.5 object-contain'

  if (step >= urls.length) {
    return (
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 font-mono text-[10px] font-bold uppercase leading-none text-zinc-400"
        title={symbol}
        aria-label={symbol}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={urls[step]}
      alt={symbol}
      className={imgClass}
      loading="lazy"
      decoding="async"
      onError={() => setStep((s) => s + 1)}
    />
  )
}

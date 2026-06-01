'use client'

import { StockLogo } from '@/components/stock-logo'
import { logoInitialen } from '@/lib/stock-logo-urls'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'

export function PortfolioIsinLogo({
  isin,
  fallbackName,
  meta,
  className,
  groesse = 'md',
}: {
  isin: string | null
  fallbackName?: string | null
  meta: Map<string, IsinMetadata>
  className?: string
  groesse?: 'sm' | 'md'
}) {
  const m = isin ? meta.get(isin.toUpperCase()) : undefined
  const symbol = m?.symbolYahoo
  const name = anzeigeNameFuerIsin(isin, fallbackName ?? null, meta)
  const dim = groesse === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const imgClass = `${dim} shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 object-contain`

  if (symbol) {
    return <StockLogo symbol={symbol} className={className ?? imgClass} />
  }

  const initials = logoInitialen(name.replace(/\s+/g, '').slice(0, 4) || isin || '?')
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 font-mono text-[10px] font-bold uppercase text-zinc-400`}
      title={name}
    >
      {initials}
    </div>
  )
}

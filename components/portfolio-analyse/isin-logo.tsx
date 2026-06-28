'use client'

import { StockLogo } from '@/components/stock-logo'
import { logoInitialen } from '@/lib/stock-logo-urls'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

export function GewichtungAssetLogo({
  isin,
  symbol,
  label,
  meta,
  groesse = 'sm',
  className,
}: {
  isin?: string | null
  symbol?: string | null
  label: string
  meta: Map<string, IsinMetadata>
  groesse?: 'sm' | 'md'
  className?: string
}) {
  const isinKey = isin?.trim().toUpperCase() ?? ''
  if (isinKey && ISIN_RE.test(isinKey)) {
    return (
      <PortfolioIsinLogo
        isin={isinKey}
        fallbackName={label}
        meta={meta}
        groesse={groesse}
        className={className}
      />
    )
  }

  const sym = (symbol ?? label).trim()
  const logo = portfolioLogoQuellen(null, sym, label)
  const dim = groesse === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const imgClass = className ?? `${dim} shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-0.5 object-contain`

  if (sym || logo.finnhubSlug || (logo.clearbitDomains?.length ?? 0) > 0) {
    return (
      <StockLogo
        symbol={sym || logo.finnhubSlug || label}
        finnhubSlug={logo.finnhubSlug}
        clearbitDomains={logo.clearbitDomains}
        className={imgClass}
      />
    )
  }

  const initials = logoInitialen(label.replace(/\s+/g, '').slice(0, 4) || sym || '?')
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] font-mono text-[10px] font-bold uppercase text-[var(--app-text-muted)]`}
      title={label}
    >
      {initials}
    </div>
  )
}

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
  const logo = portfolioLogoQuellen(isin, symbol ?? null, name)
  const dim = groesse === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const imgClass = `${dim} shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-0.5 object-contain`

  if (symbol || logo.finnhubSlug || (logo.clearbitDomains?.length ?? 0) > 0) {
    return (
      <StockLogo
        symbol={symbol ?? logo.finnhubSlug ?? name}
        finnhubSlug={logo.finnhubSlug}
        clearbitDomains={logo.clearbitDomains}
        className={className ?? imgClass}
      />
    )
  }

  const initials = logoInitialen(name.replace(/\s+/g, '').slice(0, 4) || isin || '?')
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] font-mono text-[10px] font-bold uppercase text-[var(--app-text-muted)]`}
      title={name}
    >
      {initials}
    </div>
  )
}

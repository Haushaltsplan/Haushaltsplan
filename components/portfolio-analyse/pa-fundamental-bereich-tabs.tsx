'use client'

import Link from 'next/link'

export function PaFundamentalBereichTabs({ aktiv }: { aktiv: 'titel' | 'firma' }) {
  const base =
    'rounded-lg px-3 py-1.5 text-xs font-medium sm:text-sm'
  const an =
    'bg-[var(--app-surface-hover)] text-teal-300 ring-1 ring-[var(--app-ring)]'
  const aus = 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'

  return (
    <nav className="mb-4 flex w-fit gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1">
      <Link href="/portfolioanalyse/fundamentaldaten" className={`${base} ${aktiv === 'titel' ? an : aus}`}>
        Einzelaktie
      </Link>
      <Link href="/portfolioanalyse/fundamentaldaten/firma" className={`${base} ${aktiv === 'firma' ? an : aus}`}>
        Depot als Firma
      </Link>
    </nav>
  )
}

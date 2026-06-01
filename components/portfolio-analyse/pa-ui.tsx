'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export const PA_TEAL = '#2dd4bf'

export function PaCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-zinc-800/60 bg-zinc-900/30 ${className}`}
    >
      {children}
    </section>
  )
}

export function PaIconTabs<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: { id: T; label: string; icon?: ReactNode }[]
  active: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <nav className={`flex flex-wrap gap-1 border-b border-zinc-800/80 ${className}`}>
      {tabs.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 text-sm font-medium transition ${
              on
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}

const SUB_NAV = [
  { href: '/portfolioanalyse/dashboard', label: 'Dashboard' },
  { href: '/portfolioanalyse/analyse', label: 'Analyse' },
  { href: '/portfolioanalyse/aktivitaeten', label: 'Aktivitäten' },
  { href: '/portfolioanalyse/dividenden', label: 'Dividenden' },
  { href: '/portfolioanalyse/import', label: 'Import' },
] as const

export function PaSubNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-1">
      {SUB_NAV.map((item) => {
        const aktiv =
          pathname === item.href ||
          (item.href === '/portfolioanalyse/dashboard' && pathname === '/portfolioanalyse')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              aktiv
                ? 'bg-zinc-800/90 text-teal-300'
                : 'text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-200'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function PaBadge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode
  variant?: 'positive' | 'negative' | 'buy' | 'sell' | 'dividend' | 'neutral'
}) {
  const cls = {
    positive: 'bg-emerald-500/15 text-emerald-300',
    negative: 'bg-rose-500/15 text-rose-300',
    buy: 'bg-sky-500/15 text-sky-300',
    sell: 'bg-amber-500/15 text-amber-300',
    dividend: 'bg-emerald-500/15 text-emerald-300',
    neutral: 'bg-zinc-800/80 text-zinc-400',
  }[variant]
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  )
}

export function PaStatRow({
  label,
  value,
  sub,
  badge,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  badge?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div>
        <p className="text-sm text-zinc-500">{label}</p>
        {sub ? <p className="mt-0.5 text-[11px] text-zinc-600">{sub}</p> : null}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums text-zinc-100">{value}</p>
        {badge ? <div className="mt-1 flex justify-end">{badge}</div> : null}
      </div>
    </div>
  )
}

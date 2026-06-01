'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export const PA_ACCENT = 'rgb(45, 212, 191)'

export function PaCard({
  children,
  className = '',
  variant = 'default',
}: {
  children: ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'glass'
}) {
  const base =
    variant === 'elevated'
      ? 'rounded-2xl border border-white/[0.06] bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 shadow-2xl shadow-black/40 ring-1 ring-white/[0.04]'
      : variant === 'glass'
        ? 'rounded-2xl border border-white/[0.05] bg-zinc-900/40 backdrop-blur-md ring-1 ring-white/[0.03]'
        : 'rounded-2xl border border-white/[0.06] bg-zinc-900/50 ring-1 ring-white/[0.03]'
  return <section className={`${base} ${className}`}>{children}</section>
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
    <nav
      className={`flex flex-wrap gap-0.5 rounded-xl border border-white/[0.05] bg-zinc-950/60 p-1 ${className}`}
    >
      {tabs.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
              on
                ? 'bg-zinc-800/90 text-teal-300 shadow-sm ring-1 ring-white/[0.06]'
                : 'text-zinc-500 hover:text-zinc-300'
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
    <nav className="inline-flex flex-wrap gap-1 rounded-2xl border border-white/[0.06] bg-zinc-950/80 p-1.5 shadow-lg shadow-black/30 ring-1 ring-white/[0.04]">
      {SUB_NAV.map((item) => {
        const aktiv =
          pathname === item.href ||
          (item.href === '/portfolioanalyse/dashboard' && pathname === '/portfolioanalyse')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl px-4 py-2 text-sm font-medium tracking-tight transition-all ${
              aktiv
                ? 'bg-gradient-to-b from-teal-500/20 to-teal-600/10 text-teal-300 ring-1 ring-teal-500/25'
                : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'
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
    positive: 'bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/20',
    negative: 'bg-rose-500/12 text-rose-400 ring-1 ring-rose-500/20',
    buy: 'bg-sky-500/12 text-sky-400 ring-1 ring-sky-500/20',
    sell: 'bg-amber-500/12 text-amber-400 ring-1 ring-amber-500/20',
    dividend: 'bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/20',
    neutral: 'bg-zinc-800/60 text-zinc-400 ring-1 ring-white/[0.04]',
  }[variant]
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}>
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
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] text-zinc-500">{label}</p>
        {sub ? <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600">{sub}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums tracking-tight text-zinc-100">{value}</p>
        {badge ? <div className="mt-1.5 flex justify-end">{badge}</div> : null}
      </div>
    </div>
  )
}

export function PaSectionTitle({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function PaHeroKpi({
  label,
  value,
  sub,
  trend,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  trend?: ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-950/90 to-black/50 p-6 ring-1 ring-white/[0.04]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-500/10 blur-3xl" />
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">{label}</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl">{value}</p>
        {trend}
      </div>
      {sub ? <p className="mt-3 text-sm text-zinc-500">{sub}</p> : null}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

export const PA_ACCENT = 'rgb(45, 212, 191)'

export const PA_TABLE = 'app-data-table w-full text-left text-sm'
export const PA_TABLE_COMPACT = 'app-data-table app-data-table-compact w-full text-left text-xs'
export const PA_TABLE_FRAME = 'app-table-frame'

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
      ? 'app-surface-card'
      : variant === 'glass'
        ? 'app-chart-frame'
        : 'app-section-shell'
  return <section className={`${base} ${className}`}>{children}</section>
}

const scrollTabsClass =
  'app-table-scroll app-h-scroll max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'

/** Dezente Scrollbars für Kennzahlen-Panel und Tabellen */
export const PA_SCROLL_PANEL = 'app-scroll-panel'

export const PA_SCROLL_ELEGANT =
  `${PA_SCROLL_PANEL} scroll-smooth [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgb(82_82_91/0.55)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--app-surface-muted)]/50 hover:[&::-webkit-scrollbar-thumb]:bg-[var(--app-surface-muted)]/70`

export function PaIconTabs<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: { id: T; label: string; shortLabel?: string; icon?: ReactNode }[]
  active: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <nav
      className={`${scrollTabsClass} rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1 ${className}`}
    >
      <div className="flex w-max min-w-full flex-nowrap gap-0.5 sm:w-full sm:flex-wrap">
        {tabs.map((t) => {
          const on = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all sm:px-3.5 sm:text-sm ${
                on
                  ? 'bg-[var(--app-surface-hover)] text-teal-600 shadow-sm ring-1 ring-[var(--app-ring)] dark:text-teal-300'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {t.icon}
              <span className="sm:hidden">{t.shortLabel ?? t.label}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

const SUB_NAV = [
  { href: '/portfolioanalyse/dashboard', label: 'Dashboard' },
  { href: '/portfolioanalyse/dividenden', label: 'Dividenden' },
  { href: '/portfolioanalyse/earnings', label: 'Quartalszahlen' },
  { href: '/portfolioanalyse/fundamentaldaten', label: 'Fundamentaldaten' },
  { href: '/portfolioanalyse/analyse', label: 'Analyse' },
  { href: '/portfolioanalyse/nachkaeufe', label: 'Nachkauf-Radar' },
  { href: '/portfolioanalyse/watchlist', label: 'Watchlist' },
  { href: '/portfolioanalyse/import', label: 'Import' },
] as const

function paSubNavAktiv(pathname: string, href: string) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === '/portfolioanalyse/dashboard' && pathname === '/portfolioanalyse')
  )
}

export function PaSubNav() {
  const pathname = usePathname()
  const router = useRouter()
  const aktivHref =
    SUB_NAV.find((item) => paSubNavAktiv(pathname, item.href))?.href ?? '/portfolioanalyse/dashboard'

  return (
    <>
      <div className="sm:hidden">
        <label htmlFor="pa-subnav-select" className="sr-only">
          Portfolio-Bereich
        </label>
        <div className="relative">
          <select
            id="pa-subnav-select"
            value={aktivHref}
            onChange={(e) => router.push(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] py-3.5 pl-4 pr-10 text-sm font-medium text-[var(--app-text)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          >
            {SUB_NAV.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]"
            aria-hidden
          >
            ▾
          </span>
        </div>
      </div>

      <nav
        className={`${scrollTabsClass} hidden w-full max-w-full rounded-2xl border border-white/[0.06] bg-[var(--app-surface-muted)] p-1 shadow-lg shadow-black/30 ring-1 ring-white/[0.04] sm:block sm:p-1.5`}
      >
        <div className="flex w-max min-w-full flex-nowrap gap-0.5 sm:w-full sm:flex-wrap sm:gap-1">
          {SUB_NAV.map((item) => {
            const aktiv = paSubNavAktiv(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium tracking-tight transition-all sm:px-4 sm:text-sm ${
                  aktiv
                    ? 'bg-gradient-to-b from-teal-500/20 to-teal-600/10 text-teal-300 ring-1 ring-teal-500/25'
                    : 'text-[var(--app-text-muted)] hover:bg-white/[0.03] hover:text-[var(--app-text)]'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

/** Geschätzte / prognostizierte Dividende (nicht offiziell angekündigt). */
export function PaDividendEstimateBadge({ title = 'Geschätzte Dividende' }: { title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded px-1 text-[10px] font-bold leading-none text-amber-100/95 ring-1 ring-amber-700/50 bg-amber-950/75"
      aria-label={title}
    >
      E
    </span>
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
    neutral: 'bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] ring-1 ring-white/[0.04]',
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
        <p className="text-[13px] text-[var(--app-text-muted)]">{label}</p>
        {sub ? <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--app-text-muted)]">{sub}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums tracking-tight text-[var(--app-text)]">{value}</p>
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
        <h2 className="text-lg font-semibold tracking-tight text-[var(--app-text)]">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--app-text-muted)]">{description}</p>
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
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[var(--app-surface-muted)] via-[var(--app-surface-muted)] to-black/50 p-6 ring-1 ring-white/[0.04]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-500/10 blur-3xl" />
      <p className="text-xs font-medium uppercase tracking-widest text-[var(--app-text-muted)]">{label}</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl">{value}</p>
        {trend}
      </div>
      {sub ? <p className="mt-3 text-sm text-[var(--app-text-muted)]">{sub}</p> : null}
    </div>
  )
}

'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export type StartAkzent = 'sky' | 'rose' | 'whoop' | 'violet' | 'teal'

const AKZENT: Record<
  StartAkzent,
  { ring: string; glow: string; iconBg: string; iconText: string; link: string; border: string }
> = {
  sky: {
    ring: 'ring-sky-500/20',
    glow: 'from-sky-500/12 via-transparent to-cyan-500/5',
    iconBg: 'bg-sky-500/15',
    iconText: 'text-sky-300',
    link: 'hover:bg-sky-500/15 hover:text-sky-200',
    border: 'border-sky-500/15',
  },
  rose: {
    ring: 'ring-rose-500/20',
    glow: 'from-rose-500/10 via-transparent to-pink-500/5',
    iconBg: 'bg-rose-500/15',
    iconText: 'text-rose-300',
    link: 'hover:bg-rose-500/15 hover:text-rose-200',
    border: 'border-rose-500/15',
  },
  whoop: {
    ring: 'ring-emerald-500/20',
    glow: 'from-[#009dff]/10 via-transparent to-violet-600/8',
    iconBg: 'bg-emerald-500/12',
    iconText: 'text-emerald-300',
    link: 'hover:bg-emerald-500/15 hover:text-emerald-200',
    border: 'border-white/[0.08]',
  },
  violet: {
    ring: 'ring-violet-500/20',
    glow: 'from-violet-500/12 via-transparent to-indigo-500/5',
    iconBg: 'bg-violet-500/15',
    iconText: 'text-violet-300',
    link: 'hover:bg-violet-500/15 hover:text-violet-200',
    border: 'border-violet-500/15',
  },
  teal: {
    ring: 'ring-teal-500/20',
    glow: 'from-teal-500/10 via-transparent to-emerald-500/5',
    iconBg: 'bg-teal-500/15',
    iconText: 'text-teal-300',
    link: 'hover:bg-teal-500/15 hover:text-teal-200',
    border: 'border-teal-500/15',
  },
}

export function StartHero() {
  const heute = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const stunde = new Date().getHours()
  const gruß = stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Guten Tag' : 'Guten Abend'

  return (
    <header className="app-hero relative px-5 py-6 sm:py-7">
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[var(--app-accent-soft)] blur-3xl" />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl" />
      <p className="app-eyebrow relative">Omnia</p>
      <h1 className="relative mt-2 text-xl font-semibold tracking-tight text-[var(--app-text)] sm:text-2xl">{gruß}</h1>
      <p className="relative mt-1.5 text-sm capitalize text-[var(--app-text-muted)]">{heute}</p>
    </header>
  )
}

export function StartSektion({
  titel,
  icon,
  href,
  akzent,
  children,
  innerClassName,
}: {
  titel: string
  icon: string
  href: string
  akzent: StartAkzent
  children: ReactNode
  innerClassName?: string
}) {
  const a = AKZENT[akzent]
  return (
    <section className={`app-section-shell relative ${a.ring} ${a.border}`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.glow}`} />
      <div className="app-surface-card-header relative px-4 py-3.5 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${a.iconBg} ${a.iconText}`}
              aria-hidden
            >
              {icon}
            </span>
            <h2 className="truncate text-base font-semibold tracking-tight text-[var(--app-text)]">{titel}</h2>
          </div>
          <Link
            href={href}
            className={`shrink-0 rounded-[0.875rem] border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text-muted)] shadow-sm transition ${a.link}`}
          >
            Öffnen →
          </Link>
        </div>
      </div>
      <div className={`relative px-4 py-4 sm:px-5 sm:py-5 ${innerClassName ?? ''}`}>{children}</div>
    </section>
  )
}

export function StartSkeleton({ zeilen = 2 }: { zeilen?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: zeilen }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-[var(--app-surface-muted)]" />
      ))}
    </div>
  )
}

export function StartLeer({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-6 text-center text-xs leading-relaxed text-[var(--app-text-muted)]">
      {text}
    </p>
  )
}

export function StartMiniKachel({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative'
}) {
  const valueCls =
    tone === 'positive'
      ? 'text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-400'
        : 'text-[var(--app-text)]'
  return (
    <div className="app-kpi-tile px-3 py-3">
      <p className="app-eyebrow text-[9px]">{label}</p>
      <p className={`mt-1.5 text-base font-bold tabular-nums sm:text-lg ${valueCls}`}>{value}</p>
    </div>
  )
}

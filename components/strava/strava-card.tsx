'use client'

import { STRAVA_CARD_CLASS, STRAVA_COLORS } from '@/components/strava/design-tokens'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  accent?: 'orange' | 'cyan' | 'none'
  padding?: 'sm' | 'md' | 'lg'
  hover?: boolean
}

const PADDING = { sm: 'p-3', md: 'p-4', lg: 'p-5' } as const

const ACCENT_BORDER = {
  orange: 'border-l-2 border-l-[#FC4C02]',
  cyan: 'border-l-2 border-l-[#22d3ee]',
  none: '',
} as const

export function StravaCard({ children, className = '', accent = 'none', padding = 'md', hover = false }: Props) {
  return (
    <div
      className={[
        STRAVA_CARD_CLASS,
        PADDING[padding],
        ACCENT_BORDER[accent],
        hover ? 'hover:border-slate-400/25 hover:shadow-[0_8px_32px_rgba(0,0,0,0.45)]' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

export function StravaSectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: STRAVA_COLORS.textSecondary }}>
        {title}
      </h3>
      {subtitle ? <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p> : null}
    </div>
  )
}

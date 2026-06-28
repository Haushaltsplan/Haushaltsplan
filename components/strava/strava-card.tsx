'use client'

import { STRAVA_CARD_CLASS, STRAVA_CARD_HOVER, STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { useState, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  accent?: 'orange' | 'cyan' | 'none'
  padding?: 'sm' | 'md' | 'lg'
  hover?: boolean
}

const PADDING = { sm: 'p-3.5', md: 'p-5', lg: 'p-6' } as const

const ACCENT_BORDER = {
  orange: 'border-l-[3px] border-l-[#FC4C02]/80',
  cyan: 'border-l-[3px] border-l-[#22d3ee]/70',
  none: '',
} as const

export function StravaCard({ children, className = '', accent = 'none', padding = 'md', hover = false }: Props) {
  return (
    <div
      className={[
        STRAVA_CARD_CLASS,
        PADDING[padding],
        ACCENT_BORDER[accent],
        hover ? STRAVA_CARD_HOVER : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

export function StravaSectionTitle({
  title,
  subtitle,
  info,
  className = '',
}: {
  title: string
  subtitle?: ReactNode
  info?: string
  className?: string
}) {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <div className={['mb-4', className].filter(Boolean).join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{title}</h3>
          {subtitle ? (
            <p className="mt-1.5 text-[13px] font-light leading-snug text-zinc-300/90">{subtitle}</p>
          ) : null}
        </div>
        {info ? (
          <button
            type="button"
            aria-expanded={infoOpen}
            aria-label={infoOpen ? 'Erklärung ausblenden' : 'Was bedeutet das?'}
            onClick={() => setInfoOpen((v) => !v)}
            className={[
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              'border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-transparent',
              'text-[11px] font-medium italic text-zinc-500',
              'hover:border-orange-500/30 hover:text-orange-200/85',
              STRAVA_INTERACTIVE,
              infoOpen ? 'border-orange-500/35 bg-orange-500/10 text-orange-200/90' : '',
            ].join(' ')}
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            i
          </button>
        ) : null}
      </div>
      {info && infoOpen ? (
        <p
          className="mt-3 border-l-2 pl-3.5 text-[12px] leading-relaxed text-zinc-400/95"
          style={{ borderLeftColor: `${STRAVA_COLORS.orange}55` }}
        >
          {info}
        </p>
      ) : null}
    </div>
  )
}

export function StravaPanelEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: STRAVA_COLORS.textMuted }}>
      {children}
    </p>
  )
}

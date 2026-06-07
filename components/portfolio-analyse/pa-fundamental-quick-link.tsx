'use client'

import { useRouter } from 'next/navigation'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'

export function PaFundamentalQuickLink({
  isin,
  size = 'sm',
  className = '',
}: {
  isin: string | null | undefined
  size?: 'sm' | 'md'
  className?: string
}) {
  const router = useRouter()
  const norm = isin?.trim().toUpperCase()
  if (!norm) return null

  const pad = size === 'md' ? 'p-1.5' : 'p-1'
  const icon = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'

  return (
    <button
      type="button"
      title="Fundamentaldaten öffnen"
      aria-label="Fundamentaldaten öffnen"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        router.push(fundamentaldatenHref({ isin: norm }))
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-300/90 transition hover:border-amber-500/35 hover:bg-amber-500/20 hover:text-amber-200 ${pad} ${className}`}
    >
      <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h4l3 9 4-18 3 9h4" />
      </svg>
    </button>
  )
}

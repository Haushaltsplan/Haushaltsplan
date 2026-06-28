'use client'

import Link from 'next/link'
import { istInvestmentsGesperrt, investmentsSperreNavTitle } from '@/lib/investments-sperre'
import { type NavItem, linkActive } from '@/lib/nav-model'

export function NavLinkList({
  items,
  pathname,
  onNavigate,
  variant = 'sidebar',
}: {
  items: NavItem[]
  pathname: string
  onNavigate?: () => void
  /** `sidebar`: Desktop-Leiste. `drawer`: größere Touch-Ziele fürs Handy-Menü. */
  variant?: 'sidebar' | 'drawer'
}) {
  const isDrawer = variant === 'drawer'
  const py = isDrawer ? 'py-3' : 'py-2.5'
  const textSize = isDrawer ? 'text-[15px]' : 'text-[13px]'
  const radius = isDrawer ? 'rounded-xl' : 'rounded-lg'

  return (
    <>
      {items.map((d) => {
        const active = linkActive(pathname, d.href)
        const investmentsGesperrt = d.href === '/investments' && istInvestmentsGesperrt()
        const itemClass = `flex items-center gap-3 ${radius} px-3 ${py} ${textSize} font-medium outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--app-accent-glow)] ${
          active
            ? 'app-nav-active text-[var(--app-text)]'
            : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] active:bg-[var(--app-surface-hover)]'
        }`

        if (investmentsGesperrt) {
          return (
            <span
              key={d.href}
              title={investmentsSperreNavTitle()}
              aria-current={active ? 'page' : undefined}
              className={`${itemClass} cursor-default opacity-60 ${active ? '' : 'hover:bg-transparent'}`}
            >
              <NavEmoji emoji={d.emoji} variant={variant} />
              <span className="min-w-0 truncate">{d.label}</span>
            </span>
          )
        }

        return (
          <Link
            key={d.href}
            href={d.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={itemClass}
          >
            <NavEmoji emoji={d.emoji} variant={variant} />
            <span className="min-w-0 truncate">{d.label}</span>
          </Link>
        )
      })}
    </>
  )
}

function NavEmoji({ emoji, variant }: { emoji: string; variant: 'sidebar' | 'drawer' }) {
  if (variant === 'sidebar') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[17px] leading-none" aria-hidden>
        {emoji}
      </span>
    )
  }
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-surface-muted)] text-[18px] leading-none ring-1 ring-[var(--app-ring)]"
      aria-hidden
    >
      {emoji}
    </span>
  )
}

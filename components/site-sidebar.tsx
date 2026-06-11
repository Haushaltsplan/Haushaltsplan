'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { istInvestmentsGesperrt, investmentsSperreNavTitle } from '@/lib/investments-sperre'
import {
  DEFAULT_HREF_ORDER,
  HREF_TO_DEF,
  NAV_ORDER_CHANGED_EVENT,
  NAV_ORDER_KEY,
  type NavItem,
  linkActive,
  mergePersistedWithKnown,
} from '@/lib/nav-model'

/** Desktop: feste linke Spalte wie klassische Dashboard-Apps (z. B. Parqet). */
export function SiteSidebar() {
  const pathname = usePathname()
  const [order, setOrder] = useState<string[]>(DEFAULT_HREF_ORDER)

  const reloadOrderFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(NAV_ORDER_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          startTransition(() => setOrder(mergePersistedWithKnown(parsed)))
          return
        }
      }
      startTransition(() => setOrder(DEFAULT_HREF_ORDER))
    } catch {
      /* ignore */
    }
  }, [])

  useLayoutEffect(() => {
    reloadOrderFromStorage()
  }, [reloadOrderFromStorage])

  useEffect(() => {
    window.addEventListener(NAV_ORDER_CHANGED_EVENT, reloadOrderFromStorage)
    return () => window.removeEventListener(NAV_ORDER_CHANGED_EVENT, reloadOrderFromStorage)
  }, [reloadOrderFromStorage])

  const orderedDefs: NavItem[] = useMemo(() => {
    return order
      .map((href) => HREF_TO_DEF.get(href as NavItem['href']))
      .filter((d): d is NavItem => Boolean(d))
  }, [order])

  return (
    <aside className="sticky top-0 hidden h-screen max-h-[100dvh] w-[232px] shrink-0 flex-col border-r border-[var(--app-border-strong)] bg-[var(--app-sidebar)] md:flex">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--app-border)] px-4 py-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-teal-500/40"
          aria-label="Omnia – Startseite"
        >
          <Image
            src="/icon.svg"
            alt=""
            width={96}
            height={96}
            unoptimized
            className="h-9 w-9 shrink-0 object-contain"
            priority
          />
          <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--app-text)]">Omnia</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3" aria-label="Hauptnavigation">
        {orderedDefs.map((d) => {
          const active = linkActive(pathname, d.href)
          const investmentsGesperrt = d.href === '/investments' && istInvestmentsGesperrt()
          const itemClass = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-500/35 ${
            active
              ? 'bg-[var(--app-surface-hover)] text-[var(--app-text)] shadow-sm shadow-[var(--app-shadow)]'
              : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'
          }`
          if (investmentsGesperrt) {
            return (
              <span
                key={d.href}
                title={investmentsSperreNavTitle()}
                aria-current={active ? 'page' : undefined}
                className={`${itemClass} cursor-default opacity-60 ${
                  active ? '' : 'hover:bg-transparent hover:text-zinc-400'
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[17px] leading-none" aria-hidden>
                  {d.emoji}
                </span>
                <span className="min-w-0 truncate">{d.label}</span>
              </span>
            )
          }
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-current={active ? 'page' : undefined}
              className={itemClass}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[17px] leading-none" aria-hidden>
                {d.emoji}
              </span>
              <span className="min-w-0 truncate">{d.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-[var(--app-border)] px-4 py-3">
        <Link
          href="/datenschutz"
          className="block text-[11px] text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
        >
          Datenschutz
        </Link>
        <p className="font-mono text-[10px] text-[var(--app-text-muted)]">v1.1.0</p>
      </div>
    </aside>
  )
}

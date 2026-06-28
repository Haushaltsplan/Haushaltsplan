'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NavLinkList } from '@/components/nav-link-list'
import { useNavOrder } from '@/lib/use-nav-order'

/** Desktop: feste linke Spalte wie klassische Dashboard-Apps (z. B. Parqet). */
export function SiteSidebar() {
  const pathname = usePathname()
  const { orderedDefs } = useNavOrder()

  return (
    <aside className="app-glass-bar sticky top-0 hidden h-screen max-h-[100dvh] w-[240px] shrink-0 flex-col border-r shadow-[4px_0_32px_-12px_var(--app-shadow-lg)] md:flex">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--app-border)] px-4 py-5">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-2.5 rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--app-accent-soft)]"
          aria-label="Omnia – Startseite"
        >
          <Image
            src="/icon.svg"
            alt=""
            width={96}
            height={96}
            unoptimized
            className="h-9 w-9 shrink-0 object-contain transition group-hover:scale-[1.03]"
            priority
          />
          <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--app-text)]">Omnia</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3" aria-label="Hauptnavigation">
        <NavLinkList items={orderedDefs} pathname={pathname} />
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

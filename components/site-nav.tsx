'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/finanzen', label: 'Finanzen', emoji: '💰', color: 'text-emerald-400', ring: 'focus-visible:ring-emerald-500/50' },
  { href: '/', label: 'Speisekammer', emoji: '🍳', color: 'text-sky-400', ring: 'focus-visible:ring-sky-500/50' },
  { href: '/kalender', label: 'Kalender', emoji: '📅', color: 'text-teal-400', ring: 'focus-visible:ring-teal-500/50' },
  { href: '/besitz', label: 'Besitz', emoji: '👜', color: 'text-amber-400', ring: 'focus-visible:ring-amber-500/50' },
  { href: '/investments', label: 'Investments', emoji: '📈', color: 'text-violet-400', ring: 'focus-visible:ring-violet-500/50' },
] as const

function linkActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteNav() {
  const pathname = usePathname()

  return (
    <>
      <div className="hidden items-center gap-0.5 md:flex">
        {links.map((l) => {
          const active = linkActive(pathname, l.href)
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 md:px-4 ${l.ring} ${
                active ? `bg-slate-800/90 ${l.color}` : 'text-slate-500 hover:bg-slate-800/80 hover:text-slate-300'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span aria-hidden>{l.emoji}</span>
              {l.label}
            </Link>
          )
        })}
      </div>

      <div className="md:hidden min-w-0 w-full">
        <div className="flex w-full min-w-0 items-center gap-1 overflow-x-auto pb-0.5">
          {links.map((l) => {
            const active = linkActive(pathname, l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 rounded-lg px-2.5 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 ${l.ring} ${
                  active ? `bg-slate-800/90 ${l.color}` : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span aria-hidden>{l.emoji}</span> {l.label}
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}

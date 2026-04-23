'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

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

      <div className="md:hidden">
        <button
          type="button"
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/60"
          aria-expanded={open}
          aria-controls="site-nav-mobile-panel"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Schließen' : 'Menü'}
        </button>

        {open ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
              aria-label="Menü schließen"
              onClick={() => setOpen(false)}
            />
            <div
              id="site-nav-mobile-panel"
              className="fixed left-0 right-0 top-16 z-50 border-b border-slate-800 bg-slate-900/98 p-3 shadow-2xl shadow-black/50"
              role="navigation"
              aria-label="Hauptnavigation"
            >
              <ul className="flex flex-col gap-1">
                {links.map((l) => {
                  const active = linkActive(pathname, l.href)
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base font-bold focus-visible:outline-none focus-visible:ring-2 ${l.ring} ${
                          active ? `bg-slate-800 ${l.color}` : 'text-slate-300 hover:bg-slate-800/70'
                        }`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className="text-xl" aria-hidden>
                          {l.emoji}
                        </span>
                        {l.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}

export const NAV_LINK_DEFS = [
  { href: '/', label: 'Start', emoji: '🏡', color: 'text-cyan-400', ring: 'focus-visible:ring-cyan-500/50' },
  { href: '/finanzen', label: 'Finanzen', emoji: '💰', color: 'text-emerald-400', ring: 'focus-visible:ring-emerald-500/50' },
  { href: '/speisekammer', label: 'Speisekammer', emoji: '🍳', color: 'text-sky-400', ring: 'focus-visible:ring-sky-500/50' },
  { href: '/kalender', label: 'Kalender', emoji: '📅', color: 'text-teal-400', ring: 'focus-visible:ring-teal-500/50' },
  { href: '/natur', label: 'Natur', emoji: '🌿', color: 'text-lime-400', ring: 'focus-visible:ring-lime-500/50' },
  { href: '/rennrad', label: 'Rennrad', emoji: '🚴', color: 'text-rose-400', ring: 'focus-visible:ring-rose-500/50' },
  {
    href: '/fitnessdaten',
    label: 'Fitnessdaten',
    emoji: '💪',
    color: 'text-orange-400',
    ring: 'focus-visible:ring-orange-500/50',
  },
  { href: '/besitz', label: 'Besitz', emoji: '👜', color: 'text-amber-400', ring: 'focus-visible:ring-amber-500/50' },
  {
    href: '/portfolioanalyse',
    label: 'Portfolioanalyse',
    emoji: '📊',
    color: 'text-indigo-400',
    ring: 'focus-visible:ring-indigo-500/50',
  },
  { href: '/investments', label: 'Investments', emoji: '📈', color: 'text-violet-400', ring: 'focus-visible:ring-violet-500/50' },
  { href: '/einstellungen', label: 'Einstellungen', emoji: '⚙️', color: 'text-slate-300', ring: 'focus-visible:ring-slate-500/50' },
] as const

export type NavItem = (typeof NAV_LINK_DEFS)[number]

export const NAV_ORDER_KEY = 'mein-haushalt:nav-href-order'

/** Nach Änderung der Reihenfolge (z. B. Drag auf Mobil) auslösen, damit die Sidebar nachzieht. */
export const NAV_ORDER_CHANGED_EVENT = 'omnia-nav-order-changed'

export const HREF_TO_DEF = new Map(NAV_LINK_DEFS.map((d) => [d.href, d] as const))
export const DEFAULT_HREF_ORDER = NAV_LINK_DEFS.map((d) => d.href)

export function mergePersistedWithKnown(saved: string[] | null | undefined): string[] {
  const known = new Set<string>(HREF_TO_DEF.keys())
  const next: string[] = []
  if (Array.isArray(saved)) {
    for (const h of saved) {
      if (known.has(h) && !next.includes(h)) next.push(h)
    }
  }
  for (const h of DEFAULT_HREF_ORDER) {
    if (!next.includes(h)) next.push(h)
  }
  return next
}

export function linkActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Längster bekannter Nav-Href zur Route (Unterseiten werden der Tab-Route zugeordnet). */
export function navHrefForPathname(pathname: string, orderedHrefs: readonly string[]): string | null {
  let best: string | null = null
  let bestLen = -1
  for (const href of orderedHrefs) {
    if (!linkActive(pathname, href)) continue
    if (href.length > bestLen) {
      best = href
      bestLen = href.length
    }
  }
  return best
}

/** Nachbar in der aktuellen Reihenfolge; bei unbekannter Route oder Rand `null`. */
export function adjacentNavHref(
  pathname: string,
  orderedHrefs: readonly string[],
  direction: 'next' | 'prev',
): string | null {
  if (orderedHrefs.length === 0) return null
  const current = navHrefForPathname(pathname, orderedHrefs)
  if (!current) return null
  const i = orderedHrefs.indexOf(current)
  if (i < 0) return null
  if (direction === 'next') return orderedHrefs[i + 1] ?? null
  return orderedHrefs[i - 1] ?? null
}

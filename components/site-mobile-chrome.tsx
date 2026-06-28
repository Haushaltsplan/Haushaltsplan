'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { NavLinkList } from '@/components/nav-link-list'
import { ThemeToggle } from '@/components/theme-toggle'
import { lockAppScroll } from '@/lib/app-scroll-lock'
import { istInvestmentsGesperrt, investmentsSperreNavTitle } from '@/lib/investments-sperre'
import { HREF_TO_DEF, type NavItem as OmniaNavItem, linkActive, navHrefForPathname } from '@/lib/nav-model'
import { useNavOrder } from '@/lib/use-nav-order'

const BOTTOM_TAB_COUNT = 4

function MobileBottomTab({ tab, pathname }: { tab: OmniaNavItem; pathname: string }) {
  const active = linkActive(pathname, tab.href)
  const tabLabel = tab.shortLabel
  const tabClass = `relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold leading-tight outline-none transition ${
    active ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'
  }`
  const gesperrt = tab.href === '/investments' && istInvestmentsGesperrt()

  if (gesperrt) {
    return (
      <span title={investmentsSperreNavTitle()} className={`${tabClass} opacity-50`}>
        <span className="text-lg leading-none" aria-hidden>
          {tab.emoji}
        </span>
        <span className="max-w-full truncate">{tabLabel}</span>
      </span>
    )
  }

  return (
    <Link
      href={tab.href}
      aria-current={active ? 'page' : undefined}
      className={`${tabClass} hover:text-[var(--app-text)] active:scale-[0.98]`}
    >
      {active ? (
        <span
          className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--app-accent)] shadow-[0_0_8px_var(--app-accent-glow)]"
          aria-hidden
        />
      ) : null}
      <span className="text-lg leading-none" aria-hidden>
        {tab.emoji}
      </span>
      <span className="max-w-full truncate">{tabLabel}</span>
    </Link>
  )
}

function SortableDrawerRow({ def, pathname }: { def: OmniaNavItem; pathname: string }) {
  const active = linkActive(pathname, def.href)
  const investmentsGesperrt = def.href === '/investments' && istInvestmentsGesperrt()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.href,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl ${isDragging ? 'z-10 bg-[var(--app-surface-hover)] shadow-lg' : ''}`}
    >
      <button
        type="button"
        className="flex shrink-0 touch-none select-none items-center justify-center rounded-lg px-2 py-3 text-[var(--app-text-muted)]"
        aria-label={`${def.label} verschieben`}
        {...attributes}
        {...listeners}
      >
        <span className="text-sm leading-none" aria-hidden>
          ⠿
        </span>
      </button>
      <div className="min-w-0 flex-1">
        {investmentsGesperrt ? (
          <span
            title={investmentsSperreNavTitle()}
            className={`flex items-center gap-3 rounded-xl px-2 py-2.5 text-[15px] font-medium opacity-60 ${
              active ? 'text-[var(--app-text)]' : 'text-[var(--app-text-muted)]'
            }`}
          >
            <span aria-hidden>{def.emoji}</span>
            <span className="truncate">{def.label}</span>
          </span>
        ) : (
          <Link
            href={def.href}
            className={`flex items-center gap-3 rounded-xl px-2 py-2.5 text-[15px] font-medium ${
              active
                ? 'bg-[var(--app-surface-hover)] text-[var(--app-text)]'
                : 'text-[var(--app-text-muted)]'
            }`}
          >
            <span aria-hidden>{def.emoji}</span>
            <span className="truncate">{def.label}</span>
          </Link>
        )}
      </div>
    </div>
  )
}

/** Mobil: kompakte Kopfzeile, Bottom-Tabs und übersichtliches Seitenmenü. */
export function SiteMobileChrome() {
  const pathname = usePathname()
  const { order, orderedDefs, persistOrder } = useNavOrder()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editOrder, setEditOrder] = useState(false)

  const currentHref = navHrefForPathname(pathname, order)
  const currentDef = currentHref ? HREF_TO_DEF.get(currentHref as OmniaNavItem['href']) : null
  const bottomTabs: OmniaNavItem[] = orderedDefs.slice(0, BOTTOM_TAB_COUNT)
  const moreTabActive =
    Boolean(currentHref) && !bottomTabs.some((d) => d.href === currentHref)

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setEditOrder(false)
  }, [])

  useEffect(() => {
    closeDrawer()
  }, [pathname, closeDrawer])

  useEffect(() => {
    if (!drawerOpen) return
    return lockAppScroll()
  }, [drawerOpen])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldI = order.indexOf(String(active.id))
    const newI = order.indexOf(String(over.id))
    if (oldI < 0 || newI < 0) return
    persistOrder(arrayMove(order, oldI, newI))
  }

  return (
    <>
      <header className="app-glass-bar sticky top-0 z-50 border-b pt-[env(safe-area-inset-top,0px)] md:hidden">
        <div className="flex h-14 min-w-0 items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--app-text)] outline-none transition hover:bg-[var(--app-surface-hover)] focus-visible:ring-2 focus-visible:ring-teal-500/40"
            aria-label="Menü öffnen"
            aria-expanded={drawerOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate app-eyebrow text-[10px]">
              Omnia
            </p>
            <p className="truncate text-base font-semibold text-[var(--app-text)]">
              {currentDef?.label ?? 'Start'}
            </p>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <nav
        className="app-glass-bar fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_32px_-12px_var(--app-shadow-lg)] md:hidden"
        aria-label="Schnellnavigation"
      >
        <div className="grid h-[3.75rem] grid-cols-5">
          {bottomTabs.map((tab) => (
            <MobileBottomTab key={tab.href} tab={tab} pathname={pathname} />
          ))}

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold leading-tight outline-none transition hover:text-[var(--app-text)] active:scale-[0.98] ${
              moreTabActive ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'
            }`}
          >
            {moreTabActive ? (
              <span
                className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--app-accent)] shadow-[0_0_8px_var(--app-accent-glow)]"
                aria-hidden
              />
            ) : null}
            <span className="flex h-[18px] w-[18px] items-center justify-center text-lg leading-none" aria-hidden>
              ⋯
            </span>
            <span>Mehr</span>
          </button>
        </div>
      </nav>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[80] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Menü schließen"
            onClick={closeDrawer}
          />
          <aside className="app-glass-bar absolute inset-y-0 left-0 flex w-[min(100vw-3rem,320px)] max-w-full flex-col border-r shadow-2xl shadow-black/40">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--app-border)] px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <Link
                href="/"
                onClick={closeDrawer}
                className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-teal-500/40"
              >
                <Image src="/icon.svg" alt="" width={72} height={72} unoptimized className="h-9 w-9 object-contain" />
                <span className="truncate text-[15px] font-semibold text-[var(--app-text)]">Omnia</span>
              </Link>
              <button
                type="button"
                onClick={closeDrawer}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
                aria-label="Menü schließen"
              >
                ✕
              </button>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--app-border)] px-4 py-2">
              <p className="text-xs font-medium text-[var(--app-text-muted)]">
                {editOrder ? 'Reihenfolge per Ziehen ändern' : 'Alle Bereiche'}
              </p>
              <button
                type="button"
                onClick={() => setEditOrder((v) => !v)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-teal-600 hover:bg-[var(--app-surface-hover)] dark:text-teal-400"
              >
                {editOrder ? 'Fertig' : 'Anordnen'}
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 py-3" aria-label="Hauptnavigation">
              {editOrder ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={order} strategy={verticalListSortingStrategy}>
                    {orderedDefs.map((d) => (
                      <SortableDrawerRow key={d.href} def={d} pathname={pathname} />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <NavLinkList items={orderedDefs} pathname={pathname} onNavigate={closeDrawer} variant="drawer" />
              )}
            </nav>

            <div className="shrink-0 space-y-2 border-t border-[var(--app-border)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Link
                href="/datenschutz"
                onClick={closeDrawer}
                className="block text-[11px] text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
              >
                Datenschutz
              </Link>
              <p className="font-mono text-[10px] text-[var(--app-text-muted)]">v1.1.0</p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}

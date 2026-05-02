'use client'

import { startTransition, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DEFAULT_HREF_ORDER,
  HREF_TO_DEF,
  NAV_ORDER_CHANGED_EVENT,
  NAV_ORDER_KEY,
  type NavItem,
  linkActive,
  mergePersistedWithKnown,
} from '@/lib/nav-model'

function SortableNavItem({ def, pathname }: { def: NavItem; pathname: string }) {
  const active = linkActive(pathname, def.href)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.href,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex shrink-0 items-stretch rounded-lg ${
        isDragging ? 'z-20 scale-[1.02] opacity-95 shadow-lg shadow-black/40' : ''
      }`}
    >
      <button
        type="button"
        title="Ziehen zum Sortieren"
        className={`flex shrink-0 touch-none select-none items-center justify-center rounded-l-md border border-slate-700/90 border-r-0 bg-slate-900/60 px-1.5 text-slate-500 transition hover:text-slate-300 md:px-1 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        aria-label={`Reihenfolge: ${def.label}`}
        aria-grabbed={isDragging}
        {...attributes}
        {...listeners}
      >
        <span className="text-[10px] leading-none tracking-tighter" aria-hidden>
          ⋮⋮
        </span>
      </button>
      <Link
        href={def.href}
        className={`flex min-w-0 items-center gap-1.5 border border-l-0 border-slate-700/90 py-2 pr-2.5 pl-1 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 md:gap-2 md:px-3 md:py-2 md:text-sm ${def.ring} ${
          active
            ? `border-slate-600/80 bg-slate-800/90 ${def.color}`
            : 'text-slate-400 hover:border-slate-600/50 hover:bg-slate-800/80 hover:text-slate-200 md:text-slate-500 md:hover:text-slate-300'
        }`}
        aria-current={active ? 'page' : undefined}
      >
        <span aria-hidden>{def.emoji}</span>
        {def.label}
      </Link>
    </div>
  )
}

/** Gleiche Klassen wie in SortableNavItem — ohne dnd-kit (vermeidet aria-describedby-Hydration-Mismatch). */
function StatischeLeiste({ orderedDefs, pathname }: { orderedDefs: NavItem[]; pathname: string }) {
  return (
    <div className="flex w-full min-w-0 items-center gap-0.5 overflow-x-auto pb-0.5 [scrollbar-gutter:stable] md:overflow-visible md:pb-0">
      {orderedDefs.map((d) => {
        const active = linkActive(pathname, d.href)
        return (
          <div
            key={d.href}
            className="flex shrink-0 items-stretch rounded-lg"
            style={{ transform: 'none', transition: 'none' }}
          >
            <div
              className="flex w-[1.5rem] shrink-0 select-none items-center justify-center rounded-l-md border border-slate-700/90 border-r-0 bg-slate-900/40 px-1 text-slate-600 md:w-[1.35rem]"
              aria-hidden
            >
              <span className="text-[10px] leading-none opacity-40">⋮⋮</span>
            </div>
            <Link
              href={d.href}
              className={`flex min-w-0 items-center gap-1.5 border border-l-0 border-slate-700/90 py-2 pr-2.5 pl-1 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 md:gap-2 md:px-3 md:py-2 md:text-sm ${d.ring} ${
                active
                  ? `border-slate-600/80 bg-slate-800/90 ${d.color}`
                  : 'text-slate-400 hover:border-slate-600/50 hover:bg-slate-800/80 hover:text-slate-200 md:text-slate-500 md:hover:text-slate-300'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span aria-hidden>{d.emoji}</span>
              {d.label}
            </Link>
          </div>
        )
      })}
    </div>
  )
}

/** Horizontale Navigation — vor allem für Mobilgeräte; Desktop nutzt `SiteSidebar`. */
export function SiteNav() {
  const pathname = usePathname()
  const [order, setOrder] = useState<string[]>(DEFAULT_HREF_ORDER)
  const [dndBereit, setDndBereit] = useState(false)

  useEffect(() => {
    setDndBereit(true)
  }, [])

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_ORDER_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          const merged = mergePersistedWithKnown(parsed)
          startTransition(() => {
            setOrder(merged)
          })
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  const orderedDefs: NavItem[] = useMemo(() => {
    return order
      .map((href) => HREF_TO_DEF.get(href as NavItem['href']))
      .filter((d): d is NavItem => Boolean(d))
  }, [order])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return
    if (active.id === over.id) return
    setOrder((prev) => {
      const oldI = prev.indexOf(String(active.id))
      const newI = prev.indexOf(String(over.id))
      if (oldI < 0 || newI < 0) return prev
      const next = arrayMove(prev, oldI, newI)
      try {
        localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(NAV_ORDER_CHANGED_EVENT))
      }
      return next
    })
  }

  if (!dndBereit) {
    return <StatischeLeiste orderedDefs={orderedDefs} pathname={pathname} />
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={horizontalListSortingStrategy}>
        <div className="flex w-full min-w-0 items-center gap-0.5 overflow-x-auto pb-0.5 [scrollbar-gutter:stable] md:overflow-visible md:pb-0">
          {orderedDefs.map((d) => (
            <SortableNavItem key={d.href} def={d} pathname={pathname} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

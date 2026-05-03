'use client'

import type { ReactNode } from 'react'
import { startTransition, useEffect, useLayoutEffect, useCallback, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  DEFAULT_HREF_ORDER,
  NAV_ORDER_CHANGED_EVENT,
  NAV_ORDER_KEY,
  adjacentNavHref,
  mergePersistedWithKnown,
} from '@/lib/nav-model'

const SWIPE_MIN_DX = 72
const SWIPE_MAX_ABS_DY = 72

function swipeTargetIgnored(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false
  return Boolean(el.closest('input, textarea, select, [role="slider"], [data-no-swipe-nav]'))
}

function startsInsideHorizontalScroller(el: Element | null): boolean {
  let node: Element | null = el
  for (let depth = 0; depth < 14 && node; depth++, node = node.parentElement) {
    const html = node as HTMLElement
    const ox = window.getComputedStyle(html).overflowX
    if (ox !== 'auto' && ox !== 'scroll') continue
    if (html.scrollWidth > html.clientWidth + 6) return true
  }
  return false
}

export function MobileSwipePageNav({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [order, setOrder] = useState<string[]>(DEFAULT_HREF_ORDER)
  const [mobileNav, setMobileNav] = useState(false)

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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobileNav(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const gestureRef = useRef<{
    pointerId: number
    x: number
    y: number
    ignore: boolean
  } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!mobileNav) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (swipeTargetIgnored(e.target)) return
      const el = e.target instanceof Element ? e.target : null
      if (startsInsideHorizontalScroller(el)) return

      gestureRef.current = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        ignore: false,
      }
    },
    [mobileNav],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId || g.ignore) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dy) > SWIPE_MAX_ABS_DY && Math.abs(dy) >= Math.abs(dx)) {
      g.ignore = true
    }
  }, [])

  const endGesture = useCallback(
    (e: React.PointerEvent) => {
      const g = gestureRef.current
      gestureRef.current = null
      if (!g || g.pointerId !== e.pointerId || g.ignore || !mobileNav) return

      const dx = e.clientX - g.x
      const dy = e.clientY - g.y
      if (Math.abs(dx) < SWIPE_MIN_DX) return
      if (Math.abs(dx) < Math.abs(dy) * 1.15) return
      if (Math.abs(dy) > SWIPE_MAX_ABS_DY) return

      // Finger nach links → nächste Seite
      const direction = dx < 0 ? 'next' : 'prev'
      const href = adjacentNavHref(pathname, order, direction)
      if (!href) return
      router.push(href)
    },
    [mobileNav, pathname, order, router],
  )

  return (
    <div
      className="min-h-full touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      {children}
    </div>
  )
}

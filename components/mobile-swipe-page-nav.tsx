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

/** Normales Wischen: etwas niedriger = schneller „greift“. */
const SWIPE_MIN_DX = 48
/** Kurzer Flick: weniger Weg nötig, wenn Bewegung schnell genug. */
const FLICK_MIN_DX = 32
const FLICK_MAX_MS = 340
/** Mindestgeschwindigkeit in px/ms für Flick-Erkennung. */
const FLICK_MIN_VX = 0.2

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

  const navRef = useRef({ pathname, order })
  navRef.current = { pathname, order }

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

  useEffect(() => {
    if (!mobileNav) return
    const { pathname: p, order: o } = navRef.current
    const next = adjacentNavHref(p, o, 'next')
    const prev = adjacentNavHref(p, o, 'prev')
    if (next) router.prefetch(next)
    if (prev) router.prefetch(prev)
  }, [mobileNav, pathname, order, router])

  const gestureRef = useRef<{
    pointerId: number
    x: number
    y: number
    t0: number
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
        t0: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      }
    },
    [mobileNav],
  )

  const endGesture = useCallback(
    (e: React.PointerEvent) => {
      const g = gestureRef.current
      gestureRef.current = null
      if (!g || g.pointerId !== e.pointerId || !mobileNav) return

      const dx = e.clientX - g.x
      const dy = e.clientY - g.y
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)

      if (adx < 1 && ady < 1) return

      if (ady > adx * 1.06) return

      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const dt = Math.max(8, t1 - g.t0)
      const vx = adx / dt

      const flick = dt <= FLICK_MAX_MS && vx >= FLICK_MIN_VX && adx >= FLICK_MIN_DX && adx >= ady * 0.92
      const pull = adx >= SWIPE_MIN_DX && adx > ady * 1.02

      if (!flick && !pull) return

      const direction = dx < 0 ? 'next' : 'prev'
      const { pathname: p, order: o } = navRef.current
      const href = adjacentNavHref(p, o, direction)
      if (!href) return
      startTransition(() => {
        router.push(href)
      })
    },
    [mobileNav, router],
  )

  return (
    <div
      className="min-h-full touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      {children}
    </div>
  )
}

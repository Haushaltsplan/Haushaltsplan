'use client'

import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
  DEFAULT_HREF_ORDER,
  HREF_TO_DEF,
  NAV_ORDER_CHANGED_EVENT,
  NAV_ORDER_KEY,
  type NavItem,
  mergePersistedWithKnown,
} from '@/lib/nav-model'

export function useNavOrder() {
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

  const persistOrder = useCallback((next: string[]) => {
    setOrder(next)
    try {
      localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
      pushClientState('nav-order', next)
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(NAV_ORDER_CHANGED_EVENT))
    }
  }, [])

  return { order, orderedDefs, persistOrder }
}

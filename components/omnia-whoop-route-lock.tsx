'use client'

/**
 * Omnia Whoop darf nur Fitness (+ Auth/Rechtliches) sehen — kein Haushalt-Chrome.
 */

import { istOmniaWhoopApp } from '@/lib/omnia-native/omnia-native'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

const ERLAUBT = [
  '/fitnessdaten',
  '/auth',
  '/datenschutz',
]

function pfadErlaubt(pathname: string | null): boolean {
  if (!pathname) return true
  return ERLAUBT.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function OmniaWhoopRouteLock() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!istOmniaWhoopApp()) return
    if (pfadErlaubt(pathname)) return
    router.replace('/fitnessdaten')
  }, [pathname, router])

  return null
}

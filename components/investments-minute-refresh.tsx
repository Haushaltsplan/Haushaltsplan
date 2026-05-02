'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

/** Standard 5 Min.; siehe NEXT_PUBLIC_INVESTMENTS_REFRESH_MS (min. 120 s). */
function investmentsRefreshMs(): number {
  const raw = process.env.NEXT_PUBLIC_INVESTMENTS_REFRESH_MS
  const n = raw != null && raw !== '' ? Number(raw) : NaN
  if (Number.isFinite(n) && n >= 120_000) return Math.floor(n)
  return 300_000
}

/** Ruft die Route nur in einem festen Intervall neu auf — keine Minuten-Trommel für KI/Movers. */
export function InvestmentsMinuteRefresh() {
  const router = useRouter()
  const intervalMs = useMemo(() => investmentsRefreshMs(), [])

  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [router, intervalMs])

  return null
}

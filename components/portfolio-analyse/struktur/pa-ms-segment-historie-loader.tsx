'use client'

import { useEffect, useState } from 'react'

import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { PaSecSegmentHistorie } from '@/components/portfolio-analyse/struktur/pa-sec-segment-historie'
import type { SecSegmentHistoriePaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { supabase } from '@/lib/supabase'

export function PaMsSegmentHistorieLoader({
  isin,
  name,
  symbolYahoo,
  ticker,
  initial,
}: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
  initial?: SecSegmentHistoriePaket | null
}) {
  const [paket, setPaket] = useState<SecSegmentHistoriePaket | null>(initial ?? null)
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    if (!isin && !symbolYahoo && !ticker) {
      setLaden(false)
      setFehler('Keine ISIN oder kein Symbol für Marketscreener-Abruf.')
      return
    }

    let cancelled = false
    async function run() {
      setLaden(true)
      setFehler(null)
      const q = new URLSearchParams()
      if (isin) q.set('isin', isin)
      if (name) q.set('name', name)
      if (symbolYahoo) q.set('symbol', symbolYahoo)
      if (ticker) q.set('ticker', ticker)

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Bearer ${token}`

        const res = await fetch(`/api/portfolio-analyse/marketscreener-segmente?${q.toString()}`, {
          cache: 'no-store',
          headers,
        })
        const j = (await res.json()) as {
          ok?: boolean
          paket?: SecSegmentHistoriePaket | null
          fehler?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setPaket(null)
          setFehler(
            res.status === 401
              ? 'Anmeldung erforderlich — bitte neu laden.'
              : j.fehler ?? `Marketscreener-Abruf fehlgeschlagen (HTTP ${res.status}).`,
          )
          return
        }
        if (j.ok && j.paket) {
          setPaket(j.paket)
          setFehler(null)
        } else if (initial) {
          setPaket(initial)
          setFehler(j.fehler ?? 'Marketscreener — Fallback auf zwischengespeicherte Daten.')
        } else {
          setPaket(null)
          setFehler(j.fehler ?? 'Keine Segmentdaten (Marketscreener).')
        }
      } catch {
        if (!cancelled) {
          setPaket(initial ?? null)
          setFehler('Marketscreener-Abruf fehlgeschlagen.')
        }
      } finally {
        if (!cancelled) setLaden(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [isin, name, symbolYahoo, ticker, initial])

  if (laden) {
    return (
      <PaCard variant="elevated" className="p-5 text-sm text-[var(--app-text-muted)]">
        Geschäftsstruktur wird von Marketscreener geladen …
      </PaCard>
    )
  }

  if (paket) return <PaSecSegmentHistorie paket={paket} />

  return (
    <PaCard variant="elevated" className="p-5 text-sm text-[var(--app-text-muted)]">
      <p className="font-medium text-[var(--app-text)]">Geschäftsstruktur (Segment & Region)</p>
      <p className="mt-2">{fehler ?? 'Keine Segmentdaten verfügbar.'}</p>
    </PaCard>
  )
}

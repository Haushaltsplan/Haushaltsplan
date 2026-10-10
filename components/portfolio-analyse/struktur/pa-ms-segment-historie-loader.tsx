'use client'

import { useEffect, useState } from 'react'

import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { PaSecSegmentHistorie } from '@/components/portfolio-analyse/struktur/pa-sec-segment-historie'
import type { SecSegmentHistoriePaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import type { FundamentalMetrikZeile } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  baueUmsatzProJahrAusFinanzzeile,
  normalisiereSegmentPaketGegenUmsatz,
} from '@/lib/portfolio-analyse/segment-umsatz-abgleich'
import { supabase } from '@/lib/supabase'

function segmentIdentKey(opts: {
  isin?: string | null
  symbolYahoo?: string | null
  ticker?: string | null
}): string {
  return (
    opts.isin?.trim().toUpperCase() ||
    opts.ticker?.trim().toUpperCase() ||
    opts.symbolYahoo?.trim().toUpperCase() ||
    ''
  )
}

export function PaMsSegmentHistorieLoader({
  isin,
  name,
  symbolYahoo,
  ticker,
  initial,
  umsatzZeile,
  layout = 'default',
}: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
  initial?: SecSegmentHistoriePaket | null
  umsatzZeile?: FundamentalMetrikZeile | null
  /** Struktur-Tab: getrennte Kapitel Umsatzmix / Backlog ohne äußere Karte. */
  layout?: 'default' | 'struktur'
}) {
  const ident = segmentIdentKey({ isin, symbolYahoo, ticker })
  const [paket, setPaket] = useState<SecSegmentHistoriePaket | null>(initial ?? null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  // Bei Unternehmenswechsel sofort alten Mix verwerfen (kein Mastercard-Bleed).
  useEffect(() => {
    setPaket(initial ?? null)
    setFehler(null)
  }, [ident, initial])

  useEffect(() => {
    if (!ident) {
      setFehler('Keine ISIN oder kein Symbol für Segment-Abruf.')
      setPaket(null)
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
          setPaket(initial ?? null)
          setFehler(
            res.status === 401
              ? 'Anmeldung erforderlich — bitte neu laden.'
              : j.fehler ?? `Segment-Abruf fehlgeschlagen (HTTP ${res.status}).`,
          )
          return
        }
        if (j.ok && j.paket) {
          const umsatzMap = baueUmsatzProJahrAusFinanzzeile(umsatzZeile)
          const norm =
            umsatzMap.size > 0
              ? (normalisiereSegmentPaketGegenUmsatz(j.paket, umsatzMap) ?? j.paket)
              : j.paket
          setPaket(norm)
          setFehler(null)
        } else if (initial) {
          setPaket(initial)
          setFehler(j.fehler ?? 'Live-Abruf fehlgeschlagen — zwischengespeicherte Daten.')
        } else {
          setPaket(null)
          setFehler(j.fehler ?? 'Keine Segment- oder Backlog-Daten.')
        }
      } catch {
        if (!cancelled) {
          setPaket(initial ?? null)
          setFehler(
            initial
              ? 'Live-Abruf fehlgeschlagen — zwischengespeicherte Daten.'
              : 'Segment-Abruf fehlgeschlagen.',
          )
        }
      } finally {
        if (!cancelled) setLaden(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [ident, isin, name, symbolYahoo, ticker, initial, umsatzZeile])

  if (paket) {
    return (
      <div className="space-y-2">
        {laden ? (
          <p className="text-xs text-[var(--app-text-muted)]">Umsatzmix wird aktualisiert …</p>
        ) : null}
        {fehler ? <p className="text-xs text-amber-400/90">{fehler}</p> : null}
        <PaSecSegmentHistorie key={ident} paket={paket} layout={layout} />
      </div>
    )
  }

  if (laden) {
    return (
      <PaCard variant="elevated" className="p-5 text-sm text-[var(--app-text-muted)]">
        Umsatzmix wird geladen …
      </PaCard>
    )
  }

  if (layout === 'struktur') {
    return (
      <p className="rounded-2xl border border-[var(--app-border)]/55 bg-[var(--app-surface)]/40 p-5 text-sm text-[var(--app-text-muted)]">
        {fehler ?? 'Keine Segment- oder Backlog-Daten verfügbar.'}
      </p>
    )
  }

  return (
    <PaCard variant="elevated" className="p-5 text-sm text-[var(--app-text-muted)]">
      <p className="font-medium text-[var(--app-text)]">Geschäftsstruktur (Segment & Region)</p>
      <p className="mt-2">{fehler ?? 'Keine Segmentdaten verfügbar.'}</p>
    </PaCard>
  )
}

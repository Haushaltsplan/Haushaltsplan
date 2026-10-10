'use client'

import { useEffect, useRef, useState } from 'react'

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

function hatSegmentInhalt(p: SecSegmentHistoriePaket | null | undefined): boolean {
  return Boolean(p?.produkt?.jahre?.length || p?.geo?.jahre?.length || p?.backlog)
}

/** StockAnalysis-only nicht als „fertigen Cache“ zeigen — sonst blitzt SA vor SEC. */
function istSofortZeigbar(p: SecSegmentHistoriePaket | null | undefined): boolean {
  if (!hatSegmentInhalt(p)) return false
  if (p!.quelle === 'stockanalysis') return false
  return true
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
  const [paket, setPaket] = useState<SecSegmentHistoriePaket | null>(() =>
    istSofortZeigbar(initial) ? (initial ?? null) : null,
  )
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const aktivIdent = useRef(ident)

  // Unternehmenswechsel: alten Mix sofort verwerfen, dann ggf. neues Initial setzen.
  useEffect(() => {
    aktivIdent.current = ident
    setFehler(null)
    setPaket(istSofortZeigbar(initial) ? (initial ?? null) : null)
  }, [ident, initial])

  useEffect(() => {
    if (!ident) {
      setFehler('Keine ISIN oder kein Symbol für Segment-Abruf.')
      setPaket(null)
      return
    }

    const hatCache = istSofortZeigbar(initial)
    const ac = new AbortController()
    const requestIdent = ident
    aktivIdent.current = requestIdent

    async function run() {
      if (hatCache) {
        setPaket(initial ?? null)
        setLaden(false)
        setFehler(null)
      } else {
        // Kein SEC/Mixed-Initial → warten (nicht StockAnalysis vorblitzen)
        setPaket(null)
        setLaden(true)
        setFehler(null)
      }

      const q = new URLSearchParams()
      if (isin) q.set('isin', isin)
      if (name) q.set('name', name)
      if (symbolYahoo) q.set('symbol', symbolYahoo)
      if (ticker) q.set('ticker', ticker)
      if (hatCache) q.set('preferCache', '1')

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (ac.signal.aborted || aktivIdent.current !== requestIdent) return
        const token = sessionData.session?.access_token
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Bearer ${token}`

        const res = await fetch(`/api/portfolio-analyse/marketscreener-segmente?${q.toString()}`, {
          cache: 'no-store',
          headers,
          signal: ac.signal,
        })
        const j = (await res.json()) as {
          ok?: boolean
          paket?: SecSegmentHistoriePaket | null
          fehler?: string
          ausCache?: boolean
        }
        if (ac.signal.aborted || aktivIdent.current !== requestIdent) return
        if (!res.ok) {
          if (!hatCache) {
            setPaket(null)
            setFehler(
              res.status === 401
                ? 'Anmeldung erforderlich — bitte neu laden.'
                : j.fehler ?? `Segment-Abruf fehlgeschlagen (HTTP ${res.status}).`,
            )
          }
          return
        }
        if (j.ok && j.paket) {
          const umsatzMap = baueUmsatzProJahrAusFinanzzeile(umsatzZeile)
          const norm =
            umsatzMap.size > 0
              ? (normalisiereSegmentPaketGegenUmsatz(j.paket, umsatzMap) ?? j.paket)
              : j.paket
          if (aktivIdent.current !== requestIdent) return
          setPaket(norm)
          setFehler(null)
        } else if (!hatCache) {
          setPaket(null)
          setFehler(j.fehler ?? 'Keine Segment- oder Backlog-Daten.')
        }
      } catch (e) {
        if (ac.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return
        if (aktivIdent.current !== requestIdent) return
        if (!hatCache) {
          setPaket(null)
          setFehler('Segment-Abruf fehlgeschlagen.')
        }
      } finally {
        if (!ac.signal.aborted && aktivIdent.current === requestIdent) setLaden(false)
      }
    }

    void run()
    return () => {
      ac.abort()
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

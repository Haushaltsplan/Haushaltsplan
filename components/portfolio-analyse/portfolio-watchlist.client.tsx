'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaAktienSucheInput } from '@/components/portfolio-analyse/pa-aktien-suche-input'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaFundamentalInhalt } from '@/components/portfolio-analyse/pa-fundamental-inhalt'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { watchlistHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import {
  entferneAusWatchlist,
  findeWatchlistIdx,
  fuegeZurWatchlistHinzu,
  ladeWatchlist,
  ladeWatchlistMitCloudMerge,
  watchlistEintragAusMeta,
  watchlistSchluessel,
  type WatchlistEintrag,
} from '@/lib/portfolio-analyse/watchlist-client'

export function PortfolioWatchlistClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isinParam = searchParams.get('isin')
  const symbolParam = searchParams.get('symbol')
  const { meta } = usePortfolioAnalyse()
  const [eintraege, setEintraege] = useState<WatchlistEintrag[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [hinzufuegenLaden, setHinzufuegenLaden] = useState(false)
  const [hinzufuegenFehler, setHinzufuegenFehler] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setEintraege(ladeWatchlist())
  }, [])

  useEffect(() => {
    refresh()
    // Danach mit dem Cloud-Stand vereinigen (Einträge von anderen Geräten + Radar-Sync)
    let aktiv = true
    void ladeWatchlistMitCloudMerge().then((merged) => {
      if (aktiv) setEintraege(merged)
    })
    return () => {
      aktiv = false
    }
  }, [refresh])

  useEffect(() => {
    if (eintraege.length === 0 || (!isinParam && !symbolParam)) return
    const idx = findeWatchlistIdx(eintraege, { isin: isinParam, symbol: symbolParam })
    if (idx >= 0) setSelectedIdx(idx)
  }, [eintraege, isinParam, symbolParam])

  const selected = eintraege[selectedIdx] ?? null

  const waehleEintrag = useCallback(
    (idx: number) => {
      setSelectedIdx(idx)
      const e = eintraege[idx]
      if (e) router.replace(watchlistHref({ isin: e.isin, symbol: e.symbolYahoo }), { scroll: false })
    },
    [eintraege, router],
  )

  const anfrage = useMemo(
    () =>
      selected
        ? {
            isin: selected.isin,
            name: selected.name,
            symbolYahoo: selected.symbolYahoo,
            symbolCandidates: selected.symbolCandidates,
            tickerOverride: null,
          }
        : null,
    [selected],
  )

  const hinzufuegen = useCallback(
    async (auswahl: { meta: Parameters<typeof watchlistEintragAusMeta>[0]; isin: string | null }) => {
      setHinzufuegenFehler(null)
      const neu = watchlistEintragAusMeta(auswahl.meta, auswahl.isin)
      if (findeWatchlistIdx(eintraege, { isin: neu.isin, symbol: neu.symbolYahoo }) >= 0) {
        setHinzufuegenFehler('Diese Aktie ist bereits auf der Watchlist.')
        return
      }
      setHinzufuegenLaden(true)
      try {
        const next = fuegeZurWatchlistHinzu(neu)
        setEintraege(next)
        setSelectedIdx(0)
        router.replace(watchlistHref({ isin: neu.isin, symbol: neu.symbolYahoo }), { scroll: false })
      } finally {
        setHinzufuegenLaden(false)
      }
    },
    [eintraege, router],
  )

  function onEntfernen(e: WatchlistEintrag) {
    const next = entferneAusWatchlist(watchlistSchluessel(e))
    setEintraege(next)
    if (selectedIdx >= next.length) {
      setSelectedIdx(Math.max(0, next.length - 1))
    }
    if (next.length === 0) router.replace(watchlistHref(), { scroll: false })
  }

  return (
    <PortfolioAnalyseShell
      title="Watchlist"
      description="Aktien außerhalb deines Depots beobachten — mit denselben Fundamentaldaten wie im Depot."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-start">
        <PaCard className="overflow-hidden">
          <div className="border-b border-white/[0.04] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--app-text)]">Beobachtungsliste</h2>
            <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">{eintraege.length} Eintrag(e)</p>
          </div>

          <div className="border-b border-white/[0.04] p-4">
            <PaAktienSucheInput
              onAuswahl={hinzufuegen}
              laden={hinzufuegenLaden}
              fehler={hinzufuegenFehler}
              onFehler={setHinzufuegenFehler}
            />
          </div>

          {eintraege.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">
              Noch keine Aktien auf der Watchlist.
            </p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-white/[0.04] overflow-y-auto">
              {eintraege.map((e, i) => (
                <li key={watchlistSchluessel(e)}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 ${selectedIdx === i ? 'bg-teal-500/10' : 'hover:bg-white/[0.02]'}`}
                  >
                    <button
                      type="button"
                      onClick={() => waehleEintrag(i)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--app-text)]">{e.name}</p>
                        <p className="truncate text-[10px] text-[var(--app-text-muted)]">
                          {e.isin ?? e.symbolYahoo ?? '—'}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      title="Entfernen"
                      onClick={() => onEntfernen(e)}
                      className="shrink-0 rounded p-1.5 text-[var(--app-text-muted)] hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PaCard>

        <PaFundamentalInhalt
          anfrage={anfrage}
          selectionKey={selected ? watchlistSchluessel(selected) : undefined}
        />
      </div>
    </PortfolioAnalyseShell>
  )
}

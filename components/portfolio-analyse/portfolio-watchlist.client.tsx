'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaAktienSucheInput } from '@/components/portfolio-analyse/pa-aktien-suche-input'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaFundamentalInhalt } from '@/components/portfolio-analyse/pa-fundamental-inhalt'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PA_SCROLL_ELEGANT } from '@/components/portfolio-analyse/pa-ui'
import { watchlistHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import {
  entferneAusWatchlist,
  findeWatchlistIdx,
  fuegeZurWatchlistHinzu,
  ladeWatchlist,
  ladeWatchlistMitCloudMerge,
  watchlistEintragAusMeta,
  watchlistSchluessel,
  WATCHLIST_CHANGED_EVENT,
  type WatchlistEintrag,
} from '@/lib/portfolio-analyse/watchlist-client'

function tickerKurz(e: WatchlistEintrag): string {
  const s = e.symbolYahoo?.trim()
  if (s) return s.replace(/\.[^.]+$/, '').toUpperCase()
  return (e.isin ?? '—').slice(0, 4)
}

export function PortfolioWatchlistClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isinParam = searchParams.get('isin')
  const symbolParam = searchParams.get('symbol')
  const { meta } = usePortfolioAnalyse()
  const [eintraege, setEintraege] = useState<WatchlistEintrag[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [hinzufuegenLaden, setHinzufuegenLaden] = useState(false)
  const [hinzufuegenFehler, setHinzufuegenFehler] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setEintraege(ladeWatchlist())
  }, [])

  useEffect(() => {
    refresh()
    let aktiv = true
    void ladeWatchlistMitCloudMerge().then((merged) => {
      if (aktiv) setEintraege(merged)
    })
    const onChanged = () => refresh()
    window.addEventListener(WATCHLIST_CHANGED_EVENT, onChanged)
    return () => {
      aktiv = false
      window.removeEventListener(WATCHLIST_CHANGED_EVENT, onChanged)
    }
  }, [refresh])

  // Auswahl aus URL oder erstem Eintrag — per stabilem Schlüssel, nicht Index
  useEffect(() => {
    if (eintraege.length === 0) {
      setSelectedKey(null)
      return
    }
    if (isinParam || symbolParam) {
      const idx = findeWatchlistIdx(eintraege, { isin: isinParam, symbol: symbolParam })
      if (idx >= 0) {
        setSelectedKey(watchlistSchluessel(eintraege[idx]!))
        return
      }
    }
    setSelectedKey((prev) => {
      if (prev && eintraege.some((e) => watchlistSchluessel(e) === prev)) return prev
      return watchlistSchluessel(eintraege[0]!)
    })
  }, [eintraege, isinParam, symbolParam])

  const selected = useMemo(
    () => (selectedKey ? eintraege.find((e) => watchlistSchluessel(e) === selectedKey) ?? null : null),
    [eintraege, selectedKey],
  )

  const waehleEintrag = useCallback(
    (e: WatchlistEintrag) => {
      setSelectedKey(watchlistSchluessel(e))
      router.replace(watchlistHref({ isin: e.isin, symbol: e.symbolYahoo }), { scroll: false })
    },
    [router],
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
        setSelectedKey(watchlistSchluessel(neu))
        router.replace(watchlistHref({ isin: neu.isin, symbol: neu.symbolYahoo }), { scroll: false })
      } finally {
        setHinzufuegenLaden(false)
      }
    },
    [eintraege, router],
  )

  function onEntfernen(e: WatchlistEintrag) {
    const key = watchlistSchluessel(e)
    const next = entferneAusWatchlist(key)
    setEintraege(next)
    if (selectedKey === key) {
      const neu = next[0] ?? null
      setSelectedKey(neu ? watchlistSchluessel(neu) : null)
      router.replace(
        neu ? watchlistHref({ isin: neu.isin, symbol: neu.symbolYahoo }) : watchlistHref(),
        { scroll: false },
      )
    }
  }

  return (
    <PortfolioAnalyseShell
      title="Watchlist"
      description="Außerhalb des Depots beobachten — dieselben Fundamentaldaten wie im Depot."
    >
      {/* Feste Viewport-Höhe: linke Liste sticky, rechte Detailfläche scrollt intern — kein Springen */}
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-stretch lg:min-h-[calc(100dvh-11rem)]">
        <PaCard className="flex min-h-0 flex-col overflow-hidden lg:sticky lg:top-3 lg:max-h-[calc(100dvh-11rem)]">
          <div className="shrink-0 border-b border-white/[0.04] px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--app-text)]">Liste</h2>
              <span className="text-[11px] tabular-nums text-[var(--app-text-muted)]">
                {eintraege.length}
              </span>
            </div>
          </div>

          <div className="shrink-0 border-b border-white/[0.04] px-3 py-2.5">
            <PaAktienSucheInput
              onAuswahl={hinzufuegen}
              laden={hinzufuegenLaden}
              fehler={hinzufuegenFehler}
              onFehler={setHinzufuegenFehler}
              kompakt
            />
          </div>

          {eintraege.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--app-text-muted)]">
              Noch keine Aktien — oben suchen und hinzufügen.
            </p>
          ) : (
            <ul className={`min-h-0 flex-1 divide-y divide-white/[0.04] overflow-y-auto ${PA_SCROLL_ELEGANT}`}>
              {eintraege.map((e) => {
                const key = watchlistSchluessel(e)
                const aktiv = selectedKey === key
                return (
                  <li key={key}>
                    <div
                      className={`group flex items-stretch gap-0 ${
                        aktiv ? 'bg-teal-500/[0.12]' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => waehleEintrag(e)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
                      >
                        <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`shrink-0 rounded px-1 py-px text-[10px] font-bold tabular-nums tracking-wide ${
                                aktiv
                                  ? 'bg-teal-500/20 text-teal-200'
                                  : 'bg-white/[0.06] text-[var(--app-text-muted)]'
                              }`}
                            >
                              {tickerKurz(e)}
                            </span>
                            <p className="truncate text-[13px] font-medium leading-tight text-[var(--app-text)]">
                              {e.name}
                            </p>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-[var(--app-text-muted)]">
                            {e.isin ?? e.symbolYahoo ?? '—'}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        title="Entfernen"
                        onClick={() => onEntfernen(e)}
                        className="shrink-0 px-2.5 text-[var(--app-text-muted)] opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 focus:opacity-100"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </PaCard>

        <div className="min-h-[28rem] min-w-0 lg:min-h-0">
          <PaFundamentalInhalt
            anfrage={anfrage}
            selectionKey={selected ? watchlistSchluessel(selected) : undefined}
            alleScrapZiele={eintraege.map((e) => ({
              isin: e.isin,
              name: e.name,
              symbolYahoo: e.symbolYahoo,
              symbolCandidates: e.symbolCandidates,
            }))}
          />
        </div>
      </div>
    </PortfolioAnalyseShell>
  )
}

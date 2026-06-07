'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaFundamentalInhalt } from '@/components/portfolio-analyse/pa-fundamental-inhalt'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { watchlistHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import { ladeIsinMetadaten } from '@/lib/portfolio-analyse/isin-metadata-client'
import {
  entferneAusWatchlist,
  findeWatchlistIdx,
  fuegeZurWatchlistHinzu,
  istGueltigeIsin,
  ladeWatchlist,
  type WatchlistEintrag,
} from '@/lib/portfolio-analyse/watchlist-client'

export function PortfolioWatchlistClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isinParam = searchParams.get('isin')
  const { meta } = usePortfolioAnalyse()
  const [eintraege, setEintraege] = useState<WatchlistEintrag[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [isinInput, setIsinInput] = useState('')
  const [hinzufuegenLaden, setHinzufuegenLaden] = useState(false)
  const [hinzufuegenFehler, setHinzufuegenFehler] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setEintraege(ladeWatchlist())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (eintraege.length === 0 || !isinParam) return
    const idx = findeWatchlistIdx(eintraege, { isin: isinParam })
    if (idx >= 0) setSelectedIdx(idx)
  }, [eintraege, isinParam])

  const selected = eintraege[selectedIdx] ?? null

  const waehleEintrag = useCallback(
    (idx: number) => {
      setSelectedIdx(idx)
      const e = eintraege[idx]
      if (e) router.replace(watchlistHref({ isin: e.isin }), { scroll: false })
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

  async function onHinzufuegen(e: React.FormEvent) {
    e.preventDefault()
    const isin = isinInput.trim().toUpperCase()
    setHinzufuegenFehler(null)
    if (!istGueltigeIsin(isin)) {
      setHinzufuegenFehler('Bitte eine gültige ISIN eingeben (12 Zeichen).')
      return
    }
    if (findeWatchlistIdx(eintraege, { isin }) >= 0) {
      setHinzufuegenFehler('Diese ISIN ist bereits auf der Watchlist.')
      return
    }
    setHinzufuegenLaden(true)
    try {
      const map = await ladeIsinMetadaten([isin])
      const metaEintrag = map.get(isin)
      if (!metaEintrag?.symbolYahoo && !metaEintrag?.name) {
        setHinzufuegenFehler('ISIN nicht gefunden — prüfe die Eingabe.')
        return
      }
      const assetType = metaEintrag.assetType?.toLowerCase() ?? ''
      if (assetType.includes('etf') || assetType.includes('fund')) {
        setHinzufuegenFehler('ETFs/Fonds eignen sich nicht für Macrotrends-Fundamentaldaten.')
        return
      }
      const neu: WatchlistEintrag = {
        isin,
        name: metaEintrag.name,
        symbolYahoo: metaEintrag.symbolYahoo,
        symbolCandidates: metaEintrag.symbolCandidates,
        hinzugefuegtAm: new Date().toISOString(),
      }
      const next = fuegeZurWatchlistHinzu(neu)
      setEintraege(next)
      setIsinInput('')
      setSelectedIdx(0)
      router.replace(watchlistHref({ isin }), { scroll: false })
    } catch {
      setHinzufuegenFehler('Abfrage fehlgeschlagen — später erneut versuchen.')
    } finally {
      setHinzufuegenLaden(false)
    }
  }

  function onEntfernen(isin: string) {
    const next = entferneAusWatchlist(isin)
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
            <h2 className="text-sm font-semibold text-zinc-100">Beobachtungsliste</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">{eintraege.length} Eintrag(e)</p>
          </div>

          <form onSubmit={(ev) => void onHinzufuegen(ev)} className="border-b border-white/[0.04] p-4">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              ISIN hinzufügen
            </label>
            <div className="flex gap-2">
              <input
                value={isinInput}
                onChange={(ev) => setIsinInput(ev.target.value.toUpperCase())}
                placeholder="US0378331005"
                maxLength={12}
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
              />
              <button
                type="submit"
                disabled={hinzufuegenLaden}
                className="shrink-0 rounded-lg bg-teal-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
              >
                +
              </button>
            </div>
            {hinzufuegenFehler ? (
              <p className="mt-2 text-[11px] text-amber-400/90">{hinzufuegenFehler}</p>
            ) : (
              <p className="mt-2 text-[10px] text-zinc-600">Nur Einzelaktien · Daten lokal gespeichert</p>
            )}
          </form>

          {eintraege.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Noch keine Aktien auf der Watchlist.
            </p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-white/[0.04] overflow-y-auto">
              {eintraege.map((e, i) => (
                <li key={e.isin}>
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
                        <p className="truncate text-sm font-medium text-zinc-100">{e.name}</p>
                        <p className="font-mono text-[10px] text-zinc-500">{e.isin}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      title="Entfernen"
                      onClick={() => onEntfernen(e.isin)}
                      className="shrink-0 rounded p-1.5 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400"
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

        <PaFundamentalInhalt anfrage={anfrage} selectionKey={selected?.isin} />
      </div>
    </PortfolioAnalyseShell>
  )
}

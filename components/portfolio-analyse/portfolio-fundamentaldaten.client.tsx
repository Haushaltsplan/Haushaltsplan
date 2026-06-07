'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaFundamentalInhalt } from '@/components/portfolio-analyse/pa-fundamental-inhalt'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  findeFundamentalPositionIdx,
  fundamentaldatenHref,
  type FundamentalKandidat,
  WATCHLIST_PFAD,
} from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeWatchlist } from '@/lib/portfolio-analyse/watchlist-client'

export function PortfolioFundamentaldatenClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isinParam = searchParams.get('isin')
  const symbolParam = searchParams.get('symbol')
  const { live, meta, hatDaten, laden: paLaden } = usePortfolioAnalyse()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [watchlistVersion, setWatchlistVersion] = useState(0)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pa-watchlist-v1') setWatchlistVersion((v) => v + 1)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const kandidaten = useMemo<FundamentalKandidat[]>(() => {
    const depotIsins = new Set<string>()
    const depot: FundamentalKandidat[] = (live?.positionen ?? [])
      .filter((p) => p.stueck > 0 && p.assetKlasse === 'aktie')
      .map((p) => {
        const isin = p.isin?.trim().toUpperCase() ?? ''
        if (isin) depotIsins.add(isin)
        const k = isin ? isinKenntnis(isin) : undefined
        const m = isin ? meta.get(isin) : undefined
        return {
          isin: isin || null,
          name: p.name ?? k?.name ?? m?.name ?? 'Unbekannt',
          symbolYahoo: p.symbolYahoo ?? k?.symbolYahoo ?? m?.symbolYahoo ?? null,
          symbolCandidates: [...(k?.symbolCandidates ?? []), ...(m?.symbolYahoo ? [m.symbolYahoo] : [])],
          quelle: 'depot' as const,
        }
      })

    const watchlist: FundamentalKandidat[] = ladeWatchlist()
      .filter((w) => !w.isin || !depotIsins.has(w.isin.toUpperCase()))
      .map((w) => ({
        isin: w.isin,
        name: w.name,
        symbolYahoo: w.symbolYahoo,
        symbolCandidates: w.symbolCandidates,
        quelle: 'watchlist' as const,
      }))

    void watchlistVersion
    return [...depot, ...watchlist]
  }, [live?.positionen, meta, watchlistVersion])

  const selected = kandidaten[selectedIdx] ?? null

  useEffect(() => {
    if (kandidaten.length === 0 || (!isinParam && !symbolParam)) return
    const idx = findeFundamentalPositionIdx(kandidaten, { isin: isinParam, symbol: symbolParam })
    if (idx >= 0) setSelectedIdx(idx)
  }, [kandidaten, isinParam, symbolParam])

  const waehleKandidat = useCallback(
    (idx: number) => {
      setSelectedIdx(idx)
      const p = kandidaten[idx]
      if (!p) return
      router.replace(fundamentaldatenHref({ isin: p.isin, symbol: p.symbolYahoo }), { scroll: false })
    },
    [kandidaten, router],
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

  const depotAnzahl = kandidaten.filter((k) => k.quelle === 'depot').length
  const watchlistAnzahl = kandidaten.filter((k) => k.quelle === 'watchlist').length

  return (
    <PortfolioAnalyseShell
      title="Fundamentaldaten"
      description="Historische Kennzahlen und Bewertungsmultiples im TIKR-Stil — Daten von Macrotrends.net."
    >
      {!hatDaten && !paLaden && kandidaten.length === 0 ? (
        <PaCard className="space-y-3 p-6 text-sm text-zinc-400">
          <p>Importiere Portfolio-Daten oder lege Aktien auf der Watchlist an.</p>
          <Link href={WATCHLIST_PFAD} className="inline-block text-teal-400 hover:underline">
            Zur Watchlist →
          </Link>
        </PaCard>
      ) : kandidaten.length === 0 ? (
        <PaCard className="space-y-3 p-6 text-sm text-zinc-400">
          <p>Keine Aktien im Depot und keine Einträge auf der Watchlist.</p>
          <Link href={WATCHLIST_PFAD} className="inline-block text-teal-400 hover:underline">
            Watchlist anlegen →
          </Link>
        </PaCard>
      ) : (
        <div className="space-y-4">
          <PaCard className="p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Unternehmen
              </label>
              <Link href={WATCHLIST_PFAD} className="text-[11px] text-teal-400 hover:underline">
                Watchlist verwalten
              </Link>
            </div>
            <select
              value={selectedIdx}
              onChange={(e) => waehleKandidat(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {depotAnzahl > 0 ? (
                <optgroup label="Depot">
                  {kandidaten
                    .map((p, i) => ({ p, i }))
                    .filter(({ p }) => p.quelle === 'depot')
                    .map(({ p, i }) => (
                      <option key={`depot-${p.isin ?? p.name}-${i}`} value={i}>
                        {p.name}
                        {p.symbolYahoo ? ` (${p.symbolYahoo})` : ''}
                      </option>
                    ))}
                </optgroup>
              ) : null}
              {watchlistAnzahl > 0 ? (
                <optgroup label="Watchlist">
                  {kandidaten
                    .map((p, i) => ({ p, i }))
                    .filter(({ p }) => p.quelle === 'watchlist')
                    .map(({ p, i }) => (
                      <option key={`watch-${p.isin ?? p.symbolYahoo ?? p.name}-${i}`} value={i}>
                        {p.name}
                        {p.symbolYahoo ? ` (${p.symbolYahoo})` : ''}
                      </option>
                    ))}
                </optgroup>
              ) : null}
            </select>
          </PaCard>

          <PaFundamentalInhalt
            anfrage={anfrage}
            selectionKey={selected ? `${selected.quelle}:${selected.isin ?? selected.name}` : undefined}
          />
        </div>
      )}
    </PortfolioAnalyseShell>
  )
}

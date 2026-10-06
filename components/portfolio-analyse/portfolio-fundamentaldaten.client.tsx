'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaFundamentalInhalt } from '@/components/portfolio-analyse/pa-fundamental-inhalt'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { usePortfolioBeraterFocus } from '@/components/portfolio-analyse/portfolio-berater'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { PaFundamentalBereichTabs } from '@/components/portfolio-analyse/pa-fundamental-bereich-tabs'
import {
  findeFundamentalPositionIdx,
  fundamentaldatenHref,
  type FundamentalKandidat,
  WATCHLIST_PFAD,
} from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  findeWatchlistIdx,
  fuegeZurWatchlistHinzu,
  ladeWatchlist,
  WATCHLIST_CHANGED_EVENT,
  watchlistEintragAusMeta,
} from '@/lib/portfolio-analyse/watchlist-client'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

export function PortfolioFundamentaldatenClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isinParam = searchParams.get('isin')
  const symbolParam = searchParams.get('symbol')
  const nameParam = searchParams.get('name')
  const { live, meta, hatDaten, laden: paLaden } = usePortfolioAnalyse()
  const setBeraterFocus = usePortfolioBeraterFocus()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [watchlistVersion, setWatchlistVersion] = useState(0)
  const [watchHinweis, setWatchHinweis] = useState<string | null>(null)

  useEffect(() => {
    const bump = () => setWatchlistVersion((v) => v + 1)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pa-watchlist-v1') bump()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(WATCHLIST_CHANGED_EVENT, bump)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(WATCHLIST_CHANGED_EVENT, bump)
    }
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
    const basis = [...depot, ...watchlist]

    const isin = isinParam?.trim().toUpperCase() || null
    const symbol = symbolParam?.trim() || null
    if (!isin && !symbol) return basis

    const schonDa = findeFundamentalPositionIdx(basis, { isin, symbol })
    if (schonDa >= 0) return basis

    const k = isin ? isinKenntnis(isin) : undefined
    const m = isin ? meta.get(isin) : undefined
    const suche: FundamentalKandidat = {
      isin,
      name: nameParam?.trim() || k?.name || m?.name || symbol || isin || 'Aktie',
      symbolYahoo: symbol || k?.symbolYahoo || m?.symbolYahoo || null,
      symbolCandidates: [
        ...(symbol ? [symbol] : []),
        ...(k?.symbolCandidates ?? []),
        ...(m?.symbolYahoo ? [m.symbolYahoo] : []),
      ],
      quelle: 'suche',
    }
    return [suche, ...basis]
  }, [live?.positionen, meta, watchlistVersion, isinParam, symbolParam, nameParam])

  const selected = kandidaten[selectedIdx] ?? null

  const aufWatchlist = useMemo(() => {
    if (!selected) return false
    return findeWatchlistIdx(ladeWatchlist(), { isin: selected.isin, symbol: selected.symbolYahoo }) >= 0
  }, [selected, watchlistVersion])

  useEffect(() => {
    if (!selected) {
      setBeraterFocus(null)
      return
    }
    setBeraterFocus({
      isin: selected.isin,
      ticker: selected.symbolYahoo?.split('.')[0] ?? null,
    })
    return () => setBeraterFocus(null)
  }, [selected, setBeraterFocus])

  useEffect(() => {
    if (kandidaten.length === 0 || (!isinParam && !symbolParam)) return
    const idx = findeFundamentalPositionIdx(kandidaten, { isin: isinParam, symbol: symbolParam })
    if (idx >= 0) setSelectedIdx(idx)
  }, [kandidaten, isinParam, symbolParam])

  const waehleKandidat = useCallback(
    (idx: number) => {
      setSelectedIdx(idx)
      setWatchHinweis(null)
      const p = kandidaten[idx]
      if (!p) return
      router.replace(
        fundamentaldatenHref({ isin: p.isin, symbol: p.symbolYahoo, name: p.name }),
        { scroll: false },
      )
    },
    [kandidaten, router],
  )

  const zurWatchlist = useCallback(() => {
    if (!selected) return
    const metaLike: IsinMetadata = {
      isin: selected.isin ?? '',
      name: selected.name,
      symbolYahoo: selected.symbolYahoo,
      symbolCandidates: selected.symbolCandidates,
      wkn: null,
      assetType: 'EQUITY',
    }
    fuegeZurWatchlistHinzu(watchlistEintragAusMeta(metaLike, selected.isin))
    setWatchlistVersion((v) => v + 1)
    setWatchHinweis(`${selected.name} zur Watchlist hinzugefügt.`)
  }, [selected])

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
  const sucheAnzahl = kandidaten.filter((k) => k.quelle === 'suche').length
  const hatUrlTitel = Boolean(isinParam || symbolParam)
  const leerOhneSuche = kandidaten.length === 0 && !hatUrlTitel

  return (
    <PortfolioAnalyseShell title="Fundamentaldaten">
      {!hatDaten && !paLaden && leerOhneSuche ? (
        <PaCard className="space-y-3 p-6 text-sm text-[var(--app-text-muted)]">
          <p>Importiere Portfolio-Daten, lege Aktien auf der Watchlist an — oder nutze die Suche oben.</p>
          <Link href={WATCHLIST_PFAD} className="inline-block text-teal-400 hover:underline">
            Zur Watchlist →
          </Link>
        </PaCard>
      ) : leerOhneSuche ? (
        <PaCard className="space-y-3 p-6 text-sm text-[var(--app-text-muted)]">
          <p>Keine Aktien im Depot und keine Einträge auf der Watchlist. Suche oben nach einem Ticker.</p>
          <Link href={WATCHLIST_PFAD} className="inline-block text-teal-400 hover:underline">
            Watchlist anlegen →
          </Link>
        </PaCard>
      ) : (
        <div className="space-y-4">
          <PaFundamentalBereichTabs aktiv="titel" />
          <PaCard className="p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
                Unternehmen
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {selected && !aufWatchlist ? (
                  <button
                    type="button"
                    onClick={zurWatchlist}
                    className="text-[11px] font-medium text-teal-300 hover:text-teal-200 hover:underline"
                  >
                    + Watchlist
                  </button>
                ) : selected && aufWatchlist ? (
                  <span className="text-[11px] text-[var(--app-text-muted)]">Auf Watchlist</span>
                ) : null}
                <Link href={WATCHLIST_PFAD} className="text-[11px] text-teal-400 hover:underline">
                  Watchlist verwalten
                </Link>
              </div>
            </div>
            {watchHinweis ? <p className="mb-2 text-[11px] text-teal-300/90">{watchHinweis}</p> : null}
            <select
              value={selectedIdx}
              onChange={(e) => waehleKandidat(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
            >
              {sucheAnzahl > 0 ? (
                <optgroup label="Suche">
                  {kandidaten
                    .map((p, i) => ({ p, i }))
                    .filter(({ p }) => p.quelle === 'suche')
                    .map(({ p, i }) => (
                      <option key={`suche-${p.isin ?? p.symbolYahoo ?? p.name}-${i}`} value={i}>
                        {p.name}
                        {p.symbolYahoo ? ` (${p.symbolYahoo})` : ''}
                      </option>
                    ))}
                </optgroup>
              ) : null}
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
            selectionKey={selected ? `${selected.quelle}:${selected.isin ?? selected.symbolYahoo ?? selected.name}` : undefined}
            alleScrapZiele={kandidaten.map((k) => ({
              isin: k.isin,
              name: k.name,
              symbolYahoo: k.symbolYahoo,
              symbolCandidates: k.symbolCandidates,
            }))}
          />
        </div>
      )}
    </PortfolioAnalyseShell>
  )
}

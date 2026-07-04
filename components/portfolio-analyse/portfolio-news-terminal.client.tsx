'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaNewsTerminal } from '@/components/portfolio-analyse/pa-news-terminal'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type {
  NewsTerminalDepotPosition,
  NewsTerminalKategorie,
  NewsTerminalPaket,
  NewsTerminalUnternehmen,
} from '@/lib/portfolio-analyse/portfolio-news-terminal-server'
import { ladeWatchlist } from '@/lib/portfolio-analyse/watchlist-client'

async function fetchNewsTerminal(opts: {
  nurHeute: boolean
  positionen: NewsTerminalDepotPosition[]
  extraUnternehmen: NewsTerminalUnternehmen[]
}): Promise<NewsTerminalPaket> {
  const res = await fetch('/api/portfolio-analyse/news-terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nurHeute: opts.nurHeute,
      positionen: opts.positionen,
      extraUnternehmen: opts.extraUnternehmen,
    }),
  })
  const json = (await res.json()) as { ok?: boolean; message?: string } & Partial<NewsTerminalPaket>
  if (!res.ok || !json.ok) {
    throw new Error(json.message ?? 'Abruf fehlgeschlagen')
  }
  return {
    zeilen: json.zeilen ?? [],
    unternehmen: json.unternehmen ?? [],
    fehler: json.fehler ?? null,
    aktualisiertAm: json.aktualisiertAm ?? new Date().toISOString(),
  }
}

export function PortfolioNewsTerminalClient() {
  const { live, hatDaten, laden: paLaden } = usePortfolioAnalyse()
  const [paket, setPaket] = useState<NewsTerminalPaket | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [nurHeute, setNurHeute] = useState(false)
  const [kategorieFilter, setKategorieFilter] = useState<NewsTerminalKategorie | 'alle'>('alle')
  const [mitWatchlist, setMitWatchlist] = useState(true)

  const depotPositionen = useMemo((): NewsTerminalDepotPosition[] => {
    return (live?.positionen ?? [])
      .filter((p) => p.assetKlasse === 'aktie' && p.stueck > 0)
      .map((p) => ({
        isin: p.isin,
        name: p.anzeigeName || p.name,
        symbolYahoo: p.symbolYahoo,
      }))
  }, [live?.positionen])

  const depotKey = useMemo(
    () => depotPositionen.map((p) => `${p.isin ?? ''}:${p.symbolYahoo ?? ''}:${p.name}`).join('|'),
    [depotPositionen],
  )

  const extraUnternehmen = useMemo(() => {
    if (!mitWatchlist) return []
    const depotIsins = new Set(depotPositionen.map((p) => p.isin?.toUpperCase()).filter(Boolean))
    return ladeWatchlist()
      .filter((w) => !w.isin || !depotIsins.has(w.isin.toUpperCase()))
      .map((w) => {
        const k = w.isin ? isinKenntnis(w.isin) : null
        const symbol = (w.symbolYahoo ?? k?.symbolYahoo ?? null)?.trim().toUpperCase() || null
        const isin = w.isin?.trim().toUpperCase() || null
        const name = k?.name ?? w.name
        const id = isin ?? symbol ?? name.trim().toUpperCase()
        return { id, name, symbol, isin } satisfies NewsTerminalUnternehmen
      })
      .filter((e) => e.symbol)
  }, [mitWatchlist, depotKey, depotPositionen])

  const extraKey = useMemo(
    () => extraUnternehmen.map((e) => e.id).sort().join('|'),
    [extraUnternehmen],
  )

  const ladenTerminal = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const data = await fetchNewsTerminal({ nurHeute, positionen: depotPositionen, extraUnternehmen })
      setPaket(data)
    } catch (e) {
      setPaket(null)
      setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
    } finally {
      setLaden(false)
    }
  }, [nurHeute, depotPositionen, extraUnternehmen])

  useEffect(() => {
    if (!hatDaten && !paLaden) return
    if (depotPositionen.length === 0 && extraUnternehmen.length === 0) return
    void ladenTerminal()
  }, [hatDaten, paLaden, nurHeute, depotKey, extraKey, ladenTerminal, depotPositionen.length, extraUnternehmen.length])

  const heuteCount = paket?.zeilen.filter((z) => z.istHeute).length ?? 0

  return (
    <PortfolioAnalyseShell
      title="News-Terminal"
      description="Finanzrelevante Meldungen deiner Depot-Positionen auf einen Blick — dieselbe Quelle wie unter Fundamentaldaten → News."
    >
      {!paLaden && !hatDaten ? null : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--app-text-muted)]">
              {laden && !paket
                ? `Lade Meldungen für ${depotPositionen.length} Position(en) …`
                : `${paket?.zeilen.length ?? 0} Meldung(en)${nurHeute ? ` · ${heuteCount} heute` : ' · 48 Stunden'}`}
              {mitWatchlist && extraUnternehmen.length > 0
                ? ` · +${extraUnternehmen.length} Watchlist`
                : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-[var(--app-text-muted)]">
                <input
                  type="checkbox"
                  checked={mitWatchlist}
                  onChange={(e) => setMitWatchlist(e.target.checked)}
                  className="rounded border-white/20"
                />
                Watchlist einbeziehen
              </label>
              <button
                type="button"
                onClick={() => setNurHeute((v) => !v)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  nurHeute
                    ? 'border-teal-500/30 bg-teal-500/10 text-teal-300'
                    : 'border-white/[0.08] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                {nurHeute ? 'Nur heute' : '48 Stunden'}
              </button>
              <button
                type="button"
                onClick={() => void ladenTerminal()}
                disabled={laden}
                className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)] disabled:opacity-50"
              >
                {laden ? '…' : 'Aktualisieren'}
              </button>
            </div>
          </div>

          {fehler ? (
            <PaCard className="border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-100/90">
              {fehler}
            </PaCard>
          ) : null}

          <PaNewsTerminal
            paket={paket}
            laden={laden}
            nurHeute={nurHeute}
            kategorieFilter={kategorieFilter}
            onKategorieFilter={setKategorieFilter}
          />

          <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
            Quelle: Yahoo Finance + Google News (wie Fundamentaldaten). Der erste Abruf kann 20–40 Sekunden
            dauern — pro Position werden die Feeds einzeln geladen. Ausführliche Ansicht pro Titel unter{' '}
            <Link href="/portfolioanalyse/fundamentaldaten" className="text-teal-400 hover:underline">
              Fundamentaldaten → News
            </Link>
            .
          </p>
        </div>
      )}
    </PortfolioAnalyseShell>
  )
}

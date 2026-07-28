'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaNewsTerminal } from '@/components/portfolio-analyse/pa-news-terminal'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeNewsKiFazitAusCache,
  newsKiCacheKey,
  speichereNewsKiFazitImCache,
} from '@/lib/portfolio-analyse/news-terminal-ki-client'
import type {
  NewsTerminalDepotPosition,
  NewsTerminalKategorie,
  NewsTerminalKiPaket,
  NewsTerminalPaket,
  NewsTerminalUnternehmen,
} from '@/lib/portfolio-analyse/portfolio-news-terminal-types'
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

async function fetchKiFazite(opts: {
  zeilen: NewsTerminalPaket['zeilen']
  nurHeute: boolean
}): Promise<NewsTerminalKiPaket> {
  const res = await fetch('/api/portfolio-analyse/news-terminal/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zeilen: opts.zeilen, nurHeute: opts.nurHeute }),
  })
  const json = (await res.json()) as { ok?: boolean; message?: string } & Partial<NewsTerminalKiPaket>
  if (!res.ok || !json.ok) {
    throw new Error(json.message ?? 'KI-Zusammenfassung fehlgeschlagen')
  }
  return {
    fazite: json.fazite ?? [],
    zeitraum: json.zeitraum === 'heute' ? 'heute' : '48h',
    aktualisiertAm: json.aktualisiertAm ?? new Date().toISOString(),
    modell: json.modell ?? null,
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
  const [kiPaket, setKiPaket] = useState<NewsTerminalKiPaket | null>(null)
  const [kiLaden, setKiLaden] = useState(false)
  const [kiFehler, setKiFehler] = useState<string | null>(null)

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

  const tickerKey = useMemo(() => {
    const symbols = new Set<string>()
    for (const p of depotPositionen) {
      const s = p.symbolYahoo?.trim().toUpperCase()
      if (s) symbols.add(s)
    }
    for (const e of extraUnternehmen) {
      if (e.symbol) symbols.add(e.symbol)
    }
    return [...symbols].sort().join(',')
  }, [depotPositionen, extraUnternehmen])

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

  // Cache für KI-Fazite laden, wenn Zeitraum/Depot wechselt
  useEffect(() => {
    const key = newsKiCacheKey({ nurHeute, tickerKey })
    setKiPaket(ladeNewsKiFazitAusCache(key))
    setKiFehler(null)
  }, [nurHeute, tickerKey])

  const ladeKiFazite = useCallback(
    async (force = false) => {
      if (!paket?.zeilen.length) {
        setKiFehler('Zuerst News laden.')
        return
      }
      const key = newsKiCacheKey({ nurHeute, tickerKey })
      if (!force) {
        const cached = ladeNewsKiFazitAusCache(key)
        if (cached) {
          setKiPaket(cached)
          return
        }
      }
      setKiLaden(true)
      setKiFehler(null)
      try {
        const data = await fetchKiFazite({ zeilen: paket.zeilen, nurHeute })
        setKiPaket(data)
        speichereNewsKiFazitImCache(key, data)
      } catch (e) {
        setKiFehler(e instanceof Error ? e.message : 'KI-Zusammenfassung fehlgeschlagen')
      } finally {
        setKiLaden(false)
      }
    },
    [paket, nurHeute, tickerKey],
  )

  const heuteCount = paket?.zeilen.filter((z) => z.istHeute).length ?? 0

  return (
    <PortfolioAnalyseShell
      title="News-Terminal"
      description="Finanzrelevante Meldungen deiner Depot-Positionen — optional als deutsches KI-Tagesfazit pro Unternehmen."
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
              <button
                type="button"
                onClick={() => void ladeKiFazite(true)}
                disabled={kiLaden || laden || !paket?.zeilen.length}
                className="rounded-lg border border-teal-500/35 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-200 transition hover:bg-teal-500/20 disabled:opacity-50"
              >
                {kiLaden ? 'KI fasst zusammen …' : 'KI-Tagesfazit (DE)'}
              </button>
            </div>
          </div>

          {fehler ? (
            <PaCard className="border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-100/90">
              {fehler}
            </PaCard>
          ) : null}

          {kiFehler ? (
            <PaCard className="border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-100/90">
              {kiFehler}
            </PaCard>
          ) : null}

          {kiPaket && kiPaket.fazite.length > 0 ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-[var(--app-text)]">
                    KI-Tagesfazit · Deutsch
                  </h2>
                  <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                    {kiPaket.fazite.length} Unternehmen · {kiPaket.zeitraum === 'heute' ? 'heute' : '48 Stunden'} ·
                    kostenloses Gemini Flash
                    {kiPaket.aktualisiertAm
                      ? ` · ${new Date(kiPaket.aktualisiertAm).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {kiPaket.fazite.map((f) => (
                  <article
                    key={f.symbol}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--app-text)]">
                        <span className="mr-2 rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[11px] font-bold text-teal-300">
                          {f.symbol}
                        </span>
                        {f.name}
                      </h3>
                      <span className="shrink-0 text-[10px] text-[var(--app-text-muted)]">
                        {f.anzahlMeldungen} Meldung{f.anzahlMeldungen === 1 ? '' : 'en'}
                      </span>
                    </div>
                    {f.fehler ? (
                      <p className="mt-2 text-[13px] text-amber-200/90">{f.fehler}</p>
                    ) : (
                      <p className="mt-2 text-[13px] leading-relaxed text-[var(--app-text-muted)]">
                        {f.fazit}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <PaNewsTerminal
            paket={paket}
            laden={laden}
            nurHeute={nurHeute}
            kategorieFilter={kategorieFilter}
            onKategorieFilter={setKategorieFilter}
          />

          <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
            Quelle: Yahoo Finance + Google News. „KI-Tagesfazit“ verdichtet die Schlagzeilen pro Unternehmen auf
            Deutsch (Gemini Flash, Free-Tier). Der erste Abruf kann 20–40 Sekunden dauern. Details pro Titel unter{' '}
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

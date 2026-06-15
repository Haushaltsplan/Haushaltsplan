'use client'

import { useCallback, useEffect, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import type {
  CapitalAllocationPaket,
  CapitalAllocationBewertung,
} from '@/lib/portfolio-analyse/capital-allocation-server'

const BEWERTUNG_CLASS: Record<CapitalAllocationBewertung, string> = {
  gut: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  neutral: 'bg-zinc-700/40 text-zinc-300 ring-zinc-600/40',
  warnung: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
  keine_daten: 'bg-zinc-800/60 text-zinc-500 ring-zinc-700/40',
}

const SCORE_CLASS: Record<CapitalAllocationPaket['scoreLabel'], string> = {
  stark: 'text-emerald-300',
  solide: 'text-teal-300',
  beobachten: 'text-amber-200',
  schwach: 'text-red-300',
  keine_daten: 'text-zinc-500',
}

const SCORE_LABEL: Record<CapitalAllocationPaket['scoreLabel'], string> = {
  stark: 'Stark',
  solide: 'Solide',
  beobachten: 'Beobachten',
  schwach: 'Schwach',
  keine_daten: 'Keine Daten',
}

export function PaFundamentalCapitalAllocation({
  ticker,
  symbolYahoo,
  selectionKey,
}: {
  ticker: string
  symbolYahoo?: string | null
  selectionKey?: string
}) {
  const [daten, setDaten] = useState<CapitalAllocationPaket | null>(null)
  const [laden, setLaden] = useState(false)

  const lade = useCallback(async () => {
    if (!ticker?.trim()) return
    setLaden(true)
    try {
      const res = await fetch('/api/portfolio-analyse/capital-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, symbolYahoo }),
        signal: AbortSignal.timeout(60_000),
      })
      setDaten((await res.json()) as CapitalAllocationPaket)
    } catch {
      setDaten(null)
    } finally {
      setLaden(false)
    }
  }, [ticker, symbolYahoo])

  useEffect(() => {
    setDaten(null)
    if (ticker?.trim()) void lade()
  }, [selectionKey, ticker, lade])

  return (
    <PaCard className="space-y-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Capital-Allocation-Score</h3>
        <p className="text-xs text-zinc-500">
          Buybacks, Dividenden, CapEx, M&A vs. operativer Cashflow
          {daten?.periodeLabel ? ` · ${daten.periodeLabel}` : ''}
        </p>
      </div>

      {laden && !daten ? <p className="text-sm text-zinc-500">Lädt …</p> : null}

      {daten?.scorePct != null ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xl font-semibold tabular-nums text-white">{daten.scorePct}</span>
          <span className={`text-sm font-medium ${SCORE_CLASS[daten.scoreLabel]}`}>
            {SCORE_LABEL[daten.scoreLabel]}
          </span>
          {daten.fcfMioUsd != null ? (
            <span className="text-xs text-zinc-500">
              FCF LTM: {daten.fcfMioUsd.toLocaleString('de-DE')} Mio. USD
            </span>
          ) : null}
        </div>
      ) : null}

      {daten?.scoreHinweis ? <p className="text-sm text-zinc-400">{daten.scoreHinweis}</p> : null}

      {daten?.saeulen.length ? (
        <div className="space-y-2">
          {daten.saeulen.map((s) => (
            <article key={s.id} className="rounded-xl border border-zinc-800/90 bg-zinc-950/40 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{s.label}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${BEWERTUNG_CLASS[s.bewertung]}`}
                >
                  {s.bewertung === 'gut'
                    ? 'Gut'
                    : s.bewertung === 'warnung'
                      ? 'Warnung'
                      : s.bewertung === 'neutral'
                        ? 'Neutral'
                        : 'Keine Daten'}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                {s.betragMioUsd != null
                  ? `${s.betragMioUsd.toLocaleString('de-DE')} Mio. USD`
                  : '–'}
                {s.pctVonOcf != null ? ` · ${s.pctVonOcf.toLocaleString('de-DE')}% vom OCF` : ''}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{s.hinweis}</p>
            </article>
          ))}
        </div>
      ) : null}

      {daten?.fehler && !daten.ok ? (
        <p className="text-sm text-amber-200/90">{daten.fehler}</p>
      ) : null}
    </PaCard>
  )
}

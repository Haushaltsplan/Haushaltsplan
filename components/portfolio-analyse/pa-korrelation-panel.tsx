'use client'

import { useEffect, useMemo, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { PortfolioKorrelationPaket } from '@/lib/portfolio-analyse/portfolio-korrelation-types'

function corrFarbe(c: number): string {
  if (c >= 0.7) return 'bg-rose-500/70'
  if (c >= 0.4) return 'bg-amber-500/50'
  if (c >= 0) return 'bg-emerald-500/25'
  return 'bg-sky-500/30'
}

function formatCorrKurz(c: number): string {
  const gerundet = Math.round(c * 10) / 10
  return gerundet.toFixed(1)
}

export function PaKorrelationPanel({
  ticker,
  beta,
}: {
  ticker: string[]
  beta?: Record<string, number | null>
}) {
  const [daten, setDaten] = useState<PortfolioKorrelationPaket | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const tickerKey = useMemo(() => ticker.slice().sort().join(','), [ticker])

  useEffect(() => {
    if (ticker.length < 2) return
    let cancelled = false
    setLaden(true)
    setFehler(null)
    void fetch('/api/portfolio-analyse/korrelation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, beta }),
    })
      .then(async (res) => {
        const j = (await res.json()) as PortfolioKorrelationPaket & { fehler?: string }
        if (cancelled) return
        if (!res.ok || !j.ok) {
          setFehler(j.fehler ?? 'Korrelation nicht ladbar')
          setDaten(null)
          return
        }
        setDaten(j)
      })
      .catch((e) => {
        if (!cancelled) setFehler(e instanceof Error ? e.message : 'Netzwerkfehler')
      })
      .finally(() => {
        if (!cancelled) setLaden(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tickerKey genügt
  }, [tickerKey])

  if (ticker.length < 2) return null

  const n = daten?.ok ? daten.ticker.length : 0
  const kompakt = n >= 10
  const gridStyle =
    n > 0
      ? {
          gridTemplateColumns: `minmax(0, 2.75rem) repeat(${n}, minmax(0, 1fr))`,
        }
      : undefined

  return (
    <PaCard variant="glass" className="min-w-0 space-y-3 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
          Korrelationsmatrix · 1J
        </p>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          Parallel laufende Titel erzeugen Volatility Drag — Cluster mit corr ≥ 0,70 prüfen.
        </p>
      </div>

      {laden ? (
        <p className="text-sm text-[var(--app-text-muted)]">Korrelationen werden berechnet …</p>
      ) : null}
      {fehler ? <p className="text-sm text-amber-200/90">{fehler}</p> : null}

      {daten?.hinweis ? (
        <p className="text-[12px] text-[var(--app-text-muted)]">{daten.hinweis}</p>
      ) : null}

      {daten?.cluster && daten.cluster.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {daten.cluster.map((c) => (
            <span
              key={c.id}
              className="rounded-md bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200"
              title={`Ø-Korrelation ${c.avgCorr}`}
            >
              {c.ticker.join(' · ')} ({c.avgCorr.toFixed(2)})
            </span>
          ))}
        </div>
      ) : null}

      {daten?.ok && daten.ticker.length > 0 ? (
        <div className="w-full min-w-0">
          <div className="grid w-full min-w-0 gap-px" style={gridStyle}>
            <div aria-hidden />
            {daten.ticker.map((t) => (
              <div
                key={`h-${t}`}
                className="min-w-0 px-px text-center font-mono text-[8px] leading-tight text-[var(--app-text-muted)] sm:text-[9px]"
                title={daten.beta[t] != null ? `${t} · β ${daten.beta[t]!.toFixed(2)}` : t}
              >
                <span className="block truncate">{t}</span>
                {daten.beta[t] != null && !kompakt ? (
                  <span className="hidden truncate text-[8px] opacity-70 sm:block">
                    β {daten.beta[t]!.toFixed(1)}
                  </span>
                ) : null}
              </div>
            ))}
            {daten.ticker.map((row, i) => (
              <div key={`r-${row}`} className="contents">
                <div
                  className="flex min-w-0 items-center truncate pr-0.5 font-mono text-[8px] text-[var(--app-text-muted)] sm:text-[9px]"
                  title={row}
                >
                  {row}
                </div>
                {daten.matrix[i]!.map((c, j) => (
                  <div
                    key={`${i}-${j}`}
                    className={`flex min-h-[1.35rem] min-w-0 items-center justify-center rounded-sm px-px py-0.5 text-[8px] tabular-nums leading-none sm:min-h-[1.6rem] sm:text-[9px] ${corrFarbe(c)} ${
                      i === j ? 'opacity-40' : ''
                    }`}
                    title={`${daten.ticker[i]} ↔ ${daten.ticker[j]}: ${c.toFixed(2)}`}
                  >
                    {i === j ? '·' : formatCorrKurz(c)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {daten?.hohePaare && daten.hohePaare.length > 0 ? (
        <ul className="space-y-1 text-[11px] text-[var(--app-text-muted)]">
          {daten.hohePaare.slice(0, 8).map((p) => (
            <li key={`${p.a}-${p.b}`}>
              <span className="font-mono text-[var(--app-text)]">
                {p.a}–{p.b}
              </span>{' '}
              corr {p.corr.toFixed(2)}
            </li>
          ))}
        </ul>
      ) : null}
    </PaCard>
  )
}

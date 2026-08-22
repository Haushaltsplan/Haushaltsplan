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

  return (
    <PaCard variant="glass" className="space-y-3 p-4">
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
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="p-1 text-left text-[var(--app-text-muted)]" />
                {daten.ticker.map((t) => (
                  <th key={t} className="p-1 font-mono font-normal text-[var(--app-text-muted)]">
                    {t}
                    {daten.beta[t] != null ? (
                      <span className="block text-[9px] opacity-70">β {daten.beta[t]!.toFixed(2)}</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daten.ticker.map((row, i) => (
                <tr key={row}>
                  <td className="p-1 font-mono text-[var(--app-text-muted)]">{row}</td>
                  {daten.matrix[i]!.map((c, j) => (
                    <td key={`${i}-${j}`} className="p-0.5">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded ${corrFarbe(c)} ${
                          i === j ? 'opacity-40' : ''
                        }`}
                        title={`${daten.ticker[i]} ↔ ${daten.ticker[j]}: ${c.toFixed(2)}`}
                      >
                        {i === j ? '·' : c.toFixed(1)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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

'use client'

import { useCallback, useEffect, useState } from 'react'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { RebalancingTrade, ZielGewicht } from '@/lib/portfolio-analyse/zielallokation-types'

const DEFAULT_ZIELE: Array<{ schluessel: string; label: string; zielPct: number }> = [
  { schluessel: 'aktie', label: 'Aktien', zielPct: 90 },
  { schluessel: 'etf', label: 'ETFs', zielPct: 5 },
  { schluessel: 'anleihe', label: 'Anleihen', zielPct: 0 },
  { schluessel: 'geldmarkt', label: 'Geldmarkt', zielPct: 5 },
]

export function PaRebalancingPanel() {
  const [ziele, setZiele] = useState<ZielGewicht[]>([])
  const [trades, setTrades] = useState<RebalancingTrade[]>([])
  const [draft, setDraft] = useState(DEFAULT_ZIELE)
  const [laden, setLaden] = useState(false)
  const [speichern, setSpeichern] = useState(false)

  const ladenDaten = useCallback(async () => {
    setLaden(true)
    try {
      const res = await fetch('/api/portfolio-analyse/zielallokation')
      const j = (await res.json()) as { ziele?: ZielGewicht[]; trades?: RebalancingTrade[] }
      setZiele(j.ziele ?? [])
      setTrades(j.trades ?? [])
      if ((j.ziele ?? []).length > 0) {
        setDraft(
          j.ziele!
            .filter((z) => z.dimension === 'assetklasse')
            .map((z) => ({ schluessel: z.schluessel, label: z.label, zielPct: z.zielPct })),
        )
      }
    } catch {
      /* ignore */
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void ladenDaten()
  }, [ladenDaten])

  async function speichere() {
    setSpeichern(true)
    try {
      const res = await fetch('/api/portfolio-analyse/zielallokation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ziele: draft.map((d) => ({
            dimension: 'assetklasse',
            schluessel: d.schluessel,
            label: d.label,
            zielPct: d.zielPct,
          })),
        }),
      })
      const j = (await res.json()) as { ziele?: ZielGewicht[]; trades?: RebalancingTrade[] }
      setZiele(j.ziele ?? [])
      setTrades(j.trades ?? [])
    } finally {
      setSpeichern(false)
    }
  }

  return (
    <PaCard className="p-5">
      <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">
        Ziele / Rebalancing
      </h2>
      <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
        Soll-Gewichte nach Assetklasse · Trade-Liste (keine Orders)
      </p>

      {laden ? <p className="mt-3 text-sm text-[var(--app-text-muted)]">Lade…</p> : null}

      <div className="mt-3 space-y-2">
        {draft.map((d, i) => (
          <label key={d.schluessel} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--app-text)]">{d.label}</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              className="w-20 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1 text-right tabular-nums"
              value={d.zielPct}
              onChange={(e) => {
                const v = Number(e.target.value)
                setDraft((prev) => prev.map((x, idx) => (idx === i ? { ...x, zielPct: v } : x)))
              }}
            />
            <span className="text-[11px] text-[var(--app-text-muted)]">%</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 rounded-md bg-teal-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50"
        disabled={speichern}
        onClick={() => void speichere()}
      >
        {speichern ? 'Speichere…' : 'Ziele speichern'}
      </button>

      {trades.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-[var(--app-border)]/50 pt-3">
          {trades.map((t) => (
            <li key={t.schluessel} className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="font-medium text-[var(--app-text)]">{t.label}</span>
              <span className="tabular-nums text-[var(--app-text-muted)]">
                Ist {t.istPct}% → Soll {t.zielPct}%
              </span>
              {t.aktion !== 'ok' ? (
                <PaBadge variant={t.aktion === 'kaufen' ? 'positive' : 'negative'}>
                  {t.aktion === 'kaufen' ? 'Kaufen' : 'Trimmen'}{' '}
                  {Math.abs(t.diffEur).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
                </PaBadge>
              ) : (
                <PaBadge variant="neutral">OK</PaBadge>
              )}
            </li>
          ))}
        </ul>
      ) : ziele.length === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--app-text-muted)]">
          Noch keine Ziele gespeichert — Defaults oben anpassen und speichern.
        </p>
      ) : null}
    </PaCard>
  )
}

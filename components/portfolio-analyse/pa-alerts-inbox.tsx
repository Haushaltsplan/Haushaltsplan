'use client'

import { useCallback, useEffect, useState } from 'react'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { PortfolioAlert } from '@/lib/portfolio-analyse/portfolio-alerts-types'

function typLabel(typ: PortfolioAlert['typ']): string {
  switch (typ) {
    case 'radar_gruen':
      return 'Radar grün'
    case 'radar_kaufzone':
      return 'Kaufzone'
    case 'earnings_heute':
      return 'Earnings heute'
    case 'earnings_morgen':
      return 'Earnings morgen'
    case 'drawdown':
      return 'Drawdown'
    default:
      return typ
  }
}

export function PaAlertsInbox() {
  const [alerts, setAlerts] = useState<PortfolioAlert[]>([])
  const [ungelesen, setUngelesen] = useState(0)
  const [laden, setLaden] = useState(false)
  const [offen, setOffen] = useState(false)

  const ladenAlerts = useCallback(async (generate = false) => {
    setLaden(true)
    try {
      if (generate) {
        const res = await fetch('/api/portfolio-analyse/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate' }),
        })
        const j = (await res.json()) as { alerts?: PortfolioAlert[]; ungelesen?: number }
        setAlerts(j.alerts ?? [])
        setUngelesen(j.ungelesen ?? 0)
      } else {
        const res = await fetch('/api/portfolio-analyse/alerts')
        const j = (await res.json()) as { alerts?: PortfolioAlert[]; ungelesen?: number }
        setAlerts(j.alerts ?? [])
        setUngelesen(j.ungelesen ?? 0)
      }
    } catch {
      /* ignore */
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void ladenAlerts(false)
  }, [ladenAlerts])

  async function markRead(id: string) {
    await fetch('/api/portfolio-analyse/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read', id }),
    })
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, gelesenAm: new Date().toISOString() } : a)),
    )
    setUngelesen((n) => Math.max(0, n - 1))
  }

  async function markAll() {
    await fetch('/api/portfolio-analyse/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read_all' }),
    })
    setAlerts((prev) => prev.map((a) => ({ ...a, gelesenAm: a.gelesenAm ?? new Date().toISOString() })))
    setUngelesen(0)
  }

  return (
    <PaCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">Alerts</h2>
          {ungelesen > 0 ? <PaBadge variant="negative">{ungelesen} neu</PaBadge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--app-border)] px-2 py-1 text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            onClick={() => void ladenAlerts(true)}
            disabled={laden}
          >
            {laden ? 'Prüfe…' : 'Jetzt prüfen'}
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--app-border)] px-2 py-1 text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            onClick={() => setOffen((v) => !v)}
          >
            {offen ? 'Zuklappen' : 'Öffnen'}
          </button>
          {ungelesen > 0 ? (
            <button
              type="button"
              className="rounded-md border border-[var(--app-border)] px-2 py-1 text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
              onClick={() => void markAll()}
            >
              Alle gelesen
            </button>
          ) : null}
        </div>
      </div>

      {!offen ? (
        <p className="mt-2 text-[12px] text-[var(--app-text-muted)]">
          {ungelesen > 0
            ? `${ungelesen} ungelesene Hinweise (Radar, Earnings, Drawdown).`
            : 'Keine neuen Hinweise.'}
        </p>
      ) : (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {alerts.length === 0 ? (
            <li className="text-sm text-[var(--app-text-muted)]">Noch keine Alerts.</li>
          ) : (
            alerts.map((a) => (
              <li
                key={a.id}
                className={`rounded-lg border px-3 py-2 ${
                  a.gelesenAm
                    ? 'border-[var(--app-border)]/40 opacity-70'
                    : 'border-amber-500/30 bg-amber-500/5'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PaBadge variant="neutral">{typLabel(a.typ)}</PaBadge>
                  <span className="text-sm font-medium text-[var(--app-text)]">{a.titel}</span>
                  {!a.gelesenAm ? (
                    <button
                      type="button"
                      className="ml-auto text-[11px] text-teal-400 hover:text-teal-300"
                      onClick={() => void markRead(a.id)}
                    >
                      Gelesen
                    </button>
                  ) : null}
                </div>
                {a.nachricht ? (
                  <p className="mt-1 text-[12px] text-[var(--app-text-muted)]">{a.nachricht}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      )}
    </PaCard>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PaSectionTitle } from '@/components/portfolio-analyse/pa-ui'
import type {
  MomentumBarsSyncErgebnis,
  MomentumDatenStatus,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function StatKachel({ label, wert }: { label: string; wert: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--app-text)]">{wert}</p>
    </div>
  )
}

export function MomentumTraderClient() {
  const [status, setStatus] = useState<MomentumDatenStatus | null>(null)
  const [laden, setLaden] = useState(true)
  const [syncLaeuft, setSyncLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [letztesSync, setLetztesSync] = useState<MomentumBarsSyncErgebnis | null>(null)

  const ladeStatus = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const res = await fetch('/api/portfolio-analyse/momentum-trader/status')
      if (!res.ok) throw new Error('Status konnte nicht geladen werden.')
      setStatus((await res.json()) as MomentumDatenStatus)
    } catch (e) {
      setFehler(String(e))
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void ladeStatus()
  }, [ladeStatus])

  const starteBarsSync = useCallback(async (test: boolean) => {
    if (syncLaeuft) return
    setSyncLaeuft(true)
    setFehler(null)
    try {
      const res = await fetch('/api/portfolio-analyse/momentum-trader/bars/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test, tage: test ? 60 : 252 }),
      })
      const data = (await res.json()) as MomentumBarsSyncErgebnis
      if (!res.ok || !data.ok) {
        throw new Error(data.fehler ?? 'Sync fehlgeschlagen.')
      }
      setLetztesSync(data)
      await ladeStatus()
    } catch (e) {
      setFehler(String(e))
    } finally {
      setSyncLaeuft(false)
    }
  }, [syncLaeuft, ladeStatus])

  return (
    <PortfolioAnalyseShell title="Momentum Trader">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PaSectionTitle
            title="Momentum Trader"
            description="Kurzfristige, faktenbasierte Setups — getrennt vom Nachkauf-Radar. Aktuell: Datenfundament aufbauen."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => starteBarsSync(true)}
              disabled={syncLaeuft || laden}
              className="rounded-xl bg-[var(--app-surface-muted)] px-4 py-2 text-sm font-medium text-[var(--app-text)] ring-1 ring-[var(--app-border)] transition hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
            >
              {syncLaeuft ? 'Sync läuft …' : 'Test-Sync (10 Symbole)'}
            </button>
            <button
              type="button"
              onClick={() => starteBarsSync(false)}
              disabled={syncLaeuft || laden}
              className="rounded-xl bg-orange-500/15 px-4 py-2 text-sm font-medium text-orange-300 ring-1 ring-orange-500/25 transition hover:bg-orange-500/20 disabled:opacity-50"
            >
              Voll-Sync (S&P 500)
            </button>
          </div>
        </div>

        {fehler && (
          <PaCard className="border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{fehler}</PaCard>
        )}

        <PaCard className="p-5">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Datenfundament</h2>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">
            Schritt 1 von 4: OHLCV-Kerzen in Supabase. Danach Earnings-Kalender, Regime und Scan.
          </p>

          {laden && !status ? (
            <p className="mt-4 text-sm text-[var(--app-text-muted)]">Status wird geladen …</p>
          ) : status ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatKachel
                label="OHLCV-Kerzen"
                wert={status.barsAnzahl.toLocaleString('de-DE')}
              />
              <StatKachel
                label="Neuester Handelstag"
                wert={status.barsNeuesterTag ?? '—'}
              />
              <StatKachel
                label="Earnings-Kalender"
                wert={status.earningsKalenderAnzahl}
              />
              <StatKachel
                label="Earnings-Events"
                wert={status.earningsEventsAnzahl}
              />
              <StatKachel
                label="Markt-Regime"
                wert={status.regimeNeuesterTag ?? '—'}
              />
              <StatKachel label="Scan-Ergebnisse" wert={status.scanAnzahl} />
              <StatKachel label="Journal-Trades" wert={status.tradesAnzahl} />
              <StatKachel
                label="Supabase"
                wert={status.supabaseKonfiguriert ? 'verbunden' : 'fehlt'}
              />
            </div>
          ) : null}

          {letztesSync && (
            <p className="mt-4 text-xs text-[var(--app-text-muted)]">
              Letzter Sync: {letztesSync.kerzenGeschrieben.toLocaleString('de-DE')} Kerzen für{' '}
              {letztesSync.symbole} Symbole ({letztesSync.vonDatum} – {letztesSync.bisDatum})
              {letztesSync.fehler ? ' · ' + letztesSync.fehler : ''}
            </p>
          )}
        </PaCard>

        <PaCard className="p-5">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Geplante Module</h2>
          <ul className="mt-3 space-y-2 text-xs text-[var(--app-text-muted)]">
            <li className="flex gap-2">
              <span className="text-orange-400">●</span>
              <span>
                <strong className="text-[var(--app-text)]">Daten</strong> — OHLCV, Earnings-Kalender, Regime (in Arbeit)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--app-text-muted)]">○</span>
              <span>
                <strong className="text-[var(--app-text)]">Indikatoren</strong> — Gap, RVOL, ATR, Relative Stärke
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--app-text-muted)]">○</span>
              <span>
                <strong className="text-[var(--app-text)]">Regel-Engine</strong> — Playbook Earnings-Gap-Fade
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--app-text-muted)]">○</span>
              <span>
                <strong className="text-[var(--app-text)]">Journal</strong> — Trades loggen, Performance tracken
              </span>
            </li>
          </ul>
        </PaCard>
      </div>
    </PortfolioAnalyseShell>
  )
}

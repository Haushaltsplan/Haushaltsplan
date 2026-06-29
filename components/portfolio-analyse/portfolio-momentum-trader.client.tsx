'use client'

import { useCallback, useEffect, useState } from 'react'
import { PaAktienSucheInput, type AktienSucheAuswahl } from '@/components/portfolio-analyse/pa-aktien-suche-input'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PaSectionTitle } from '@/components/portfolio-analyse/pa-ui'
import { momentumApiFetch } from '@/lib/portfolio-analyse/momentum-trader/momentum-api-fetch'
import type {
  MomentumBarsSyncErgebnis,
  MomentumDatenStatus,
  MomentumEarningsSyncErgebnis,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { watchlistEintragAusMeta } from '@/lib/portfolio-analyse/watchlist-client'

function StatKachel({ label, wert }: { label: string; wert: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--app-text)]">{wert}</p>
    </div>
  )
}

export function MomentumTraderClient() {
  const { meta } = usePortfolioAnalyse()
  const [watchlist, setWatchlist] = useState<MomentumWatchlistEintrag[]>([])
  const [status, setStatus] = useState<MomentumDatenStatus | null>(null)
  const [laden, setLaden] = useState(true)
  const [barsSyncLaeuft, setBarsSyncLaeuft] = useState(false)
  const [earningsSyncLaeuft, setEarningsSyncLaeuft] = useState(false)
  const [hinzufuegenLaden, setHinzufuegenLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [letztesBarsSync, setLetztesBarsSync] = useState<MomentumBarsSyncErgebnis | null>(null)
  const [letztesEarningsSync, setLetztesEarningsSync] = useState<MomentumEarningsSyncErgebnis | null>(null)

  const ladeAlles = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const [wlRes, stRes] = await Promise.all([
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/watchlist'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/status'),
      ])
      if (!wlRes.ok) {
        const d = (await wlRes.json().catch(() => ({}))) as { fehler?: string }
        throw new Error(d.fehler ?? 'Watchlist konnte nicht geladen werden.')
      }
      if (!stRes.ok) {
        const d = (await stRes.json().catch(() => ({}))) as { fehler?: string }
        throw new Error(d.fehler ?? 'Status konnte nicht geladen werden.')
      }
      const wl = (await wlRes.json()) as { eintraege: MomentumWatchlistEintrag[] }
      setWatchlist(wl.eintraege ?? [])
      setStatus((await stRes.json()) as MomentumDatenStatus)
    } catch (e) {
      setFehler(String(e))
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void ladeAlles()
  }, [ladeAlles])

  const hinzufuegen = useCallback(
    async (auswahl: AktienSucheAuswahl) => {
      const isin = auswahl.isin?.trim().toUpperCase() || auswahl.meta.isin?.trim().toUpperCase()
      if (!isin) {
        setFehler('Keine ISIN — Momentum-Watchlist braucht eine ISIN für DivvyDiary.')
        return
      }
      setHinzufuegenLaden(true)
      setFehler(null)
      try {
        const e = watchlistEintragAusMeta(auswahl.meta, isin)
        const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isin: e.isin,
            name: e.name,
            symbolYahoo: e.symbolYahoo,
            symbolCandidates: e.symbolCandidates,
          }),
        })
        const data = (await res.json()) as { eintraege?: MomentumWatchlistEintrag[]; fehler?: string }
        if (!res.ok) throw new Error(data.fehler ?? 'Hinzufügen fehlgeschlagen.')
        setWatchlist(data.eintraege ?? [])
        await ladeAlles()
      } catch (e) {
        setFehler(String(e))
      } finally {
        setHinzufuegenLaden(false)
      }
    },
    [ladeAlles],
  )

  const entfernen = useCallback(
    async (isin: string) => {
      setFehler(null)
      try {
        const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/watchlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isin }),
        })
        const data = (await res.json()) as { eintraege?: MomentumWatchlistEintrag[]; fehler?: string }
        if (!res.ok) throw new Error(data.fehler ?? 'Entfernen fehlgeschlagen.')
        setWatchlist(data.eintraege ?? [])
        await ladeAlles()
      } catch (e) {
        setFehler(String(e))
      }
    },
    [ladeAlles],
  )

  const starteBarsSync = useCallback(async () => {
    if (barsSyncLaeuft || watchlist.length === 0) return
    setBarsSyncLaeuft(true)
    setFehler(null)
    try {
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/bars/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tage: 252 }),
      })
      const data = (await res.json()) as MomentumBarsSyncErgebnis
      if (!res.ok || !data.ok) throw new Error(data.fehler ?? 'Bars-Sync fehlgeschlagen.')
      setLetztesBarsSync(data)
      await ladeAlles()
    } catch (e) {
      setFehler(String(e))
    } finally {
      setBarsSyncLaeuft(false)
    }
  }, [barsSyncLaeuft, watchlist.length, ladeAlles])

  const starteEarningsSync = useCallback(async () => {
    if (earningsSyncLaeuft || watchlist.length === 0) return
    setEarningsSyncLaeuft(true)
    setFehler(null)
    try {
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/earnings/sync', {
        method: 'POST',
      })
      const data = (await res.json()) as MomentumEarningsSyncErgebnis
      setLetztesEarningsSync(data)
      if (!res.ok && res.status !== 207) {
        throw new Error(data.fehler?.join(' · ') ?? 'Earnings-Sync fehlgeschlagen.')
      }
      if (data.fehler?.length) {
        setFehler(data.fehler.join(' · '))
      }
      await ladeAlles()
    } catch (e) {
      setFehler(String(e))
    } finally {
      setEarningsSyncLaeuft(false)
    }
  }, [earningsSyncLaeuft, watchlist.length, ladeAlles])

  const max = status?.watchlistMax ?? 32
  const voll = watchlist.length >= max

  return (
    <PortfolioAnalyseShell title="Momentum Trader">
      <div className="space-y-6">
        <PaSectionTitle
          title="Momentum Trader"
          description="Kurzfristige Setups — nur Titel auf deiner Watchlist werden geladen. DivvyDiary-Scraper läuft nacheinander, nicht marktweit."
        />

        {fehler && (
          <PaCard className="border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{fehler}</PaCard>
        )}

        <PaCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text)]">Watchlist</h2>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                {watchlist.length} / {max} Titel · Suche nach Name, Ticker oder ISIN
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void starteBarsSync()}
                disabled={barsSyncLaeuft || laden || watchlist.length === 0}
                className="rounded-xl bg-orange-500/15 px-4 py-2 text-sm font-medium text-orange-300 ring-1 ring-orange-500/25 transition hover:bg-orange-500/20 disabled:opacity-50"
              >
                {barsSyncLaeuft ? 'Kurse …' : 'Kurse syncen'}
              </button>
              <button
                type="button"
                onClick={() => void starteEarningsSync()}
                disabled={earningsSyncLaeuft || laden || watchlist.length === 0}
                className="rounded-xl bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-300 ring-1 ring-violet-500/25 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                {earningsSyncLaeuft ? 'Earnings …' : 'Earnings syncen'}
              </button>
            </div>
          </div>

          {!voll && (
            <div className="mt-4 max-w-xl">
              <PaAktienSucheInput
                onAuswahl={hinzufuegen}
                laden={hinzufuegenLaden}
                fehler={fehler}
                onFehler={setFehler}
              />
            </div>
          )}

          {voll && (
            <p className="mt-4 text-xs text-amber-400/90">Watchlist voll — entferne einen Titel, um Platz zu schaffen.</p>
          )}

          {laden && watchlist.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--app-text-muted)]">Watchlist wird geladen …</p>
          ) : watchlist.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--app-text-muted)]">
              Noch keine Titel — füge z. B. eine Aktie mit anstehenden Quartalszahlen hinzu.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)]">
              {watchlist.map((e) => (
                <li
                  key={e.isin}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--app-text)]">{e.name}</p>
                      <p className="truncate text-xs text-[var(--app-text-muted)]">
                        {e.symbolYahoo ?? '—'} · {e.isin}
                        {e.earningsSyncAm
                          ? ' · Earnings: ' + new Date(e.earningsSyncAm).toLocaleDateString('de-DE')
                          : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void entfernen(e.isin)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)] transition hover:bg-red-500/10 hover:text-red-300"
                  >
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PaCard>

        <PaCard className="p-5">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Datenfundament</h2>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">
            Zahlen nur für deine Watchlist (+ SPY/VIX-Indizes für spätere Regime-Gates).
          </p>

          {status && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatKachel label="Watchlist" wert={`${status.watchlistAnzahl} / ${status.watchlistMax}`} />
              <StatKachel label="OHLCV-Kerzen" wert={status.barsAnzahl.toLocaleString('de-DE')} />
              <StatKachel label="Neuester Handelstag" wert={status.barsNeuesterTag ?? '—'} />
              <StatKachel label="Earnings-Termine" wert={status.earningsKalenderAnzahl} />
            </div>
          )}

          {letztesBarsSync && (
            <p className="mt-4 text-xs text-[var(--app-text-muted)]">
              Kurse: {letztesBarsSync.kerzenGeschrieben.toLocaleString('de-DE')} Kerzen, {letztesBarsSync.symbole}{' '}
              Symbole ({letztesBarsSync.vonDatum} – {letztesBarsSync.bisDatum})
            </p>
          )}
          {letztesEarningsSync && (
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              Earnings: {letztesEarningsSync.termineGeschrieben} Termine für {letztesEarningsSync.watchlistGroesse}{' '}
              Watchlist-Titel
            </p>
          )}
        </PaCard>
      </div>
    </PortfolioAnalyseShell>
  )
}

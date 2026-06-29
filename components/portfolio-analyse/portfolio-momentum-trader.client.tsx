'use client'

import { useCallback, useEffect, useState } from 'react'
import { PaAktienSucheInput, type AktienSucheAuswahl } from '@/components/portfolio-analyse/pa-aktien-suche-input'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PaSectionTitle } from '@/components/portfolio-analyse/pa-ui'
import { momentumApiFetch } from '@/lib/portfolio-analyse/momentum-trader/momentum-api-fetch'
import type {
  MomentumAmpel,
  MomentumBarsSyncErgebnis,
  MomentumDatenStatus,
  MomentumEarningsSyncErgebnis,
  MomentumErinnerung,
  MomentumFullSyncErgebnis,
  MomentumPerformance,
  MomentumPlaybook,
  MomentumRichtung,
  MomentumScanEintrag,
  MomentumScanPaket,
  MomentumTrade,
  MomentumWatchlistEintragAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { istGueltigeIsin, watchlistEintragAusMeta } from '@/lib/portfolio-analyse/watchlist-client'

function StatKachel({ label, wert }: { label: string; wert: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--app-text)]">{wert}</p>
    </div>
  )
}

function erinnerungFarbe(s: MomentumErinnerung['schwere']): string {
  if (s === 'aktion') return 'border-violet-500/30 bg-violet-500/10 text-violet-200'
  if (s === 'warnung') return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  return 'border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 text-[var(--app-text-muted)]'
}

function ErinnerungenLeiste({ items }: { items: MomentumErinnerung[] }) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-2">
      {items.map((e, i) => (
        <li
          key={e.typ + (e.symbol ?? '') + i}
          className={'rounded-xl border px-4 py-2.5 text-sm ' + erinnerungFarbe(e.schwere)}
        >
          {e.text}
        </li>
      ))}
    </ul>
  )
}

function PerformancePanel({ p }: { p: MomentumPerformance }) {
  const pf =
    p.profitFactor != null
      ? String(p.profitFactor)
      : p.tradesGeschlossen > 0 && p.pnlGesamtEur > 0
        ? '∞'
        : '—'
  const playbooks: MomentumPlaybook[] = [
    'earnings_gap_fade',
    'earnings_momentum',
    'ipo_fade',
    'earnings_vorlauf',
  ]

  return (
    <PaCard className="p-5">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">Performance</h2>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        {p.tradesGeschlossen} geschlossen · {p.tradesOffen} offen
        {p.ruleCompliancePct != null ? ' · ' + p.ruleCompliancePct + '% regelkonform' : ''}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatKachel
          label="PnL gesamt"
          wert={(p.pnlGesamtEur >= 0 ? '+' : '') + p.pnlGesamtEur.toFixed(2) + ' €'}
        />
        <StatKachel label="Win-Rate" wert={p.winRatePct != null ? p.winRatePct + '%' : '—'} />
        <StatKachel label="Profit Factor" wert={pf} />
        <StatKachel
          label="Ø PnL / Trade"
          wert={p.pnlDurchschnittEur != null ? p.pnlDurchschnittEur.toFixed(2) + ' €' : '—'}
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead>
            <tr className="text-[var(--app-text-muted)]">
              <th className="pb-2 font-medium">Playbook</th>
              <th className="pb-2 font-medium">Trades</th>
              <th className="pb-2 font-medium">Win-Rate</th>
              <th className="pb-2 font-medium">PnL</th>
            </tr>
          </thead>
          <tbody className="text-[var(--app-text)]">
            {playbooks.map((pb) => {
              const s = p.nachPlaybook[pb]
              if (s.trades === 0) return null
              return (
                <tr key={pb} className="border-t border-[var(--app-border)]">
                  <td className="py-2">{momentumPlaybookLabel(pb)}</td>
                  <td className="py-2 tabular-nums">{s.geschlossen}/{s.trades}</td>
                  <td className="py-2 tabular-nums">{s.winRatePct != null ? s.winRatePct + '%' : '—'}</td>
                  <td className="py-2 tabular-nums">{s.pnlEur.toFixed(2)} €</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </PaCard>
  )
}

function ampelRing(ampel: MomentumAmpel): string {
  if (ampel === 'gruen') return 'ring-emerald-500/40 bg-emerald-500/10'
  if (ampel === 'gelb') return 'ring-amber-500/40 bg-amber-500/10'
  if (ampel === 'rot') return 'ring-red-500/40 bg-red-500/10'
  return 'ring-zinc-500/30 bg-zinc-500/10'
}

function playbookTitel(playbook: MomentumPlaybook): string {
  return momentumPlaybookLabel(playbook)
}

const TRADE_PLAYBOOKS: MomentumPlaybook[] = ['earnings_gap_fade', 'earnings_momentum', 'ipo_fade']

function filterScanErgebnisse(
  ergebnisse: MomentumScanEintrag[],
  scanFilter: 'trade' | 'momentum' | 'ipo' | 'vorlauf' | 'alle',
): MomentumScanEintrag[] {
  return ergebnisse
    .filter((e) => {
      if (scanFilter === 'alle') return true
      if (scanFilter === 'vorlauf') return e.playbook === 'earnings_vorlauf'
      if (scanFilter === 'momentum') return e.playbook === 'earnings_momentum'
      if (scanFilter === 'ipo') return e.playbook === 'ipo_fade'
      return e.playbook === 'earnings_gap_fade' && e.ampel !== 'grau' && e.ampel !== 'rot'
    })
    .sort((a, b) => b.score - a.score)
}

function WatchlistZeile({
  e,
  meta,
  onEntfernen,
  onMetaSpeichern,
}: {
  e: MomentumWatchlistEintragAngereichert
  meta: ReturnType<typeof usePortfolioAnalyse>['meta']
  onEntfernen: (isin: string) => void
  onMetaSpeichern: (isin: string, patch: { ipoDatum?: string | null; notiz?: string | null }) => Promise<void>
}) {
  const [aufgeklappt, setAufgeklappt] = useState(false)
  const [ipoInput, setIpoInput] = useState(e.ipoDatum ?? '')
  const [notizInput, setNotizInput] = useState(e.notiz ?? '')
  const [speichern, setSpeichern] = useState(false)

  const earningsHeute = e.naechstesEarnings?.tageBis === 0
  const earningsBald = e.naechstesEarnings?.tageBis != null && e.naechstesEarnings.tageBis <= 3

  const metaSpeichern = async () => {
    setSpeichern(true)
    try {
      await onMetaSpeichern(e.isin, {
        ipoDatum: ipoInput.trim() || null,
        notiz: notizInput.trim() || null,
      })
    } finally {
      setSpeichern(false)
    }
  }

  return (
    <li
      className={
        (aufgeklappt ? 'block ' : 'flex items-center justify-between gap-3 ') +
        'px-3 py-2.5 sm:px-4 ' +
        (earningsHeute ? 'bg-violet-500/10' : earningsBald ? 'bg-amber-500/5' : '')
      }
    >
      <div className={aufgeklappt ? 'flex items-start justify-between gap-3' : 'flex min-w-0 flex-1 items-center gap-3'}>
        <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--app-text)]">{e.name}</p>
          <p className="truncate text-xs text-[var(--app-text-muted)]">
            {e.symbolYahoo ?? '—'} · {e.isin}
          </p>
          {e.naechstesEarnings ? (
            <p className="mt-0.5 text-xs text-violet-300/90">
              Earnings {new Date(e.naechstesEarnings.datum + 'T12:00:00').toLocaleDateString('de-DE')}
              {e.naechstesEarnings.tageBis != null && e.naechstesEarnings.tageBis <= 14
                ? ' · in ' + e.naechstesEarnings.tageBis + ' Tagen'
                : ''}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">Kein Termin — Sync ausführen</p>
          )}
          {e.medianGapPct != null && (
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Median-Gap {e.medianGapPct.toFixed(1)}% ({e.earningsEventsAnzahl} Events)
            </p>
          )}
          {e.notiz && !aufgeklappt && (
            <p className="mt-0.5 truncate text-[11px] italic text-[var(--app-text-muted)]">{e.notiz}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setAufgeklappt((v) => !v)}
            className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)] hover:bg-[var(--app-surface-hover)]"
          >
            {aufgeklappt ? '−' : '+'}
          </button>
          <button
            type="button"
            onClick={() => onEntfernen(e.isin)}
            className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)] hover:bg-red-500/10 hover:text-red-300"
          >
            Entfernen
          </button>
        </div>
      </div>
      {aufgeklappt && (
        <div className="mt-3 space-y-3 border-t border-[var(--app-border)] pt-3">
          {e.letzteGapEvents.length > 0 ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">Gap-Historie</p>
              <ul className="mt-1 space-y-1 text-[11px] tabular-nums text-[var(--app-text-muted)]">
                {e.letzteGapEvents.map((g) => (
                  <li key={g.datum}>
                    {new Date(g.datum + 'T12:00:00').toLocaleDateString('de-DE')}: Gap{' '}
                    {g.gapPct != null ? g.gapPct + '%' : '—'}
                    {g.surpriseEpsPct != null ? ' · Surprise ' + g.surpriseEpsPct + '%' : ''}
                    {g.rvol != null ? ' · RVOL ' + g.rvol + '×' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-[var(--app-text-muted)]">Keine Gap-Historie — Backfill via „Alles aktualisieren“.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="text-[11px] text-[var(--app-text-muted)]">
              IPO-Datum
              <input
                type="date"
                value={ipoInput}
                onChange={(ev) => setIpoInput(ev.target.value)}
                className="mt-1 block rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs"
              />
            </label>
          </div>
          <textarea
            value={notizInput}
            onChange={(ev) => setNotizInput(ev.target.value)}
            placeholder="Notiz (Setup, Erwartung …)"
            rows={2}
            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={speichern}
            onClick={() => void metaSpeichern()}
            className="rounded-lg bg-[var(--app-surface-muted)] px-3 py-1.5 text-xs ring-1 ring-[var(--app-border)] disabled:opacity-50"
          >
            {speichern ? 'Speichern …' : 'Meta speichern'}
          </button>
        </div>
      )}
    </li>
  )
}

function ScanKarte({
  e,
  onTrade,
  tradeLaden,
}: {
  e: MomentumScanEintrag
  onTrade: (e: MomentumScanEintrag) => void
  tradeLaden: boolean
}) {
  const gap = e.indikatoren.gapPct
  const rvol = e.indikatoren.rvol
  const richtung = e.indikatoren.richtung
  const median = e.indikatoren.medianGapPct
  const stop = e.indikatoren.stopPrice
  const target = e.indikatoren.targetPrice
  const surprise = e.indikatoren.surpriseEpsPct
  const guidance = e.indikatoren.guidanceLabel ?? e.indikatoren.guidanceFlag
  const kiMemo = e.indikatoren.kiBegruendung
  const rs = e.indikatoren.rsVsSpy20d
  const kannTrade =
    TRADE_PLAYBOOKS.includes(e.playbook) && e.ampel !== 'grau' && e.ampel !== 'rot' && richtung != null

  return (
    <li className={`rounded-xl p-4 ring-1 ${ampelRing(e.ampel)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text)]">
            {e.symbol} · {playbookTitel(e.playbook)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
            Score {e.score}/100
            {richtung === 'short' ? ' · Short' : richtung === 'long' ? ' · Long' : ''}
          </p>
        </div>
        <span className="rounded-lg px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)]">
          {e.ampel}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs tabular-nums text-[var(--app-text-muted)]">
        {gap != null && <span>Gap {String(gap)}%</span>}
        {median != null && <span>Median {String(median)}%</span>}
        {rvol != null && <span>RVOL {String(rvol)}×</span>}
        {surprise != null && <span>Surprise {String(surprise)}%</span>}
        {rs != null && <span>RS {String(rs)}%</span>}
        {guidance != null && <span>{String(guidance)}</span>}
        {stop != null && <span>Stop {String(stop)}</span>}
        {target != null && <span>Ziel {String(target)}</span>}
      </div>
      {e.gatesPassed.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-emerald-400/90">
          {e.gatesPassed.map((g) => (
            <li key={g}>✓ {g}</li>
          ))}
        </ul>
      )}
      {e.gatesFailed.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[11px] text-red-300/80">
          {e.gatesFailed.map((g) => (
            <li key={g}>✗ {g}</li>
          ))}
        </ul>
      )}
      {kiMemo != null && typeof kiMemo === 'string' && (
        <p className="mt-2 text-xs italic text-[var(--app-text-muted)]">{kiMemo}</p>
      )}
      {kannTrade && (
        <button
          type="button"
          disabled={tradeLaden}
          onClick={() => onTrade(e)}
          className="mt-3 rounded-lg bg-teal-500/15 px-3 py-1.5 text-xs font-medium text-teal-300 ring-1 ring-teal-500/30 hover:bg-teal-500/25 disabled:opacity-50"
        >
          {tradeLaden ? 'Speichern …' : 'Im Journal erfassen (10 €)'}
        </button>
      )}
    </li>
  )
}

function TradeZeile({
  t,
  onSchliessen,
  onLoeschen,
  laden,
}: {
  t: MomentumTrade
  onSchliessen: (id: string, exitPrice: number) => void
  onLoeschen: (id: string) => void
  laden: boolean
}) {
  const [exitInput, setExitInput] = useState('')
  const offen = t.exitPrice == null

  return (
    <li className="rounded-xl border border-[var(--app-border)] px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--app-text)]">
            {t.symbol} · {t.direction.toUpperCase()} · {playbookTitel(t.playbook)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
            Entry {t.entryPrice} ({t.entryDate})
            {t.stopPrice != null ? ' · Stop ' + t.stopPrice : ''}
            {t.targetPrice != null ? ' · Ziel ' + t.targetPrice : ''}
            {' · Risiko ' + t.riskEur + ' €'}
          </p>
          {!offen && (
            <p className={`mt-1 text-xs font-medium ${(t.pnlEur ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-300'}`}>
              Exit {t.exitPrice} · PnL {t.pnlEur != null ? t.pnlEur.toFixed(2) + ' €' : '—'}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={laden}
          onClick={() => onLoeschen(t.id)}
          className="text-xs text-[var(--app-text-muted)] hover:text-red-300"
        >
          Löschen
        </button>
      </div>
      {offen && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Exit-Preis"
            value={exitInput}
            onChange={(ev) => setExitInput(ev.target.value)}
            className="w-28 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={laden || !exitInput}
            onClick={() => onSchliessen(t.id, Number.parseFloat(exitInput.replace(',', '.')))}
            className="rounded-lg bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--app-border)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
          >
            Schließen
          </button>
        </div>
      )}
    </li>
  )
}

export function MomentumTraderClient() {
  const { meta } = usePortfolioAnalyse()
  const [watchlist, setWatchlist] = useState<MomentumWatchlistEintragAngereichert[]>([])
  const [status, setStatus] = useState<MomentumDatenStatus | null>(null)
  const [scan, setScan] = useState<MomentumScanPaket | null>(null)
  const [trades, setTrades] = useState<MomentumTrade[]>([])
  const [performance, setPerformance] = useState<MomentumPerformance | null>(null)
  const [erinnerungen, setErinnerungen] = useState<MomentumErinnerung[]>([])
  const [scanFilter, setScanFilter] = useState<'trade' | 'momentum' | 'ipo' | 'vorlauf' | 'alle'>('trade')
  const [exportHinweis, setExportHinweis] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)
  const [fullSyncLaeuft, setFullSyncLaeuft] = useState(false)
  const [barsSyncLaeuft, setBarsSyncLaeuft] = useState(false)
  const [earningsSyncLaeuft, setEarningsSyncLaeuft] = useState(false)
  const [scanLaeuft, setScanLaeuft] = useState(false)
  const [tradeLaden, setTradeLaden] = useState(false)
  const [hinzufuegenLaden, setHinzufuegenLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [syncLog, setSyncLog] = useState<string[]>([])
  const [letztesBarsSync, setLetztesBarsSync] = useState<MomentumBarsSyncErgebnis | null>(null)
  const [letztesEarningsSync, setLetztesEarningsSync] = useState<MomentumEarningsSyncErgebnis | null>(null)

  const ladeAlles = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const [wlRes, stRes, scanRes, trRes] = await Promise.all([
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/watchlist'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/status'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/scan'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/trades'),
      ])
      if (!wlRes.ok) throw new Error(((await wlRes.json()) as { fehler?: string }).fehler ?? 'Watchlist-Fehler')
      if (!stRes.ok) throw new Error(((await stRes.json()) as { fehler?: string }).fehler ?? 'Status-Fehler')
      const wl = (await wlRes.json()) as { eintraege: MomentumWatchlistEintragAngereichert[] }
      setWatchlist(wl.eintraege ?? [])
      const st = (await stRes.json()) as MomentumDatenStatus & { erinnerungen?: MomentumErinnerung[] }
      setStatus(st)
      setErinnerungen(st.erinnerungen ?? [])
      if (scanRes.ok) setScan((await scanRes.json()) as MomentumScanPaket)
      const trData = (await trRes.json()) as { trades: MomentumTrade[]; performance?: MomentumPerformance }
      setTrades(trData.trades ?? [])
      setPerformance(trData.performance ?? null)
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
      const kandidat =
        auswahl.isin?.trim().toUpperCase() || auswahl.meta.isin?.trim().toUpperCase() || ''
      const isin = kandidat && istGueltigeIsin(kandidat) ? kandidat : null
      if (!isin) {
        setFehler(
          'Keine gültige ISIN — Ticker aus der Liste wählen, ISIN direkt eingeben (z. B. US0378331005) oder FINNHUB_API_KEY setzen.',
        )
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
        const data = (await res.json()) as { eintraege?: MomentumWatchlistEintragAngereichert[]; fehler?: string }
        if (!res.ok) throw new Error(data.fehler ?? 'Hinzufügen fehlgeschlagen.')
        setWatchlist(data.eintraege ?? [])
        await ladeAlles()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setFehler(msg.replace(/^Error:\s*/i, ''))
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
        const data = (await res.json()) as { eintraege?: MomentumWatchlistEintragAngereichert[]; fehler?: string }
        if (!res.ok) throw new Error(data.fehler ?? 'Entfernen fehlgeschlagen.')
        setWatchlist(data.eintraege ?? [])
        await ladeAlles()
      } catch (e) {
        setFehler(String(e))
      }
    },
    [ladeAlles],
  )

  const starteFullSync = useCallback(async () => {
    if (fullSyncLaeuft || watchlist.length === 0) return
    setFullSyncLaeuft(true)
    setFehler(null)
    setSyncLog([])
    try {
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/sync/all', { method: 'POST' })
      const data = (await res.json()) as MomentumFullSyncErgebnis
      setSyncLog(data.schritte ?? [])
      if (data.scan) setScan(data.scan)
      if (data.fehler?.length) setFehler(data.fehler.join(' · '))
      if (!res.ok && res.status !== 207) throw new Error(data.fehler?.join(' · ') ?? 'Sync fehlgeschlagen.')
      await ladeAlles()
    } catch (e) {
      setFehler(String(e))
    } finally {
      setFullSyncLaeuft(false)
    }
  }, [fullSyncLaeuft, watchlist.length, ladeAlles])

  const starteBarsSync = useCallback(async () => {
    if (barsSyncLaeuft || watchlist.length === 0) return
    setBarsSyncLaeuft(true)
    setFehler(null)
    try {
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/bars/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tage: 252, backfillEvents: true }),
      })
      const data = (await res.json()) as MomentumBarsSyncErgebnis
      if (!res.ok || !data.ok) throw new Error(data.fehler ?? 'Kurs-Sync fehlgeschlagen.')
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
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/earnings/sync', { method: 'POST' })
      const data = (await res.json()) as MomentumEarningsSyncErgebnis
      setLetztesEarningsSync(data)
      if (!res.ok && res.status !== 207) throw new Error(data.fehler?.join(' · ') ?? 'Earnings-Sync fehlgeschlagen.')
      if (data.fehler?.length) setFehler(data.fehler.join(' · '))
      await ladeAlles()
    } catch (e) {
      setFehler(String(e))
    } finally {
      setEarningsSyncLaeuft(false)
    }
  }, [earningsSyncLaeuft, watchlist.length, ladeAlles])

  const starteScan = useCallback(async () => {
    if (scanLaeuft || watchlist.length === 0) return
    setScanLaeuft(true)
    setFehler(null)
    try {
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitKi: true }),
      })
      const data = (await res.json()) as MomentumScanPaket & { fehler?: string }
      if (!res.ok) throw new Error(data.fehler ?? 'Scan fehlgeschlagen.')
      setScan(data)
      await ladeAlles()
    } catch (e) {
      setFehler(String(e))
    } finally {
      setScanLaeuft(false)
    }
  }, [scanLaeuft, watchlist.length, ladeAlles])

  const tradeAusScan = useCallback(
    async (e: MomentumScanEintrag) => {
      setTradeLaden(true)
      setFehler(null)
      try {
        const direction = e.indikatoren.richtung as MomentumRichtung
        const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: e.symbol,
            playbook: e.playbook,
            direction,
            entryPrice: e.indikatoren.entryPrice ?? e.indikatoren.open,
            stopPrice: e.indikatoren.stopPrice,
            targetPrice: e.indikatoren.targetPrice,
            riskEur: 10,
            notizen: 'Aus Scan ' + e.scanDate + ', Score ' + e.score,
          }),
        })
        const data = (await res.json()) as { trade?: MomentumTrade; fehler?: string }
        if (!res.ok) throw new Error(data.fehler ?? 'Trade konnte nicht gespeichert werden.')
        await ladeAlles()
      } catch (err) {
        setFehler(String(err))
      } finally {
        setTradeLaden(false)
      }
    },
    [ladeAlles],
  )

  const schliesseTrade = useCallback(
    async (id: string, exitPrice: number) => {
      if (!Number.isFinite(exitPrice)) return
      setTradeLaden(true)
      try {
        const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/trades', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, exitPrice }),
        })
        const data = (await res.json()) as { fehler?: string }
        if (!res.ok) throw new Error(data.fehler ?? 'Schließen fehlgeschlagen.')
        await ladeAlles()
      } catch (e) {
        setFehler(String(e))
      } finally {
        setTradeLaden(false)
      }
    },
    [ladeAlles],
  )

  const speichereWatchlistMeta = useCallback(
    async (isin: string, patch: { ipoDatum?: string | null; notiz?: string | null }) => {
      setFehler(null)
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isin, ...patch }),
      })
      const data = (await res.json()) as { eintraege?: MomentumWatchlistEintragAngereichert[]; fehler?: string }
      if (!res.ok) throw new Error(data.fehler ?? 'Speichern fehlgeschlagen.')
      setWatchlist(data.eintraege ?? [])
    },
    [],
  )

  const exportiereScan = useCallback(() => {
    if (!scan || scan.ergebnisse.length === 0) return
    const lines = [
      '# Momentum Scan ' + scan.scanDate,
      '',
      ...filterScanErgebnisse(scan.ergebnisse, scanFilter).map((e) => {
        const r = e.indikatoren.richtung
        return (
          '- **' +
          e.symbol +
          '** · ' +
          playbookTitel(e.playbook) +
          ' · Score ' +
          e.score +
          ' · ' +
          e.ampel +
          (r ? ' · ' + String(r) : '') +
          (e.indikatoren.gapPct != null ? ' · Gap ' + e.indikatoren.gapPct + '%' : '')
        )
      }),
    ]
    void navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setExportHinweis('Scan in Zwischenablage kopiert.')
      setTimeout(() => setExportHinweis(null), 2500)
    })
  }, [scan, scanFilter])

  const loescheTrade = useCallback(
    async (id: string) => {
      setTradeLaden(true)
      try {
        const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/trades', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        if (!res.ok) throw new Error(((await res.json()) as { fehler?: string }).fehler ?? 'Löschen fehlgeschlagen.')
        await ladeAlles()
      } catch (e) {
        setFehler(String(e))
      } finally {
        setTradeLaden(false)
      }
    },
    [ladeAlles],
  )

  const max = status?.watchlistMax ?? 32
  const voll = watchlist.length >= max
  const regime = status?.regime ?? scan?.regime?.regime ?? null
  const busy = fullSyncLaeuft || barsSyncLaeuft || earningsSyncLaeuft || scanLaeuft

  const gefilterteScan = scan ? filterScanErgebnisse(scan.ergebnisse, scanFilter) : []

  return (
    <PortfolioAnalyseShell title="Momentum Trader">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PaSectionTitle
            title="Momentum Trader"
            description="Watchlist → Daten → Regel-Scan (Fade, Momentum, IPO) → Journal. Max. 10 € Risiko pro Trade."
          />
          <button
            type="button"
            onClick={() => void starteFullSync()}
            disabled={busy || laden || watchlist.length === 0}
            className="rounded-xl bg-gradient-to-r from-violet-500/20 to-teal-500/20 px-5 py-2.5 text-sm font-semibold text-[var(--app-text)] ring-1 ring-violet-500/30 transition hover:from-violet-500/30 hover:to-teal-500/30 disabled:opacity-50"
          >
            {fullSyncLaeuft ? 'Pipeline läuft …' : 'Alles aktualisieren'}
          </button>
        </div>

        {syncLog.length > 0 && (
          <PaCard className="border-teal-500/20 bg-teal-500/5 p-4">
            <p className="text-xs font-medium text-teal-300">Letzter Sync</p>
            <ul className="mt-2 space-y-1 text-xs text-[var(--app-text-muted)]">
              {syncLog.map((s) => (
                <li key={s}>→ {s}</li>
              ))}
            </ul>
          </PaCard>
        )}

        {fehler && (
          <PaCard className="border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{fehler}</PaCard>
        )}

        <ErinnerungenLeiste items={erinnerungen} />

        {performance && performance.tradesGesamt > 0 && <PerformancePanel p={performance} />}

        {regime && (
          <PaCard className="p-5">
            <h2 className="text-sm font-semibold text-[var(--app-text)]">Markt-Regime</h2>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">Stand {regime.handelstag}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatKachel label="S&P 500" wert={regime.spyClose?.toLocaleString('de-DE') ?? '—'} />
              <StatKachel
                label="vs. 20-Tage-MA"
                wert={regime.spyAbove20Ma ? 'darüber ↑' : regime.spyAbove20Ma === false ? 'darunter ↓' : '—'}
              />
              <StatKachel label="VIX" wert={regime.vixClose?.toFixed(2) ?? '—'} />
              <StatKachel label="VIX Δ" wert={regime.vixChangePct != null ? regime.vixChangePct + '%' : '—'} />
            </div>
          </PaCard>
        )}

        <PaCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text)]">Watchlist</h2>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">{watchlist.length} / {max} Titel</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void starteEarningsSync()} disabled={busy || laden || !watchlist.length} className="rounded-xl bg-violet-500/15 px-3 py-2 text-xs font-medium text-violet-300 ring-1 ring-violet-500/25 disabled:opacity-50">
                Earnings
              </button>
              <button type="button" onClick={() => void starteBarsSync()} disabled={busy || laden || !watchlist.length} className="rounded-xl bg-orange-500/15 px-3 py-2 text-xs font-medium text-orange-300 ring-1 ring-orange-500/25 disabled:opacity-50">
                Kurse
              </button>
              <button type="button" onClick={() => void starteScan()} disabled={busy || laden || !watchlist.length} className="rounded-xl bg-teal-500/15 px-3 py-2 text-xs font-medium text-teal-300 ring-1 ring-teal-500/25 disabled:opacity-50">
                Scan
              </button>
            </div>
          </div>

          {!voll && (
            <div className="mt-4 max-w-xl">
              <PaAktienSucheInput onAuswahl={hinzufuegen} laden={hinzufuegenLaden} fehler={fehler} onFehler={setFehler} />
            </div>
          )}

          {watchlist.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--app-text-muted)]">Titel per Suche hinzufügen — dann „Alles aktualisieren“.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)]">
              {watchlist.map((e) => (
                <WatchlistZeile
                  key={e.isin}
                  e={e}
                  meta={meta}
                  onEntfernen={(isin) => void entfernen(isin)}
                  onMetaSpeichern={speichereWatchlistMeta}
                />
              ))}
            </ul>
          )}
        </PaCard>

        <PaCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text)]">Scan</h2>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                Gap-Fade · Earnings-Momentum · IPO-Fade · Vorlauf. BMO/AMC-Gap-Erkennung, Finnhub-Surprise.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--app-surface-muted)]/50 p-1 ring-1 ring-[var(--app-border)]">
              {(
                [
                  ['trade', 'Gap-Fade'],
                  ['momentum', 'Momentum'],
                  ['ipo', 'IPO-Fade'],
                  ['vorlauf', 'Vorlauf'],
                  ['alle', 'Alle'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScanFilter(key)}
                  className={
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition ' +
                    (scanFilter === key
                      ? 'bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]')
                  }
                >
                  {label}
                </button>
              ))}
              </div>
              {scan && scan.ergebnisse.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportiereScan()}
                  className="rounded-lg px-3 py-1.5 text-xs text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)] hover:bg-[var(--app-surface-hover)]"
                >
                  {exportHinweis ?? 'Scan kopieren'}
                </button>
              )}
            </div>
          </div>
          {gefilterteScan.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {gefilterteScan.map((e) => (
                <ScanKarte key={e.symbol + e.playbook + e.scanDate} e={e} onTrade={tradeAusScan} tradeLaden={tradeLaden} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--app-text-muted)]">
              {scanLaeuft
                ? 'Scan läuft …'
                : scan?.ergebnisse.length
                  ? 'Keine Setups in diesem Filter — anderen Tab wählen.'
                  : 'Keine Setups — Pipeline ausführen oder nach Earnings erneut scannen.'}
            </p>
          )}
        </PaCard>

        <PaCard className="p-5">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Trade-Journal</h2>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">Max. 10 € Risiko · Stop/Ziel aus ATR · Performance tracken</p>
          {trades.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--app-text-muted)]">Noch keine Trades — aus einem grünen/gelben Scan erfassen.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {trades.map((t) => (
                <TradeZeile key={t.id} t={t} onSchliessen={schliesseTrade} onLoeschen={loescheTrade} laden={tradeLaden} />
              ))}
            </ul>
          )}
        </PaCard>

        <PaCard className="p-5">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Datenfundament</h2>
          {status && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatKachel label="Watchlist" wert={`${status.watchlistAnzahl}/${status.watchlistMax}`} />
              <StatKachel label="Kerzen" wert={status.barsAnzahl.toLocaleString('de-DE')} />
              <StatKachel label="Earnings" wert={status.earningsKalenderAnzahl} />
              <StatKachel label="Gap-Historie" wert={status.earningsEventsAnzahl} />
              <StatKachel label="Trades" wert={status.tradesAnzahl} />
            </div>
          )}
          {letztesBarsSync && (
            <p className="mt-3 text-xs text-[var(--app-text-muted)]">
              Kurse: {letztesBarsSync.kerzenGeschrieben} Kerzen
            </p>
          )}
          {letztesEarningsSync && (
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              Earnings: {letztesEarningsSync.termineGeschrieben} Termine
            </p>
          )}
        </PaCard>
      </div>
    </PortfolioAnalyseShell>
  )
}

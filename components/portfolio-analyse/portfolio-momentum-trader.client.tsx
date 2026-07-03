'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PaSectionTitle } from '@/components/portfolio-analyse/pa-ui'
import {
  MomentumErinnerungenEinstellungen,
  MomentumErinnerungenNotifier,
} from '@/components/portfolio-analyse/momentum-erinnerungen-notifier'
import {
  MomentumWatchlistSucheInput,
  type MomentumWatchlistAuswahl,
} from '@/components/portfolio-analyse/momentum-watchlist-suche-input'
import { momentumApiFetch, parseMomentumApiJsonOderFehler, parseMomentumApiJsonOptional } from '@/lib/portfolio-analyse/momentum-trader/momentum-api-fetch'
import { istMomentumPreIpoEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-pseudo-isin'
import type {
  MomentumAmpel,
  MomentumBarsSyncErgebnis,
  MomentumDatenStatus,
  MomentumEarningsKalenderMonat,
  MomentumEarningsSyncErgebnis,
  MomentumErinnerung,
  MomentumFullSyncErgebnis,
  MomentumHandlungsempfehlung,
  MomentumHandlungssignal,
  MomentumKatalysatorTracking,
  MomentumPerformance,
  MomentumPlaybook,
  MomentumTopSignalTracking,
  MomentumPlaybookStatsPaket,
  MomentumRichtung,
  MomentumScanEintrag,
  MomentumScanPaket,
  MomentumScoreVerlaufPunkt,
  MomentumTrade,
  MomentumWatchlistEintragAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  BACKTEST_MIN_SAMPLES_GLOBAL,
  PLANUNG_TOP_MIN_SCORE,
  PLAYBOOK_MIN_BACKTEST_TREFFER_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  MOMENTUM_ALL_PLAYBOOKS,
  MOMENTUM_PATTERN_PLAYBOOKS,
  MOMENTUM_TRADE_PLAYBOOKS,
  playbookKategorieLabel,
  playbookMeta,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-registry'

function StatKachel({ label, wert }: { label: string; wert: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--app-text)]">{wert}</p>
    </div>
  )
}

function ScoreSparkline({ punkte }: { punkte: MomentumScoreVerlaufPunkt[] }) {
  if (punkte.length < 2) return null
  const scores = punkte.map((p) => p.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const w = 72
  const h = 22
  const pts = punkte
    .map((p, i) => {
      const x = (i / (punkte.length - 1)) * w
      const y = h - ((p.score - min) / range) * (h - 2) - 1
      return x + ',' + y
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="text-teal-400/80" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function PlanungsRing({
  score,
  erwartungEur,
  label = 'Planungs-Score',
}: {
  score: number
  erwartungEur?: number | null
  label?: string
}) {
  const r = 44
  const c = 2 * Math.PI * r
  const dash = score > 0 ? (score / 100) * c : 0
  const farbe =
    score >= 62 ? 'text-emerald-400' : score >= 54 ? 'text-teal-400' : score > 0 ? 'text-amber-400' : 'text-zinc-500'
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
        {score > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className={farbe + ' transition-all duration-500'}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-[var(--app-text)]">{score > 0 ? score : '—'}</span>
        {erwartungEur != null ? (
          <span className="text-[9px] tabular-nums text-teal-300/90">
            {erwartungEur >= 0 ? '+' : ''}
            {erwartungEur} €
          </span>
        ) : null}
        <span className="max-w-[4.5rem] text-center text-[9px] uppercase leading-tight tracking-wider text-[var(--app-text-muted)]">
          {label}
        </span>
      </div>
    </div>
  )
}

function WahrscheinlichkeitsRing({ pct, label = 'Trade geht auf' }: { pct: number; label?: string }) {
  const r = 44
  const c = 2 * Math.PI * r
  const dash = pct > 0 ? (pct / 100) * c : 0
  const farbe =
    pct >= 72 ? 'text-emerald-400' : pct >= 55 ? 'text-teal-400' : pct > 0 ? 'text-amber-400' : 'text-zinc-500'
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
        {pct > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className={farbe + ' transition-all duration-500'}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-[var(--app-text)]">{pct > 0 ? pct + '%' : '—'}</span>
        <span className="max-w-[4.5rem] text-center text-[9px] uppercase leading-tight tracking-wider text-[var(--app-text-muted)]">
          {label}
        </span>
      </div>
    </div>
  )
}

function MiniPlanungsRing({ score }: { score: number }) {
  const r = 36
  const c = 2 * Math.PI * r
  const dash = score > 0 ? (score / 100) * c : 0
  const farbe =
    score >= 62 ? 'text-emerald-400' : score >= 54 ? 'text-teal-400' : score > 0 ? 'text-amber-400' : 'text-zinc-500'
  return (
    <div className="relative h-[4.5rem] w-[4.5rem] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
        {score > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className={farbe}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums text-[var(--app-text)]">{score > 0 ? score : '—'}</span>
        <span className="text-[7px] uppercase tracking-wide text-[var(--app-text-muted)]">Planung</span>
      </div>
    </div>
  )
}

function richtungLabel(r: MomentumHandlungssignal['richtung']) {
  if (r === 'long') return 'LONG'
  if (r === 'short') return 'SHORT'
  return 'WARTEN'
}

function HandlungsplanKarte({ plan }: { plan: import('@/lib/portfolio-analyse/momentum-trader/momentum-trader-types').MomentumHandlungsplan }) {
  const p = plan
  const richtungFarbe = p.richtung === 'long' ? 'text-emerald-300' : 'text-rose-300'
  const schritte = p.schritte?.length > 0 ? p.schritte : []

  const phaseStil = (phase: string) => {
    if (phase === 'trigger') return 'border-amber-500/30 bg-amber-500/5'
    if (phase === 'nach_event') return 'border-violet-500/25 bg-violet-500/5'
    if (phase === 'risiko') return 'border-rose-500/25 bg-rose-500/5'
    return 'border-teal-500/20 bg-teal-500/5'
  }

  const phaseLabel = (phase: string) => {
    if (phase === 'trigger') return 'Trigger'
    if (phase === 'nach_event') return 'Nach Earnings'
    if (phase === 'risiko') return 'Risiko'
    return 'Jetzt'
  }

  return (
    <div className="rounded-xl border border-teal-500/25 bg-gradient-to-br from-teal-500/8 to-black/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-teal-300/90">
            {p.modus === 'aktiv' ? 'Ausführungsplan' : 'Vorbereitungsplan'}
          </p>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{p.instrumentLabel}</p>
        </div>
        {p.zeitfenster ? (
          <span className="rounded-lg bg-violet-500/15 px-2.5 py-1 text-[10px] text-violet-200 ring-1 ring-violet-500/25">
            {p.zeitfenster}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-black/30 px-3 py-2 ring-1 ring-white/5">
          <p className="text-[9px] uppercase text-[var(--app-text-muted)]">Einstieg</p>
          <p className="mt-0.5 text-base font-bold tabular-nums">{p.entryPreis.toFixed(2)}</p>
          <p className="text-[10px] text-[var(--app-text-muted)]">{p.entryHinweis}</p>
        </div>
        <div className="rounded-lg bg-black/30 px-3 py-2 ring-1 ring-rose-500/25">
          <p className="text-[9px] uppercase text-rose-300/80">Stop</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-rose-200">{p.stopLoss.toFixed(2)}</p>
          <p className="text-[10px] text-[var(--app-text-muted)]">−{p.stopAbstandPct}% · ~{p.riskEur} € am Stop</p>
        </div>
        <div className="rounded-lg bg-black/30 px-3 py-2 ring-1 ring-emerald-500/25">
          <p className="text-[9px] uppercase text-emerald-300/80">Ziel</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-emerald-200">{p.takeProfit.toFixed(2)}</p>
          <p className="text-[10px] text-[var(--app-text-muted)]">+{p.zielAbstandPct}% · ~{p.gewinnZielEur} €</p>
        </div>
        <div className="rounded-lg bg-black/30 px-3 py-2 ring-1 ring-violet-500/25">
          <p className="text-[9px] uppercase text-violet-300/80">CFD XTB</p>
          <p className={'mt-0.5 text-base font-bold tabular-nums ' + richtungFarbe}>5× fest</p>
          <p className="text-[10px] text-[var(--app-text-muted)]">Einsatz ~{p.marginEur} € · Exp. {p.exposureEur} €</p>
        </div>
      </div>

      {p.triggerBedingungen.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Alle Trigger erforderlich</p>
          <ul className="mt-2 space-y-1">
            {p.triggerBedingungen.map((t) => (
              <li key={t} className="flex items-start gap-2 text-xs text-amber-100/95">
                <span className="mt-0.5 text-amber-400">□</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {schritte.length > 0 && (
        <ol className="mt-4 space-y-2">
          {schritte.map((s) => (
            <li
              key={s.nr + s.titel}
              className={'rounded-lg border px-3 py-2.5 ' + phaseStil(s.phase)}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/40 text-xs font-bold tabular-nums text-teal-300">
                  {s.nr}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
                    {phaseLabel(s.phase)}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">{s.titel}</p>
                  {s.detail ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--app-text-muted)]">{s.detail}</p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {p.nichtTun && p.nichtTun.length > 0 && (
        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase text-rose-300">Nicht tun</p>
          <ul className="mt-1.5 space-y-1 text-xs text-rose-200/90">
            {p.nichtTun.map((n) => (
              <li key={n}>✕ {n}</li>
            ))}
          </ul>
        </div>
      )}

      {p.stueckzahl != null && p.stueckzahl > 0 && (
        <p className="mt-3 text-[10px] text-[var(--app-text-muted)]">
          Ohne Hebel: ca. {p.stueckzahl} Aktien — gleiche Exposure wie CFD-Plan.
        </p>
      )}
    </div>
  )
}

function HandlungsempfehlungPanel({
  empfehlung,
  onSync,
  syncLaeuft,
}: {
  empfehlung: MomentumHandlungsempfehlung
  onSync: () => void
  syncLaeuft: boolean
}) {
  const [kontextOffen, setKontextOffen] = useState(false)
  const [signalIdx, setSignalIdx] = useState(0)
  const signale = empfehlung.signale
  const signal = signale[signalIdx] ?? empfehlung.topSignal
  const brauchtSync = !empfehlung.hatAktivesTradeSetup && empfehlung.datenHinweise.length > 0 && !signal

  const topPositionen = empfehlung.positionen
    .filter((p) => p.prioritaet >= 70)
    .slice(0, 4)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--app-surface-muted)] via-black/40 to-violet-950/30 p-5 shadow-2xl shadow-black/40 ring-1 ring-white/5 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative mb-5 rounded-xl border border-white/5 bg-black/25 px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--app-text-muted)]">Überblick</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--app-text)]">{empfehlung.zusammenfassung}</p>
        <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">{empfehlung.regimeText}</p>
      </div>

      {signal ? (
        <div className="relative space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ' +
                    (signal.istAktiv ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300')
                  }
                >
                  {signal.istAktiv ? 'Jetzt ausführen' : 'Vorbereiten'}
                </span>
                <span className="text-sm font-medium text-[var(--app-text-muted)]">{signal.symbol}</span>
                <span
                  className={
                    'rounded-lg px-2 py-0.5 text-xs font-black uppercase ' +
                    (signal.richtung === 'long'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : signal.richtung === 'short'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300')
                  }
                >
                  {richtungLabel(signal.richtung)}
                </span>
                {signal.wahrscheinlichkeitPct > 0 ? (
                  <span className="rounded-lg bg-teal-500/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-teal-200 ring-1 ring-teal-500/25">
                    {signal.wahrscheinlichkeitPct}% Trade geht auf
                  </span>
                ) : null}
              </div>

              <div className="rounded-xl border border-teal-500/30 bg-gradient-to-r from-teal-500/15 to-transparent px-4 py-3 ring-1 ring-teal-500/20">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-300">Deine nächste Aktion</p>
                <p className="mt-2 text-base font-semibold leading-snug text-[var(--app-text)] sm:text-lg">
                  {signal.aktionJetzt || signal.kurztext}
                </p>
                {signal.timing ? (
                  <p className="mt-2 text-xs text-teal-200/80">⏱ {signal.timing}</p>
                ) : null}
              </div>

              {signal.checkliste && signal.checkliste.length > 0 && (
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">Checkliste</p>
                  <ul className="mt-2 space-y-1.5">
                    {signal.checkliste.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-xs text-[var(--app-text)]">
                        <span className="text-teal-400">□</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {signal.warnungen && signal.warnungen.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {signal.warnungen.map((w) => (
                    <span
                      key={w}
                      className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-2.5 py-1 text-[11px] text-amber-200/90"
                    >
                      ⚠ {w}
                    </span>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setKontextOffen((v) => !v)}
                className="text-[11px] text-[var(--app-text-muted)] underline-offset-2 hover:underline"
              >
                {kontextOffen ? 'Weniger Kontext' : 'Warum? Daten & Alternativen'}
              </button>

              {kontextOffen && (
                <div className="space-y-3 rounded-xl border border-white/5 bg-black/15 p-3">
                  <p className="text-xs leading-relaxed text-[var(--app-text-muted)]">{signal.detailText}</p>
                  {signal.fakten.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {signal.fakten.map((f) => (
                        <span
                          key={f}
                          className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-[var(--app-text-muted)]"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  {signal.alternativen.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase text-[var(--app-text-muted)]">Alternative Szenarien</p>
                      <ul className="mt-1 space-y-1 text-xs text-[var(--app-text-muted)]">
                        {signal.alternativen.map((a) => (
                          <li key={a.label} className="flex justify-between gap-2">
                            <span>
                              {a.richtung === 'long' ? 'Long' : 'Short'} — {a.label}
                            </span>
                            <span className="tabular-nums text-teal-300">{a.wahrscheinlichkeitPct}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {signal.plan && <HandlungsplanKarte plan={signal.plan} />}
            </div>

            <PlanungsRing
              score={signal.planungsScore}
              erwartungEur={signal.planungsErwartungEur}
            />
          </div>

          {signale.length > 1 && (
            <div className="border-t border-white/10 pt-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
                Weitere Titel
              </p>
              <div className="flex flex-wrap gap-2">
                {signale.slice(0, 6).map((s, i) => (
                  <button
                    key={s.symbol + s.playbook}
                    type="button"
                    onClick={() => setSignalIdx(i)}
                    className={
                      'rounded-lg px-3 py-1.5 text-xs ring-1 transition ' +
                      (i === signalIdx
                        ? 'bg-teal-500/20 text-teal-200 ring-teal-500/40'
                        : 'bg-black/20 text-[var(--app-text-muted)] ring-white/10 hover:bg-white/5')
                    }
                  >
                    {s.symbol}{' '}
                    <span className="font-bold">{s.richtung === 'long' ? 'L' : s.richtung === 'short' ? 'S' : '—'}</span>{' '}
                    {s.planungsScore}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--app-text-muted)]">Aktion</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-amber-200">WARTEN</p>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {brauchtSync
                ? 'Daten unvollständig — „Alles aktualisieren“, dann Filter Top-Trades.'
                : 'Kein Top-Trade aktiv — NICHT handeln. Warten bis Badge „Jetzt“ + grüner Ring erscheint.'}
            </p>
          </div>
          <PlanungsRing score={0} label="Warten" />
        </div>
      )}

      {topPositionen.length > 0 && (
        <div className="relative mt-5 border-t border-white/10 pt-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
            Watchlist — Priorität
          </p>
          <ul className="space-y-2">
            {topPositionen.map((pos) => (
              <li
                key={pos.symbol}
                className="flex gap-3 rounded-lg border border-white/5 bg-black/15 px-3 py-2 text-xs"
              >
                <span
                  className={
                    'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ' +
                    (pos.aktion === 'trade_pruefen'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : pos.aktion === 'vorbereiten'
                        ? 'bg-amber-500/20 text-amber-300'
                        : pos.aktion === 'sync'
                          ? 'bg-violet-500/20 text-violet-300'
                          : 'bg-white/10 text-[var(--app-text-muted)]')
                  }
                >
                  {pos.aktion === 'trade_pruefen'
                    ? 'Trade'
                    : pos.aktion === 'vorbereiten'
                      ? 'Prep'
                      : pos.aktion === 'sync'
                        ? 'Sync'
                        : 'Watch'}
                </span>
                <span className="text-[var(--app-text-muted)]">
                  <span className="font-medium text-[var(--app-text)]">{pos.name}</span> — {pos.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(brauchtSync || empfehlung.datenHinweise.length > 0) && (
        <div className="relative mt-4 flex flex-wrap items-center gap-3">
          {empfehlung.datenHinweise.slice(0, 2).map((h) => (
            <span key={h} className="text-[10px] text-amber-300/90">
              ○ {h}
            </span>
          ))}
          <button
            type="button"
            onClick={onSync}
            disabled={syncLaeuft}
            className="rounded-xl bg-teal-500/20 px-4 py-2 text-sm font-semibold text-teal-200 ring-1 ring-teal-500/35 hover:bg-teal-500/30 disabled:opacity-50"
          >
            {syncLaeuft ? 'Pipeline läuft …' : 'Daten aktualisieren'}
          </button>
        </div>
      )}

      <div className="relative mt-4 flex flex-wrap gap-2 text-[10px]">
        {empfehlung.longBias && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400/90">Regime Long-Bias</span>
        )}
        {empfehlung.shortBias && (
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-400/90">Regime Short-Bias</span>
        )}
      </div>
    </div>
  )
}

function OnboardingKarte() {
  return (
    <PaCard className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-teal-500/5 p-6">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">So startest du</h2>
      <ol className="mt-4 space-y-3 text-sm text-[var(--app-text-muted)]">
        <li>
          <span className="font-medium text-violet-300">1.</span> Aktie oder Pre-IPO suchen (z. B. Apple, SpaceX) — max. 32
          Titel
        </li>
        <li>
          <span className="text-sm font-medium text-[var(--app-text-muted)]">2.</span> „Alles aktualisieren“ — Kurse, Regime, Scan (Gap, Trend, Earnings)
        </li>
        <li>
          <span className="font-medium text-violet-300">3.</span> Setups prüfen → Trade im Journal erfassen
        </li>
        <li>
          <span className="font-medium text-violet-300">4.</span> Exit im Journal schließen → Performance tracken
        </li>
      </ol>
      <p className="mt-4 text-xs text-[var(--app-text-muted)]">
        Playbooks: Gap · Trend · Mean Rev. · Regime · News · Earnings · IPO
      </p>
    </PaCard>
  )
}

function EarningsKalenderPanel({ kalender }: { kalender: MomentumEarningsKalenderMonat }) {
  if (kalender.gesamt === 0) {
    return (
      <PaCard className="p-5">
        <h2 className="text-sm font-semibold text-[var(--app-text)]">Earnings-Kalender</h2>
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">
          Keine Termine in den nächsten Wochen — Earnings-Sync ausführen.
        </p>
      </PaCard>
    )
  }
  return (
    <PaCard className="p-5">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">Earnings-Kalender</h2>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        {kalender.gesamt} Termin(e) bis {new Date(kalender.bis + 'T12:00:00').toLocaleDateString('de-DE')}
      </p>
      <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
        {kalender.tage.map((tag) => (
          <li key={tag.datum}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-violet-300/90">
              {new Date(tag.datum + 'T12:00:00').toLocaleDateString('de-DE', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
              })}
            </p>
            <ul className="mt-1 space-y-1">
              {tag.eintraege.map((e) => (
                <li
                  key={e.symbol + e.earningsDate}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--app-surface-muted)]/40 px-2.5 py-1.5 text-xs"
                >
                  <span className="font-medium text-[var(--app-text)]">
                    {e.symbol} · {e.name}
                  </span>
                  <span className="text-[var(--app-text-muted)]">
                    in {e.tageBis}T · {e.zeitLabel}
                    {e.medianGapPct != null ? ' · Median ' + e.medianGapPct.toFixed(1) + '%' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </PaCard>
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
  const playbooks: MomentumPlaybook[] = MOMENTUM_ALL_PLAYBOOKS.filter(
    (pb) => (p.nachPlaybook[pb]?.trades ?? 0) > 0,
  )
  const playbooksAnzeige =
    playbooks.length > 0 ? playbooks : (['gap_fade', 'trend_pullback', 'earnings_gap_fade'] as MomentumPlaybook[])

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
            {playbooksAnzeige.map((pb) => {
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

function PlaybookBacktestPanel({ paket }: { paket: MomentumPlaybookStatsPaket }) {
  const global = paket.stats
    .filter((s) => !s.symbol && s.sampleSize > 0)
    .sort((a, b) => (b.trefferPct ?? 0) - (a.trefferPct ?? 0))
  if (global.length === 0) return null

  const jahre = Math.round(paket.fensterTage / 252)

  return (
    <PaCard className="p-5">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">Playbook-Backtest</h2>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        Historische Trefferquoten (~{jahre}J) · Pausiert unter {PLAYBOOK_MIN_BACKTEST_TREFFER_PCT}% bei ≥
        {BACKTEST_MIN_SAMPLES_GLOBAL} Samples
        {paket.berechnetAm ? ' · Stand ' + paket.berechnetAm.slice(0, 10) : ''}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[360px] text-left text-xs">
          <thead>
            <tr className="text-[var(--app-text-muted)]">
              <th className="pb-2 font-medium">Playbook</th>
              <th className="pb-2 font-medium">Treffer</th>
              <th className="pb-2 font-medium">Quote</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-[var(--app-text)]">
            {global.map((s) => {
              const pausiert =
                s.sampleSize >= BACKTEST_MIN_SAMPLES_GLOBAL &&
                s.trefferPct != null &&
                s.trefferPct < PLAYBOOK_MIN_BACKTEST_TREFFER_PCT
              return (
                <tr key={s.playbook} className="border-t border-[var(--app-border)]">
                  <td className="py-2">{momentumPlaybookLabel(s.playbook)}</td>
                  <td className="py-2 tabular-nums">
                    {s.wins}/{s.sampleSize}
                  </td>
                  <td className="py-2 tabular-nums">
                    {s.trefferPct != null ? s.trefferPct + '%' : '—'}
                  </td>
                  <td className="py-2">
                    {pausiert ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                        pausiert
                      </span>
                    ) : (
                      <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] text-teal-300">
                        aktiv
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </PaCard>
  )
}

function KatalysatorTrackingPanel({ t }: { t: MomentumKatalysatorTracking }) {
  if (t.katalysatoren === 0) {
    return (
      <PaCard className="p-5">
        <h2 className="text-sm font-semibold text-[var(--app-text)]">Pre-Event → Trade-Setup</h2>
        <p className="mt-2 text-xs text-[var(--app-text-muted)]">
          Noch keine auswertbaren Katalysatoren — Scan-Verlauf füllt sich nach täglichen Scans.
        </p>
      </PaCard>
    )
  }

  return (
    <PaCard className="p-5">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">Pre-Event → Trade-Setup</h2>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        Letzte {t.fensterTage} Tage · Pre-Event-Signal (gelb, Score ≥45) vs. Gap-Fade/Momentum innerhalb 3 Tage nach
        Earnings
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatKachel label="Katalysatoren" wert={t.katalysatoren} />
        <StatKachel label="Mit Post-Setup" wert={t.mitTradeSetup} />
        <StatKachel label="Trefferquote" wert={t.trefferquotePct != null ? t.trefferquotePct + '%' : '—'} />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="text-[var(--app-text-muted)]">
              <th className="pb-2 font-medium">Symbol</th>
              <th className="pb-2 font-medium">Earnings</th>
              <th className="pb-2 font-medium">Pre</th>
              <th className="pb-2 font-medium">Post</th>
              <th className="pb-2 font-medium">Gap</th>
            </tr>
          </thead>
          <tbody className="text-[var(--app-text)]">
            {t.eintraege.map((e) => (
              <tr key={e.symbol + e.earningsDate} className="border-t border-[var(--app-border)]">
                <td className="py-2 font-medium">{e.symbol}</td>
                <td className="py-2 tabular-nums">{e.earningsDate}</td>
                <td className="py-2 tabular-nums">{e.preEventScore ?? '—'}</td>
                <td className="py-2">
                  {e.postTradeSetup ? (
                    <span className="text-teal-300">
                      {e.postPlaybook ? momentumPlaybookLabel(e.postPlaybook) : 'Setup'} ({e.postAmpel})
                    </span>
                  ) : (
                    <span className="text-[var(--app-text-muted)]">—</span>
                  )}
                </td>
                <td className="py-2 tabular-nums">{e.gapPct != null ? e.gapPct.toFixed(1) + '%' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PaCard>
  )
}

function outcomeLabel(outcome: string): string {
  if (outcome === 'win') return 'Gewinn'
  if (outcome === 'loss') return 'Verlust'
  if (outcome === 'timeout') return 'Timeout'
  return 'Ausstehend'
}

function outcomeFarbe(outcome: string): string {
  if (outcome === 'win') return 'text-emerald-300'
  if (outcome === 'loss') return 'text-red-300'
  if (outcome === 'timeout') return 'text-amber-300'
  return 'text-[var(--app-text-muted)]'
}

function TopSignalTrackingPanel({ t }: { t: MomentumTopSignalTracking }) {
  const playbooks = Object.keys(t.nachPlaybook) as MomentumPlaybook[]

  if (t.signaleGesamt === 0) {
    return (
      <PaCard className="p-5">
        <h2 className="text-sm font-semibold text-[var(--app-text)]">Top-Signal-Tracking</h2>
        <p className="mt-2 text-xs text-[var(--app-text-muted)]">
          Noch keine archivierten Top-Signale — nach täglichen Scans werden aktive Setups (Planung ≥{PLANUNG_TOP_MIN_SCORE})
          automatisch gespeichert und nach 5 Handelstagen ausgewertet.
        </p>
      </PaCard>
    )
  }

  const delta =
    t.kalibrierungsDeltaPct != null
      ? (t.kalibrierungsDeltaPct >= 0 ? '+' : '') + t.kalibrierungsDeltaPct + ' %'
      : '—'

  return (
    <PaCard className="p-5">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">Top-Signal-Tracking</h2>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        Letzte {t.fensterTage} Tage · Aktive Top-Signale (Planung ≥{PLANUNG_TOP_MIN_SCORE}) vs. Kursverlauf (Stop/Ziel, 5T) ·
        Journal-Vergleich
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatKachel
          label="Trefferquote (simuliert)"
          wert={t.trefferquotePct != null ? t.trefferquotePct + '%' : '—'}
        />
        <StatKachel
          label="Ø Vorhersage"
          wert={t.avgVorhersagePct != null ? t.avgVorhersagePct + '%' : '—'}
        />
        <StatKachel label="Kalibrierung Δ" wert={delta} />
        <StatKachel
          label="Journal PnL"
          wert={
            t.journalPnlEur != null
              ? (t.journalPnlEur >= 0 ? '+' : '') + t.journalPnlEur.toFixed(2) + ' €'
              : '—'
          }
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <StatKachel label="Signale gesamt" wert={t.signaleGesamt} />
        <StatKachel label="Ausgewertet" wert={t.ausgewertet} />
        <StatKachel label="Im Journal" wert={t.journalSignale} />
        <StatKachel
          label="Journal Win-Rate"
          wert={t.journalWinRatePct != null ? t.journalWinRatePct + '%' : '—'}
        />
      </div>
      {playbooks.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-xs">
            <thead>
              <tr className="text-[var(--app-text-muted)]">
                <th className="pb-2 font-medium">Playbook</th>
                <th className="pb-2 font-medium">Signale</th>
                <th className="pb-2 font-medium">Treffer</th>
                <th className="pb-2 font-medium">Quote</th>
              </tr>
            </thead>
            <tbody className="text-[var(--app-text)]">
              {playbooks
                .sort((a, b) => (t.nachPlaybook[b]?.signale ?? 0) - (t.nachPlaybook[a]?.signale ?? 0))
                .map((pb) => {
                  const s = t.nachPlaybook[pb]
                  if (!s) return null
                  return (
                    <tr key={pb} className="border-t border-[var(--app-border)]">
                      <td className="py-2">{momentumPlaybookLabel(pb)}</td>
                      <td className="py-2 tabular-nums">{s.signale}</td>
                      <td className="py-2 tabular-nums">{s.gewinne}</td>
                      <td className="py-2 tabular-nums">
                        {s.trefferPct != null ? s.trefferPct + '%' : '—'}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="text-[var(--app-text-muted)]">
              <th className="pb-2 font-medium">Symbol</th>
              <th className="pb-2 font-medium">Datum</th>
              <th className="pb-2 font-medium">Playbook</th>
              <th className="pb-2 font-medium">Vorhersage</th>
              <th className="pb-2 font-medium">Outcome</th>
              <th className="pb-2 font-medium">Journal</th>
            </tr>
          </thead>
          <tbody className="text-[var(--app-text)]">
            {t.eintraege.map((e) => (
              <tr key={e.symbol + e.playbook + e.scanDate} className="border-t border-[var(--app-border)]">
                <td className="py-2 font-medium">
                  {e.symbol}{' '}
                  <span className="text-[var(--app-text-muted)]">{e.direction.toUpperCase()}</span>
                </td>
                <td className="py-2 tabular-nums">{e.scanDate}</td>
                <td className="py-2">{momentumPlaybookLabel(e.playbook)}</td>
                <td className="py-2 tabular-nums">{e.erfolgPct}%</td>
                <td className={`py-2 font-medium ${outcomeFarbe(e.outcome)}`}>{outcomeLabel(e.outcome)}</td>
                <td className="py-2">
                  {e.imJournal ? (
                    e.journalGeschlossen ? (
                      <span className={(e.journalPnlEur ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                        {(e.journalPnlEur ?? 0) >= 0 ? '+' : ''}
                        {e.journalPnlEur?.toFixed(2)} €
                      </span>
                    ) : (
                      <span className="text-amber-300">offen</span>
                    )
                  ) : (
                    <span className="text-[var(--app-text-muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.ausstehend > 0 && (
        <p className="mt-3 text-[10px] text-[var(--app-text-muted)]">
          {t.ausstehend} Signal{t.ausstehend === 1 ? '' : 'e'} warten noch auf Auswertung (5 Handelstage).
        </p>
      )}
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

const TRADE_PLAYBOOKS: MomentumPlaybook[] = [...MOMENTUM_TRADE_PLAYBOOKS]

type ScanFilterKey =
  | 'top'
  | 'taeglich'
  | 'pattern'
  | 'mean_reversion'
  | 'regime'
  | 'katalysator'
  | 'earnings'
  | 'ipo'
  | 'pre_event'
  | 'alle'

function planungsScore(e: MomentumScanEintrag): number {
  return typeof e.indikatoren.planungsScore === 'number' ? e.indikatoren.planungsScore : 0
}

function erfolgPct(e: MomentumScanEintrag): number {
  return typeof e.indikatoren.erfolgWahrscheinlichkeitPct === 'number'
    ? e.indikatoren.erfolgWahrscheinlichkeitPct
    : 0
}

function filterScanErgebnisse(
  ergebnisse: MomentumScanEintrag[],
  scanFilter: ScanFilterKey,
): MomentumScanEintrag[] {
  const taegliche = new Set<MomentumPlaybook>([
    'gap_fade',
    'gap_and_go',
    'volume_spike_breakout',
    'trend_pullback',
    'trend_breakout',
    'relative_strength_leader',
  ])
  const patternPlaybooks = new Set<MomentumPlaybook>(MOMENTUM_PATTERN_PLAYBOOKS)
  const meanReversion = new Set<MomentumPlaybook>([
    'oversold_bounce',
    'overbought_fade',
    'range_fade',
  ])
  const regimePlaybooks = new Set<MomentumPlaybook>([
    'sector_rotation_long',
    'market_regime_long',
    'market_regime_short',
  ])
  const earningsTrade = new Set<MomentumPlaybook>([
    'earnings_gap_fade',
    'earnings_momentum',
    'earnings_pre_run',
    'earnings_post_run',
    'guidance_shock',
    'revenue_beat_divergence',
  ])
  const katalysatorPlaybooks = new Set<MomentumPlaybook>([
    'news_gap',
    'analyst_upgrade',
    'insider_cluster',
    'short_squeeze_setup',
  ])

  return ergebnisse
    .filter((e) => {
      if (scanFilter === 'alle') return true
      if (scanFilter === 'pre_event') {
        return (
          e.playbook === 'earnings_pre_event' ||
          e.playbook === 'earnings_vorlauf' ||
          e.playbook === 'earnings_pre_run'
        )
      }
      if (scanFilter === 'earnings') return earningsTrade.has(e.playbook)
      if (scanFilter === 'taeglich') return taegliche.has(e.playbook)
      if (scanFilter === 'pattern') return patternPlaybooks.has(e.playbook)
      if (scanFilter === 'mean_reversion') return meanReversion.has(e.playbook)
      if (scanFilter === 'regime') return regimePlaybooks.has(e.playbook)
      if (scanFilter === 'katalysator') return katalysatorPlaybooks.has(e.playbook)
      if (scanFilter === 'ipo') {
        return e.playbook === 'ipo_fade' && e.ampel !== 'grau'
      }
      if (scanFilter === 'top') {
        return (
          TRADE_PLAYBOOKS.includes(e.playbook) &&
          (e.ampel === 'gruen' || e.ampel === 'gelb') &&
          e.indikatoren.erfolgIstAktiv === true &&
          planungsScore(e) >= PLANUNG_TOP_MIN_SCORE
        )
      }
      return true
    })
    .sort((a, b) => planungsScore(b) - planungsScore(a) || b.score - a.score)
}

function DatenqualitaetBadge({ dq }: { dq: MomentumWatchlistEintragAngereichert['datenqualitaet'] }) {
  const farbe =
    dq.status === 'gut'
      ? 'bg-teal-500/15 text-teal-300'
      : dq.status === 'teilweise'
        ? 'bg-amber-500/15 text-amber-300'
        : 'bg-red-500/10 text-red-300'
  return (
    <span className={'rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ' + farbe}>
      Daten {dq.score}%
    </span>
  )
}

function WatchlistZeile({
  e,
  meta,
  preEvent,
  onEntfernen,
  onMetaSpeichern,
  onNachsyncen,
  syncLaden,
}: {
  e: MomentumWatchlistEintragAngereichert
  meta: ReturnType<typeof usePortfolioAnalyse>['meta']
  preEvent?: { score: number; stufe: string; tageBis: number | null } | null
  onEntfernen: (isin: string) => void
  onMetaSpeichern: (isin: string, patch: { ipoDatum?: string | null; notiz?: string | null }) => Promise<void>
  onNachsyncen: (isin: string) => void | Promise<void>
  syncLaden: boolean
}) {
  const [aufgeklappt, setAufgeklappt] = useState(false)
  const [ipoInput, setIpoInput] = useState(e.ipoDatum ?? '')
  const [notizInput, setNotizInput] = useState(e.notiz ?? '')
  const [speichern, setSpeichern] = useState(false)

  const earningsHeute = e.naechstesEarnings?.tageBis === 0
  const earningsBald = e.naechstesEarnings?.tageBis != null && e.naechstesEarnings.tageBis <= 3
  const preIpo = istMomentumPreIpoEintrag(e)

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
          <p className="truncate text-sm font-medium text-[var(--app-text)]">
            {e.name}
            {preIpo ? (
              <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-violet-300">
                Pre-IPO
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-[var(--app-text-muted)]">
            {e.symbolYahoo ?? e.symbolCandidates[0] ?? '—'} · {preIpo ? 'Beobachtung' : e.isin}
          </p>
          {preEvent && !preIpo ? (
            <p className="mt-0.5 text-xs text-amber-300/90">
              Pre-Event Score {preEvent.score}
              {preEvent.tageBis != null ? ' · in ' + preEvent.tageBis + ' Tagen' : ''}
              {preEvent.stufe === 'hoch' ? ' · Katalysator hoch' : ''}
            </p>
          ) : preIpo && e.ipoDatum ? (
            <p className="mt-0.5 text-xs text-violet-300/90">
              IPO geplant {new Date(e.ipoDatum + 'T12:00:00').toLocaleDateString('de-DE')}
            </p>
          ) : e.naechstesEarnings ? (
            <p className="mt-0.5 text-xs text-violet-300/90">
              Earnings {new Date(e.naechstesEarnings.datum + 'T12:00:00').toLocaleDateString('de-DE')}
              {e.naechstesEarnings.tageBis != null && e.naechstesEarnings.tageBis <= 14
                ? ' · in ' + e.naechstesEarnings.tageBis + ' Tagen'
                : ''}
            </p>
          ) : preIpo ? (
            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">IPO-Datum eintragen (Zeile aufklappen)</p>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">Kein Termin — Sync ausführen</p>
          )}
          {!preIpo && e.medianGapPct != null && (
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Median-Gap {e.medianGapPct.toFixed(1)}% ({e.earningsEventsAnzahl} Events)
            </p>
          )}
          {!preIpo && e.datenqualitaet ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <DatenqualitaetBadge dq={e.datenqualitaet} />
              {e.liveKurs ? (
                <span className="text-[11px] tabular-nums text-teal-300/90">
                  {e.liveKurs.preis.toFixed(2)}
                  {e.liveKurs.quelle === 'pre' ? ' Pre' : e.liveKurs.quelle === 'post' ? ' Post' : ''}
                  {e.liveKurs.gapVsPrevClosePct != null
                    ? ' · ' + (e.liveKurs.gapVsPrevClosePct > 0 ? '+' : '') + e.liveKurs.gapVsPrevClosePct + '%'
                    : ''}
                </span>
              ) : null}
            </div>
          ) : null}
          {e.notiz && !aufgeklappt && (
            <p className="mt-0.5 truncate text-[11px] italic text-[var(--app-text-muted)]">{e.notiz}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {!preIpo ? (
            <button
              type="button"
              disabled={syncLaden}
              onClick={() => void onNachsyncen(e.isin)}
              className="rounded-lg px-2.5 py-1.5 text-xs text-teal-300/90 ring-1 ring-teal-500/30 hover:bg-teal-500/10 disabled:opacity-50"
              title="Earnings, Kurse, Gap-Historie (3J MarketBeat) + Live-Kurs"
            >
              {syncLaden ? '…' : '↻'}
            </button>
          ) : null}
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
          {e.datenqualitaet && e.datenqualitaet.checks.length > 0 ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">Datenqualität</p>
              <ul className="mt-1.5 space-y-1">
                {e.datenqualitaet.checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-[11px]">
                    <span className={c.ok ? 'text-teal-400' : 'text-amber-400'}>{c.ok ? '✓' : '○'}</span>
                    <span className="text-[var(--app-text-muted)]">
                      <span className="font-medium text-[var(--app-text)]">{c.label}</span>
                      {' — '}
                      {c.detail}
                    </span>
                  </li>
                ))}
              </ul>
              {e.datenqualitaet.empfehlung ? (
                <p className="mt-2 text-[11px] text-amber-300/90">{e.datenqualitaet.empfehlung}</p>
              ) : null}
            </div>
          ) : null}
          {e.letzteGapEvents.length > 0 ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">Gap-Historie</p>
              <ul className="mt-1 space-y-1 text-[11px] tabular-nums text-[var(--app-text-muted)]">
                {e.letzteGapEvents.map((g) => (
                  <li key={g.datum}>
                    {new Date(g.datum + 'T12:00:00').toLocaleDateString('de-DE')}: Gap{' '}
                    {g.gapPct != null ? g.gapPct + '%' : '—'}
                    {g.surpriseEpsPct != null ? ' · EPS ' + g.surpriseEpsPct + '%' : ''}
                    {g.surpriseRevPct != null ? ' · Umsatz ' + g.surpriseRevPct + '%' : ''}
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
  verlauf,
}: {
  e: MomentumScanEintrag
  onTrade: (e: MomentumScanEintrag) => void
  tradeLaden: boolean
  verlauf?: MomentumScoreVerlaufPunkt[]
}) {
  const [detailsOffen, setDetailsOffen] = useState(false)
  const gap = e.indikatoren.gapPct
  const rvol = e.indikatoren.rvol
  const richtung = (e.indikatoren.erfolgRichtung ?? e.indikatoren.richtung) as 'long' | 'short' | null | undefined
  const stop = e.indikatoren.stopPrice
  const target = e.indikatoren.targetPrice
  const entry = e.indikatoren.entryPrice
  const planungScoreVal =
    typeof e.indikatoren.planungsScore === 'number' ? e.indikatoren.planungsScore : 0
  const planungLabel =
    typeof e.indikatoren.planungsLabel === 'string' ? e.indikatoren.planungsLabel : null
  const planungErwartungEur =
    typeof e.indikatoren.planungsErwartungEur === 'number' ? e.indikatoren.planungsErwartungEur : null
  const planungBasisText =
    typeof e.indikatoren.planungsBasisText === 'string' ? e.indikatoren.planungsBasisText : null
  const erfolgPct =
    typeof e.indikatoren.erfolgWahrscheinlichkeitPct === 'number'
      ? e.indikatoren.erfolgWahrscheinlichkeitPct
      : 0
  const handlungKurz =
    typeof e.indikatoren.handlungKurz === 'string' ? e.indikatoren.handlungKurz : null
  const erfolgLabel =
    typeof e.indikatoren.erfolgLabel === 'string' ? e.indikatoren.erfolgLabel : null
  const backtestTrefferPct =
    typeof e.indikatoren.backtestTrefferPct === 'number' ? e.indikatoren.backtestTrefferPct : null
  const backtestHinweis =
    typeof e.indikatoren.backtestHinweis === 'string' ? e.indikatoren.backtestHinweis : null
  const erfolgBasisText =
    typeof e.indikatoren.erfolgBasisText === 'string' ? e.indikatoren.erfolgBasisText : null
  const istAktiv = e.indikatoren.erfolgIstAktiv === true
  const pausiert = e.indikatoren.playbookDeaktiviert === true
  const pausiertGrund =
    typeof e.indikatoren.playbookDeaktiviertGrund === 'string'
      ? e.indikatoren.playbookDeaktiviertGrund
      : null
  const istPreEvent =
    e.playbook === 'earnings_pre_event' || e.playbook === 'earnings_vorlauf' || e.playbook === 'earnings_pre_run'
  const szenarioPlan =
    typeof e.indikatoren.szenarioPlan === 'string' ? e.indikatoren.szenarioPlan : null
  const kiMemo = e.indikatoren.kiBegruendung
  const kannTrade =
    TRADE_PLAYBOOKS.includes(e.playbook) &&
    e.ampel !== 'grau' &&
    e.ampel !== 'rot' &&
    richtung != null &&
    !pausiert

  return (
    <li className={`rounded-xl p-4 ring-1 ${ampelRing(e.ampel)}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--app-text)]">
              {e.symbol} · {playbookTitel(e.playbook)}
            </p>
            <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-violet-300/90">
              {playbookKategorieLabel(playbookMeta(e.playbook).kategorie)}
            </span>
            {richtung === 'long' ? (
              <span className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                Long
              </span>
            ) : richtung === 'short' ? (
              <span className="rounded-lg bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                Short
              </span>
            ) : null}
            <span
              className={
                'rounded-lg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)]'
              }
            >
              {e.ampel}
            </span>
            {istAktiv ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                Jetzt
              </span>
            ) : istPreEvent ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Vorbereiten
              </span>
            ) : pausiert ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Pausiert
              </span>
            ) : null}
          </div>

          {handlungKurz ? (
            <p className="mt-2 text-sm font-medium leading-snug text-[var(--app-text)]">{handlungKurz}</p>
          ) : (
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">Score {e.score}/100</p>
          )}

          {pausiertGrund ? (
            <p className="mt-1 text-[11px] text-amber-300/90">{pausiertGrund}</p>
          ) : null}

          {planungScoreVal > 0 ? (
            <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">
              Planungs-Score:{' '}
              <span className="font-semibold text-teal-300">{planungScoreVal}/100</span>
              {planungLabel ? (
                <>
                  {' · '}
                  <span className="font-medium">{planungLabel}</span>
                </>
              ) : null}
              {planungErwartungEur != null ? (
                <span className="text-teal-300/90">
                  {' · Erwartung '}
                  {planungErwartungEur >= 0 ? '+' : ''}
                  {planungErwartungEur} € Erwartung
                </span>
              ) : null}
              {planungBasisText ? (
                <span className="block mt-0.5 text-[10px] text-[var(--app-text-muted)]">{planungBasisText}</span>
              ) : null}
            </p>
          ) : null}

          {erfolgLabel && erfolgPct > 0 ? (
            <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">
              Trefferchance:{' '}
              {backtestTrefferPct != null ? (
                <>
                  <span className="font-medium text-[var(--app-text)]">{backtestTrefferPct}%</span> Backtest
                  {backtestTrefferPct !== erfolgPct ? (
                    <>
                      {' · heute '}
                      <span className="font-medium text-teal-300">{erfolgPct}%</span>
                    </>
                  ) : null}
                </>
              ) : (
                <span className="font-medium text-teal-300">{erfolgPct}%</span>
              )}
              {' · '}
              <span className="font-medium">{erfolgLabel}</span>
              {erfolgBasisText ? (
                <span className="block mt-0.5 text-[10px] text-[var(--app-text-muted)]">Basis: {erfolgBasisText}</span>
              ) : null}
              {backtestHinweis ? (
                <span className="text-[var(--app-text-muted)]"> · {backtestHinweis}</span>
              ) : null}
            </p>
          ) : null}

          {istAktiv && entry != null && stop != null && target != null && (
            <div className="mt-3 rounded-lg border border-teal-500/25 bg-teal-500/5 p-3 text-[11px] leading-relaxed text-[var(--app-text)]">
              <p className="font-semibold text-teal-200">So handelst du dieses Signal:</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>
                  <strong>{richtung === 'long' ? 'LONG' : 'SHORT'} Market</strong> eröffnen (~{String(entry)})
                </li>
                <li>
                  <strong>Stop-Loss sofort</strong> auf {String(stop)} setzen (technischer Stop aus ATR)
                </li>
                <li>
                  <strong>Take-Profit</strong> auf {String(target)} setzen
                </li>
                <li>Stop nicht nachziehen · bei Ampel rot sofort schließen</li>
              </ol>
            </div>
          )}

          {!istAktiv && kannTrade && (
            <p className="mt-2 text-[11px] font-medium text-amber-300">
              Noch nicht handeln — Qualitätsfilter nicht erfüllt. Nur Signale mit „Jetzt“-Badge.
            </p>
          )}

          {(entry != null || stop != null || target != null) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] tabular-nums">
              {entry != null && (
                <span className="rounded-lg bg-black/25 px-2 py-1 ring-1 ring-white/5">
                  Entry {String(entry)}
                </span>
              )}
              {stop != null && (
                <span className="rounded-lg bg-rose-500/10 px-2 py-1 text-rose-200 ring-1 ring-rose-500/20">
                  Stop {String(stop)}
                </span>
              )}
              {target != null && (
                <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-200 ring-1 ring-emerald-500/20">
                  Ziel {String(target)}
                </span>
              )}
            </div>
          )}

          {verlauf && verlauf.length >= 2 && (
            <div className="mt-2">
              <ScoreSparkline punkte={verlauf.filter((p) => p.playbook === e.playbook)} />
            </div>
          )}

          <button
            type="button"
            onClick={() => setDetailsOffen((v) => !v)}
            className="mt-3 text-[11px] text-[var(--app-text-muted)] underline-offset-2 hover:underline"
          >
            {detailsOffen ? 'Weniger Details' : 'Gates & Daten anzeigen'}
          </button>

          {detailsOffen && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2 text-[11px] tabular-nums text-[var(--app-text-muted)]">
                {gap != null && <span>Gap {String(gap)}%</span>}
                {rvol != null && <span>RVOL {String(rvol)}×</span>}
                <span>Score {e.score}</span>
              </div>
              {e.gatesPassed.length > 0 && (
                <ul className="space-y-0.5 text-[11px] text-emerald-400/90">
                  {e.gatesPassed.map((g) => (
                    <li key={g}>✓ {g}</li>
                  ))}
                </ul>
              )}
              {e.gatesFailed.length > 0 && (
                <ul className="space-y-0.5 text-[11px] text-red-300/80">
                  {e.gatesFailed.map((g) => (
                    <li key={g}>✗ {g}</li>
                  ))}
                </ul>
              )}
              {szenarioPlan && istPreEvent && (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5 text-[11px] text-[var(--app-text-muted)]">
                  {szenarioPlan.split('\n').map((zeile) => (
                    <p key={zeile}>{zeile}</p>
                  ))}
                </div>
              )}
              {kiMemo != null && typeof kiMemo === 'string' && (
                <p className="text-[11px] italic text-[var(--app-text-muted)]">{kiMemo}</p>
              )}
            </div>
          )}
        </div>

        <MiniPlanungsRing score={planungScoreVal} />
      </div>

      {istAktiv && kannTrade && (
        <button
          type="button"
          disabled={tradeLaden}
          onClick={() => onTrade(e)}
          className="mt-3 w-full rounded-lg bg-teal-500/15 px-3 py-2 text-xs font-medium text-teal-300 ring-1 ring-teal-500/30 hover:bg-teal-500/25 disabled:opacity-50 sm:w-auto"
        >
          {tradeLaden ? 'Speichern …' : 'Im Journal erfassen'}
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
            {t.ausScan && t.signalErfolgPct != null ? ' · Signal ' + t.signalErfolgPct + '%' : ''}
            {t.ausScan ? ' · aus Scan' : ''}
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
  const [tracking, setTracking] = useState<MomentumKatalysatorTracking | null>(null)
  const [signalTracking, setSignalTracking] = useState<MomentumTopSignalTracking | null>(null)
  const [handlung, setHandlung] = useState<MomentumHandlungsempfehlung | null>(null)
  const [scanFilter, setScanFilter] = useState<ScanFilterKey>('top')
  const [exportHinweis, setExportHinweis] = useState<string | null>(null)
  const [kalender, setKalender] = useState<MomentumEarningsKalenderMonat | null>(null)
  const [scoreVerlauf, setScoreVerlauf] = useState<Record<string, MomentumScoreVerlaufPunkt[]>>({})
  const [briefingLaden, setBriefingLaden] = useState(false)
  const [laden, setLaden] = useState(true)
  const [fullSyncLaeuft, setFullSyncLaeuft] = useState(false)
  const [barsSyncLaeuft, setBarsSyncLaeuft] = useState(false)
  const [earningsSyncLaeuft, setEarningsSyncLaeuft] = useState(false)
  const [scanLaeuft, setScanLaeuft] = useState(false)
  const [tradeLaden, setTradeLaden] = useState(false)
  const [hinzufuegenLaden, setHinzufuegenLaden] = useState(false)
  const [syncIsin, setSyncIsin] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [syncLog, setSyncLog] = useState<string[]>([])
  const [letztesBarsSync, setLetztesBarsSync] = useState<MomentumBarsSyncErgebnis | null>(null)
  const [letztesEarningsSync, setLetztesEarningsSync] = useState<MomentumEarningsSyncErgebnis | null>(null)

  const ladeAlles = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const [wlRes, stRes, scanRes, trRes, kalRes, verlRes, trackRes, signalTrackRes] = await Promise.all([
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/watchlist'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/status'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/scan'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/trades'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/kalender'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/verlauf'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/tracking'),
        momentumApiFetch('/api/portfolio-analyse/momentum-trader/signal-tracking'),
      ])
      const wl = await parseMomentumApiJsonOderFehler<{ eintraege: MomentumWatchlistEintragAngereichert[] }>(
        wlRes,
        'Watchlist-Fehler',
      )
      setWatchlist(wl.eintraege ?? [])
      const st = await parseMomentumApiJsonOderFehler<
        MomentumDatenStatus & {
          erinnerungen?: MomentumErinnerung[]
          handlungsempfehlung?: MomentumHandlungsempfehlung
        }
      >(stRes, 'Status-Fehler')
      setStatus(st)
      setErinnerungen(st.erinnerungen ?? [])
      setHandlung(st.handlungsempfehlung ?? null)
      const scanData = await parseMomentumApiJsonOptional<MomentumScanPaket>(scanRes)
      if (scanData) setScan(scanData)
      const trData = await parseMomentumApiJsonOderFehler<{
        trades: MomentumTrade[]
        performance?: MomentumPerformance
      }>(trRes, 'Trades-Fehler')
      setTrades(trData.trades ?? [])
      setPerformance(trData.performance ?? null)
      const kalData = await parseMomentumApiJsonOptional<{ kalender: MomentumEarningsKalenderMonat }>(kalRes)
      if (kalData) setKalender(kalData.kalender ?? null)
      const verlData = await parseMomentumApiJsonOptional<{
        verlauf: Record<string, MomentumScoreVerlaufPunkt[]>
      }>(verlRes)
      if (verlData) setScoreVerlauf(verlData.verlauf ?? {})
      const trackData = await parseMomentumApiJsonOptional<{ tracking: MomentumKatalysatorTracking }>(trackRes)
      if (trackData) setTracking(trackData.tracking ?? null)
      const signalData = await parseMomentumApiJsonOptional<{ signalTracking: MomentumTopSignalTracking }>(
        signalTrackRes,
      )
      if (signalData) setSignalTracking(signalData.signalTracking ?? null)
    } catch (e) {
      setFehler(String(e))
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void ladeAlles()
  }, [ladeAlles])

  const nachsyncTicker = useCallback(async (isin: string) => {
    setSyncIsin(isin)
    setFehler(null)
    try {
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/watchlist/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isin }),
      })
      const data = (await res.json()) as {
        eintrag?: MomentumWatchlistEintragAngereichert
        fehler?: string | string[]
        schritte?: string[]
      }
      if (!res.ok) {
        const f = data.fehler
        throw new Error(Array.isArray(f) ? f.join(' · ') : (f ?? 'Nachsync fehlgeschlagen.'))
      }
      if (data.eintrag) {
        setWatchlist((wl) => wl.map((w) => (w.isin === isin ? data.eintrag! : w)))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFehler(msg.replace(/^Error:\s*/i, ''))
    } finally {
      setSyncIsin(null)
    }
  }, [])

  const hinzufuegen = useCallback(
    async (auswahl: MomentumWatchlistAuswahl) => {
      setHinzufuegenLaden(true)
      setFehler(null)
      try {
        const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isin: auswahl.isin,
            name: auswahl.name,
            symbolYahoo: auswahl.symbolYahoo,
            symbolCandidates: auswahl.symbolCandidates,
            ipoDatum: auswahl.ipoDatum,
            notiz: auswahl.notiz,
          }),
        })
        const data = (await res.json()) as { eintraege?: MomentumWatchlistEintragAngereichert[]; fehler?: string }
        if (!res.ok) throw new Error(data.fehler ?? 'Hinzufügen fehlgeschlagen.')
        setWatchlist(data.eintraege ?? [])
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setFehler(msg.replace(/^Error:\s*/i, ''))
      } finally {
        setHinzufuegenLaden(false)
      }
    },
    [],
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
        body: JSON.stringify({ mitKi: false }),
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
        const erfolgPctVal =
          typeof e.indikatoren.erfolgWahrscheinlichkeitPct === 'number'
            ? e.indikatoren.erfolgWahrscheinlichkeitPct
            : null
        const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: e.symbol,
            playbook: e.playbook,
            direction,
            entryDate: e.scanDate,
            entryPrice: e.indikatoren.entryPrice ?? e.indikatoren.open,
            stopPrice: e.indikatoren.stopPrice,
            targetPrice: e.indikatoren.targetPrice,
            riskEur:
              typeof e.indikatoren.verlustAmStopEur === 'number'
                ? e.indikatoren.verlustAmStopEur
                : typeof e.indikatoren.riskEur === 'number'
                  ? e.indikatoren.riskEur
                  : undefined,
            ausScan: true,
            scanDate: e.scanDate,
            signalErfolgPct: erfolgPctVal,
            notizen:
              'Aus Scan ' +
              e.scanDate +
              ', Score ' +
              e.score +
              (erfolgPctVal != null ? ', Erfolg ' + erfolgPctVal + '%' : ''),
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

  const ladeBriefing = useCallback(async () => {
    setBriefingLaden(true)
    try {
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/briefing')
      const data = (await res.json()) as { markdown?: string; fehler?: string }
      if (!res.ok) throw new Error(data.fehler ?? 'Briefing fehlgeschlagen')
      if (data.markdown) {
        await navigator.clipboard.writeText(data.markdown)
        setExportHinweis('Tages-Briefing kopiert')
        setTimeout(() => setExportHinweis(null), 2500)
      }
    } catch (e) {
      setFehler(String(e))
    } finally {
      setBriefingLaden(false)
    }
  }, [])

  const druckeBriefing = useCallback(async () => {
    setBriefingLaden(true)
    try {
      const res = await momentumApiFetch('/api/portfolio-analyse/momentum-trader/briefing')
      const data = (await res.json()) as { markdown?: string; fehler?: string }
      if (!res.ok) throw new Error(data.fehler ?? 'Briefing fehlgeschlagen')
      if (!data.markdown) return
      const w = window.open('', '_blank', 'noopener,noreferrer')
      if (!w) throw new Error('Pop-up blockiert — Druckfenster konnte nicht geöffnet werden.')
      const safe = data.markdown
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      w.document.write(
        '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Momentum Briefing</title>' +
          '<style>body{font-family:system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#111}' +
          'pre{white-space:pre-wrap;font-size:13px;line-height:1.55}@media print{body{margin:1rem}}</style></head>' +
          '<body><pre>' +
          safe +
          '</pre></body></html>',
      )
      w.document.close()
      w.focus()
      window.setTimeout(() => w.print(), 400)
    } catch (e) {
      setFehler(String(e))
    } finally {
      setBriefingLaden(false)
    }
  }, [])

  const exportiereScan = useCallback(() => {
    if (!scan || scan.ergebnisse.length === 0) return
    const lines = [
      '# Momentum Scan ' + scan.scanDate,
      '',
      ...filterScanErgebnisse(scan.ergebnisse, scanFilter).map((e) => {
        const r = e.indikatoren.richtung
        let line =
          '- **' +
          e.symbol +
          '** · ' +
          playbookTitel(e.playbook) +
          ' · Score ' +
          e.score +
          ' · ' +
          e.ampel +
          (r ? ' · ' + String(r) : '') +
          (e.indikatoren.gapPct != null ? ' · Gap ' + e.indikatoren.gapPct + '%' : '') +
          (e.indikatoren.tageBisEarnings != null
            ? ' · in ' + String(e.indikatoren.tageBisEarnings) + ' Tagen'
            : '')
        if (
          (e.playbook === 'earnings_pre_event' || e.playbook === 'earnings_vorlauf') &&
          typeof e.indikatoren.szenarioPlan === 'string'
        ) {
          line += '\n  ' + e.indikatoren.szenarioPlan.split('\n').join('\n  ')
        }
        return line
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

  const preEventMap = useMemo(() => {
    const m = new Map<string, { score: number; stufe: string; tageBis: number | null }>()
    if (!scan) return m
    for (const e of scan.ergebnisse) {
      if (e.playbook !== 'earnings_pre_event' && e.playbook !== 'earnings_vorlauf') continue
      const sym = e.symbol
      const prev = m.get(sym)
      if (!prev || e.score > prev.score) {
        m.set(sym, {
          score: e.score,
          stufe: String(e.indikatoren.vorbereitungStufe ?? ''),
          tageBis:
            e.indikatoren.tageBisEarnings != null ? Number(e.indikatoren.tageBisEarnings) : null,
        })
      }
    }
    return m
  }, [scan])

  return (
    <PortfolioAnalyseShell title="Momentum Trader">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PaSectionTitle
            title="Momentum Trader"
            description="Watchlist → Daten → Regel-Scan → Journal. XTB CFD 5×, Einsatz 50 € Standard."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void ladeBriefing()}
              disabled={briefingLaden || watchlist.length === 0}
              className="rounded-xl bg-[var(--app-surface-muted)] px-4 py-2.5 text-sm font-medium text-[var(--app-text)] ring-1 ring-[var(--app-border)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
            >
              {briefingLaden ? 'Briefing …' : 'Briefing kopieren'}
            </button>
            <button
              type="button"
              onClick={() => void druckeBriefing()}
              disabled={briefingLaden || watchlist.length === 0}
              className="rounded-xl bg-[var(--app-surface-muted)] px-4 py-2.5 text-sm font-medium text-[var(--app-text)] ring-1 ring-[var(--app-border)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
            >
              PDF / Druck
            </button>
            <button
              type="button"
              onClick={() => void starteFullSync()}
              disabled={busy || laden || watchlist.length === 0}
              className="rounded-xl bg-gradient-to-r from-violet-500/20 to-teal-500/20 px-5 py-2.5 text-sm font-semibold text-[var(--app-text)] ring-1 ring-violet-500/30 transition hover:from-violet-500/30 hover:to-teal-500/30 disabled:opacity-50"
            >
              {fullSyncLaeuft ? 'Pipeline läuft …' : 'Alles aktualisieren'}
            </button>
          </div>
        </div>

        {exportHinweis && (
          <p className="text-center text-xs text-teal-300">{exportHinweis}</p>
        )}

        {watchlist.length === 0 && <OnboardingKarte />}

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

        {handlung && watchlist.length > 0 && (
          <HandlungsempfehlungPanel
            empfehlung={handlung}
            onSync={() => void starteFullSync()}
            syncLaeuft={fullSyncLaeuft}
          />
        )}

        <ErinnerungenLeiste items={erinnerungen} />

        <MomentumErinnerungenNotifier erinnerungen={erinnerungen} />
        <MomentumErinnerungenEinstellungen />

        {performance && performance.tradesGesamt > 0 && <PerformancePanel p={performance} />}

        {scan?.playbookStats && scan.playbookStats.stats.length > 0 && (
          <PlaybookBacktestPanel paket={scan.playbookStats} />
        )}

        {tracking && watchlist.length > 0 && <KatalysatorTrackingPanel t={tracking} />}

        {signalTracking && watchlist.length > 0 && <TopSignalTrackingPanel t={signalTracking} />}

        {regime && (
          <PaCard className="p-5">
            <h2 className="text-sm font-semibold text-[var(--app-text)]">Markt-Regime</h2>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">Stand {regime.handelstag}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatKachel label="S&P 500" wert={regime.spyClose?.toLocaleString('de-DE') ?? '—'} />
              <StatKachel
                label="vs. 20-Tage-MA"
                wert={regime.spyAbove20Ma ? 'darüber ↑' : regime.spyAbove20Ma === false ? 'darunter ↓' : '—'}
              />
              <StatKachel
                label="SPY 5T"
                wert={regime.spyReturn5dPct != null ? (regime.spyReturn5dPct >= 0 ? '+' : '') + regime.spyReturn5dPct + '%' : '—'}
              />
              <StatKachel label="VIX" wert={regime.vixClose?.toFixed(2) ?? '—'} />
              <StatKachel label="VIX Δ" wert={regime.vixChangePct != null ? regime.vixChangePct + '%' : '—'} />
            </div>
          </PaCard>
        )}

        {kalender && watchlist.length > 0 && <EarningsKalenderPanel kalender={kalender} />}

        <PaCard className="overflow-visible p-5">
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
            <div className="relative z-30 mt-4 overflow-visible">
              <MomentumWatchlistSucheInput onAuswahl={hinzufuegen} laden={hinzufuegenLaden} fehler={fehler} onFehler={setFehler} />
            </div>
          )}

          {watchlist.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--app-text-muted)]">Titel per Suche hinzufügen — dann „Alles aktualisieren“.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)]">
              {watchlist.map((e) => {
                const sym = e.symbolYahoo ?? e.symbolCandidates[0] ?? ''
                const preEvent = sym ? preEventMap.get(sym.toUpperCase()) ?? null : null
                return (
                <WatchlistZeile
                  key={e.isin}
                  e={e}
                  meta={meta}
                  preEvent={preEvent}
                  onEntfernen={(isin) => void entfernen(isin)}
                  onMetaSpeichern={speichereWatchlistMeta}
                  onNachsyncen={nachsyncTicker}
                  syncLaden={syncIsin === e.isin}
                />
              )})}
            </ul>
          )}
        </PaCard>

        <PaCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text)]">Scan</h2>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                {scan?.scanDate ? 'Stand ' + scan.scanDate : 'Gap-Fade · Momentum · IPO · Pre-Event'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--app-surface-muted)]/50 p-1 ring-1 ring-[var(--app-border)]">
              {(
                [
                  ['top', 'Top-Trades'],
                  ['taeglich', 'Gap/Trend'],
                  ['pattern', 'Pattern'],
                  ['mean_reversion', 'Mean Rev.'],
                  ['regime', 'Regime'],
                  ['katalysator', 'Katalysator'],
                  ['earnings', 'Earnings'],
                  ['ipo', 'IPO'],
                  ['pre_event', 'Earnings (opt.)'],
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
                <ScanKarte
                  key={e.symbol + e.playbook + e.scanDate}
                  e={e}
                  onTrade={tradeAusScan}
                  tradeLaden={tradeLaden}
                  verlauf={scoreVerlauf[e.symbol]}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--app-text-muted)]">
              {scanLaeuft
                ? 'Scan läuft …'
                : scan?.ergebnisse.length
                  ? 'Keine Setups in diesem Filter — „Top-Trades“ oder „Alle“ zeigen die Rangliste.'
                  : 'Kein Scan — oben „Alles aktualisieren“ oder nur „Scan“. Handlungsempfehlung erklärt den nächsten Schritt.'}
            </p>
          )}
        </PaCard>

        <PaCard className="p-5">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Trade-Journal</h2>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">XTB CFD 5× · Einsatz 50 € · Stop/Ziel aus ATR</p>
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

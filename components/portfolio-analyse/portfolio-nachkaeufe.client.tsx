'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EarningsCallAnalyseDarstellung } from '@/components/portfolio-analyse/pa-earnings-call-analyse'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PaSectionTitle, PA_SCROLL_ELEGANT } from '@/components/portfolio-analyse/pa-ui'
import { NACHKAUF_RADAR_WHITELIST, type RisikoKlasse } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { portfolioEmpfehlungVon, type PortfolioEmpfehlungTyp } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-trim-signal'
import type {
  InsiderKauf,
  Kaufhistorie,
  MonatsEmpfehlung,
  NachkaufAmpel,
  NachkaufDeepResearch,
  NachkaufErgebnissePaket,
  NachkaufScanEintrag,
  NachkaufScanPaket,
  ScoreVerlaufPunkt,
  SparplanPosten,
  TrimSignal,
  VerkaufPosten,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

function portfolioEmpfehlungBadge(typ: PortfolioEmpfehlungTyp): { badge: string; label: string } {
  switch (typ) {
    case 'nachkauf':
      return { badge: 'bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/20', label: 'Nachkauf' }
    case 'halten':
      return { badge: 'bg-sky-500/12 text-sky-400 ring-1 ring-sky-500/20', label: 'Halten' }
    case 'beobachten':
      return { badge: 'bg-amber-500/12 text-amber-400 ring-1 ring-amber-500/20', label: 'Beobachten' }
    case 'teilverkauf_erwaegen':
      return { badge: 'bg-orange-500/12 text-orange-300 ring-1 ring-orange-500/25', label: 'Teilverkauf?' }
    case 'verkauf_pruefen':
      return { badge: 'bg-rose-500/12 text-rose-400 ring-1 ring-rose-500/20', label: 'Verkauf prüfen' }
  }
}

function trimAktionLabel(ts: TrimSignal): string {
  if (ts.aktion === 'vollverkauf') return 'Vollverkauf prüfen'
  if (ts.aktion === 'teilverkauf' && ts.verkaufAnteilPct != null) {
    return `Optional ~${ts.verkaufAnteilPct} % reduzieren`
  }
  if (ts.aktion === 'ueberpruefen') return 'Zur Kenntnis / Beobachten'
  return ts.typ === 'trim' ? 'Trim-Hinweis' : 'Beobachten'
}

function trimDringlichkeitFarbe(d: TrimSignal['dringlichkeit']): string {
  if (d === 'hoch') return 'text-rose-300'
  if (d === 'mittel') return 'text-orange-300'
  return 'text-amber-300'
}

function trimKategorieLabel(k: TrimSignal['faktoren'][number]['kategorie']): string {
  const map: Record<string, string> = {
    klumpenrisiko: 'Klumpenrisiko',
    qualitaet: 'Qualität',
    bewertung_hype: 'Hype',
    score_verfall: 'Score-Verfall',
    struktur: 'Struktur',
    insider: 'Insider',
  }
  return map[k] ?? k
}

function risikoKlasseVon(isin: string): RisikoKlasse {
  return NACHKAUF_RADAR_WHITELIST.find((p) => p.isin === isin)?.risikoKlasse ?? 'moderat'
}

// ---------------------------------------------------------------------------
// Ampel-Helfer
// ---------------------------------------------------------------------------

function ampelConfig(ampel: NachkaufAmpel) {
  switch (ampel) {
    case 'gruen':
      return {
        dot: 'bg-emerald-400',
        badge: 'bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/20',
        label: 'Nachkauf',
        cardRing: 'ring-1 ring-emerald-500/20',
        sparkColor: '#34d399',
      }
    case 'gelb':
      return {
        dot: 'bg-amber-400',
        badge: 'bg-amber-500/12 text-amber-400 ring-1 ring-amber-500/20',
        label: 'Beobachten',
        cardRing: 'ring-1 ring-amber-500/20',
        sparkColor: '#fbbf24',
      }
    case 'rot':
      return {
        dot: 'bg-rose-400',
        badge: 'bg-rose-500/12 text-rose-400 ring-1 ring-rose-500/20',
        label: 'Nicht kaufen',
        cardRing: 'ring-1 ring-rose-500/20',
        sparkColor: '#f43f5e',
      }
    case 'teuer':
      return {
        dot: 'bg-sky-400',
        badge: 'bg-sky-500/12 text-sky-400 ring-1 ring-sky-500/20',
        label: 'Zu teuer',
        cardRing: 'ring-1 ring-sky-500/20',
        sparkColor: '#38bdf8',
      }
    default:
      return {
        dot: 'bg-[var(--app-surface-muted)]',
        badge: 'bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] ring-1 ring-white/[0.04]',
        label: 'Keine Daten',
        cardRing: '',
        sparkColor: '#71717a',
      }
  }
}

// ---------------------------------------------------------------------------
// Score-Balken
// ---------------------------------------------------------------------------

function ScoreBar({ score, ampel }: { score: number; ampel: NachkaufAmpel }) {
  const fill = Math.max(0, Math.min(100, score))
  const colorClass =
    ampel === 'gruen'
      ? 'bg-emerald-500'
      : ampel === 'gelb'
        ? 'bg-amber-500'
        : ampel === 'rot'
          ? 'bg-rose-500'
          : ampel === 'teuer'
            ? 'bg-sky-500'
            : 'bg-[var(--app-surface-muted)]'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${fill}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-[var(--app-text-muted)]">{score}/100</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score-Sparkline (SVG, keine externe Library)
// ---------------------------------------------------------------------------

function ScoreSparkline({
  verlauf,
  ampel,
  breite = 80,
  hoehe = 28,
}: {
  verlauf: ScoreVerlaufPunkt[]
  ampel: NachkaufAmpel
  breite?: number
  hoehe?: number
}) {
  const cfg = ampelConfig(ampel)
  if (verlauf.length < 2) {
    return (
      <span className="text-[10px] text-[var(--app-text-muted)] italic">kein Verlauf</span>
    )
  }

  const scores = verlauf.map((v) => v.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1

  const pad = 2
  const w = breite - pad * 2
  const h = hoehe - pad * 2

  const punkte = verlauf.map((v, i) => {
    const x = pad + (i / (verlauf.length - 1)) * w
    const y = pad + h - ((v.score - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const letzterScore = verlauf.at(-1)!.score
  const vorletzterScore = verlauf.at(-2)!.score
  const trend = letzterScore > vorletzterScore ? '↑' : letzterScore < vorletzterScore ? '↓' : '→'
  const trendColor =
    letzterScore > vorletzterScore
      ? 'text-emerald-400'
      : letzterScore < vorletzterScore
        ? 'text-rose-400'
        : 'text-[var(--app-text-muted)]'

  return (
    <div className="flex items-center gap-1.5">
      <svg width={breite} height={hoehe} className="overflow-visible">
        <polyline
          points={punkte.join(' ')}
          fill="none"
          stroke={cfg.sparkColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
        {/* letzter Punkt hervorheben */}
        {(() => {
          const last = punkte.at(-1)!.split(',')
          return (
            <circle
              cx={parseFloat(last[0]!)}
              cy={parseFloat(last[1]!)}
              r={2.5}
              fill={cfg.sparkColor}
              opacity={0.9}
            />
          )
        })()}
      </svg>
      <span className={`text-[10px] font-medium ${trendColor}`}>{trend}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Premium/Discount Badge
// ---------------------------------------------------------------------------

function PremiumDiscountBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const isDiscount = pct < -3
  const isPremium = pct > 3
  const label = `${pct > 0 ? '+' : ''}${pct.toFixed(0)} % vs. Median`
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
        isDiscount
          ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
          : isPremium
            ? 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20'
            : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] ring-1 ring-white/[0.04]'
      }`}
    >
      {isDiscount ? '🏷 ' : isPremium ? '💸 ' : ''}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Kaufzonen-Trigger Badge
// ---------------------------------------------------------------------------

function TriggerBadge({ ausgeloest, text }: { ausgeloest: boolean; text: string | null }) {
  if (!ausgeloest) return null
  return (
    <span
      title={text ?? undefined}
      className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-300 ring-1 ring-yellow-500/25"
    >
      ⚡ Kaufzone
    </span>
  )
}

// ---------------------------------------------------------------------------
// Insider-Käufe Badge (kompakt)
// ---------------------------------------------------------------------------

function InsiderBadge({ kaeufe }: { kaeufe: InsiderKauf[] }) {
  if (kaeufe.length === 0) return null
  const gesamtUsd = kaeufe.reduce((s, k) => s + k.wertUsd, 0)
  const mio = gesamtUsd / 1_000_000
  return (
    <span
      title={`${kaeufe.length} Insider-Käufe (Open Market) der letzten 90 Tage`}
      className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300 ring-1 ring-violet-500/25"
    >
      🏦 Insider {kaeufe.length}× {mio >= 0.1 ? `($${mio.toFixed(1)}M)` : ''}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sparplan-Allokation Tabelle
// ---------------------------------------------------------------------------

function SparplanAllokation({ posten }: { posten: SparplanPosten[] }) {
  if (posten.length === 0) return null
  const gesamt = posten.reduce((s, p) => s + p.betragEur, 0)
  return (
    <div className="mt-3 rounded-xl border border-emerald-500/15 bg-emerald-950/20 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
        Sparplan-Allokation (500 €)
      </p>
      <div className="space-y-1.5">
        {posten.map((p) => (
          <div key={p.ticker} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 rounded-full bg-emerald-500/60"
                style={{ width: `${Math.round((p.betragEur / gesamt) * 72)}px` }}
              />
              <span className="text-[11px] text-[var(--app-text)]">{p.name}</span>
            </div>
            <span className="text-[12px] font-bold tabular-nums text-emerald-300">{p.betragEur} €</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">{posten.map((p) => p.begruendung).join(' · ')}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monatliche Empfehlung Banner
// ---------------------------------------------------------------------------

function MonatsEmpfehlungBanner({ emp }: { emp: MonatsEmpfehlung }) {
  const config =
    emp.typ === 'nachkauf'
      ? {
          bg: 'from-emerald-950/60 to-[var(--app-surface)] border-emerald-500/20',
          icon: '📈',
          titel: 'Nachkauf-Signal',
          textColor: 'text-emerald-300',
        }
      : emp.typ === 'sparen'
        ? {
            bg: 'from-sky-950/60 to-[var(--app-surface)] border-sky-500/20',
            icon: '💰',
            titel: 'Diesen Monat sparen',
            textColor: 'text-sky-300',
          }
        : {
            bg: 'from-amber-950/60 to-[var(--app-surface)] border-amber-500/20',
            icon: '🔍',
            titel: 'Beobachten',
            textColor: 'text-amber-300',
          }

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${config.bg} p-5`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl" role="img" aria-hidden>
          {config.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold tracking-tight ${config.textColor}`}>{config.titel}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]">{emp.text}</p>
          {emp.typ === 'nachkauf' && emp.tickers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {emp.tickers.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-400 ring-1 ring-emerald-500/20"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {emp.typ === 'nachkauf' && emp.sparplanAllokation?.length > 0 && (
            <SparplanAllokation posten={emp.sparplanAllokation} />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Karte pro Titel
// ---------------------------------------------------------------------------

function TitelKarte({
  eintrag,
  aktiv,
  onClick,
  onDeepResearch,
  deepLaden,
}: {
  eintrag: NachkaufScanEintrag
  aktiv: boolean
  onClick: () => void
  onDeepResearch: (e: NachkaufScanEintrag) => void
  deepLaden: boolean
}) {
  const cfg = ampelConfig(eintrag.ampel)
  const portfolio = portfolioEmpfehlungVon(eintrag)
  const portfolioBadge = portfolioEmpfehlungBadge(portfolio.typ)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left transition-all hover:bg-[var(--app-surface-hover)] ${aktiv ? `${cfg.cardRing} bg-[var(--app-surface-hover)]` : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
            <p className="truncate text-sm font-semibold text-[var(--app-text)]">{eintrag.name}</p>
          </div>
          <p className="mt-0.5 pl-4 text-[11px] font-mono text-[var(--app-text-muted)]">{eintrag.ticker}</p>
        </div>
        <div className="shrink-0 text-right space-y-1">
          <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide ${portfolioBadge.badge}`}>
            {portfolio.label}
          </span>
          <span className={`block rounded-md px-2 py-0.5 text-[9px] font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Score + Sparkline */}
      <div className="mt-3 flex items-center justify-between pl-4">
        <ScoreBar score={eintrag.score} ampel={eintrag.ampel} />
        <ScoreSparkline verlauf={eintrag.scoreVerlauf} ampel={eintrag.ampel} />
      </div>

      {/* Badges: Trigger, Insider, Klumpen, Risiko */}
      <div className="mt-2 flex flex-wrap gap-1 pl-4">
        <TriggerBadge ausgeloest={eintrag.kaufTriggerAusgeloest} text={eintrag.kaufTriggerText} />
        <InsiderBadge kaeufe={eintrag.insiderKaeufe} />
        {eintrag.klumpenrisiko && (
          <span className="inline-flex rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300 ring-1 ring-orange-500/20">
            ⚠ Klumpen
          </span>
        )}
        {(() => {
          const rk = risikoKlasseVon(eintrag.isin)
          const cfg =
            rk === 'konservativ'
              ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
              : rk === 'moderat'
                ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
                : 'bg-red-500/10 text-red-400 ring-red-500/20'
          const label =
            rk === 'konservativ' ? 'Konservativ' : rk === 'moderat' ? 'Moderat' : 'Spekulativ'
          const cap =
            rk === 'konservativ' ? '≤ 350 €' : rk === 'moderat' ? '≤ 200 €' : '≤ 100 €'
          return (
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${cfg}`}
              title={`Risikoklasse: ${label} — max. ${cap}/Monat bei der Kaufempfehlung`}
            >
              {label} {cap}
            </span>
          )
        })()}
      </div>

      {/* Kennzahlen */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-4">
        {eintrag.bewertung.fcfYieldPct != null && (
          <span className="text-[11px] text-[var(--app-text-muted)]">
            FCF <span className="text-[var(--app-text)]">{eintrag.bewertung.fcfYieldPct.toFixed(1)} %</span>
          </span>
        )}
        {eintrag.bewertung.forwardPe != null && (
          <span className="text-[11px] text-[var(--app-text-muted)]">
            KGV <span className="text-[var(--app-text)]">{eintrag.bewertung.forwardPe.toFixed(1)}×</span>
          </span>
        )}
        {eintrag.bewertung.premiumDiscountPct != null && (
          <PremiumDiscountBadge pct={eintrag.bewertung.premiumDiscountPct} />
        )}
        {eintrag.depotGewichtPct != null && (
          <span className={`text-[11px] ${eintrag.klumpenrisiko ? 'font-medium text-orange-400' : 'text-[var(--app-text-muted)]'}`}>
            Depot{' '}
            <span className={eintrag.klumpenrisiko ? 'text-orange-300' : 'text-[var(--app-text)]'}>
              {eintrag.depotGewichtPct.toFixed(1)} %
            </span>
          </span>
        )}
      </div>

      {/* KI-Begründung (Vorschau) */}
      {eintrag.kiBegruendung && (
        <p className="mt-2 line-clamp-2 pl-4 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
          {eintrag.kiBegruendung}
        </p>
      )}

      {/* Deep Research Button */}
      <div className="mt-3 flex items-center justify-between pl-4">
        <span className="text-[10px] text-[var(--app-text-muted)]">
          {new Date(eintrag.gescannt_am).toLocaleDateString('de-DE')}
        </span>
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation()
            onDeepResearch(eintrag)
          }}
          disabled={deepLaden}
          className="rounded-lg bg-[var(--app-surface-hover)] px-3 py-1.5 text-[11px] font-medium text-[var(--app-text)] ring-1 ring-white/[0.06] transition-all hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] disabled:opacity-50"
        >
          {deepLaden ? 'Analysiert …' : eintrag.tiefenAnalyse ? 'Memo aktualisieren' : 'Deep Research'}
        </button>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Insider-Käufe Detail-Sektion
// ---------------------------------------------------------------------------

function InsiderKaeufeSektion({ kaeufe }: { kaeufe: InsiderKauf[] }) {
  if (kaeufe.length === 0) return null
  return (
    <PaCard className="p-4">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[var(--app-text-muted)]">
        Insider-Käufe · letzte 90 Tage (SEC Form 4)
      </p>
      <div className="space-y-2">
        {kaeufe.slice(0, 8).map((k, i) => (
          <div key={i} className="flex items-start justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--app-text)]">{k.name}</p>
              {k.titel && <p className="text-[11px] text-[var(--app-text-muted)]">{k.titel}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12px] font-semibold text-violet-300">
                +{k.anteile.toLocaleString('de-DE')} Aktien
              </p>
              {k.wertUsd > 0 && (
                <p className="text-[11px] text-[var(--app-text-muted)]">
                  ${(k.wertUsd / 1000).toFixed(0)}k
                </p>
              )}
              <p className="text-[10px] text-[var(--app-text-muted)]">{k.datum}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
        Nur Open-Market-Käufe (Code P) — Optionsausübungen und Grants ausgeschlossen.
      </p>
    </PaCard>
  )
}

// ---------------------------------------------------------------------------
// Score-Verlauf Detail
// ---------------------------------------------------------------------------

function ScoreVerlaufSektion({ verlauf, ampel }: { verlauf: ScoreVerlaufPunkt[]; ampel: NachkaufAmpel }) {
  if (verlauf.length < 2) return null
  return (
    <PaCard className="p-4">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[var(--app-text-muted)]">
        Score-Verlauf ({verlauf.length} Datenpunkte)
      </p>
      <ScoreSparkline verlauf={verlauf} ampel={ampel} breite={280} hoehe={48} />
      <div className="mt-3 flex gap-4">
        <div>
          <p className="text-[11px] text-[var(--app-text-muted)]">Aktuell</p>
          <p className="text-sm font-semibold text-[var(--app-text)]">{verlauf.at(-1)!.score}/100</p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--app-text-muted)]">Min/Max</p>
          <p className="text-sm font-semibold text-[var(--app-text)]">
            {Math.min(...verlauf.map((v) => v.score))} / {Math.max(...verlauf.map((v) => v.score))}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--app-text-muted)]">Erster Scan</p>
          <p className="text-sm font-semibold text-[var(--app-text)]">
            {new Date(verlauf[0]!.datum).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    </PaCard>
  )
}

// ---------------------------------------------------------------------------
// Kaufhistorie-Sektion
// ---------------------------------------------------------------------------

function KaufhistorieSektion({ hist }: { hist: Kaufhistorie }) {
  const letzterKaufTxt = hist.letzterKaufAm
    ? new Date(hist.letzterKaufAm).toLocaleDateString('de-DE')
    : '–'
  const tageText = hist.tageSeitletztemKauf != null
    ? hist.tageSeitletztemKauf === 0
      ? 'heute'
      : `vor ${hist.tageSeitletztemKauf} Tagen`
    : null

  return (
    <PaCard className="p-4">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[var(--app-text-muted)]">
        Kaufhistorie (eigene Buchungen)
      </p>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[11px] text-[var(--app-text-muted)]">Letzter Kauf</p>
          <p className="text-sm font-semibold text-[var(--app-text)]">{letzterKaufTxt}</p>
          {tageText && <p className="text-[10px] text-[var(--app-text-muted)]">{tageText}</p>}
        </div>
        <div>
          <p className="text-[11px] text-[var(--app-text-muted)]">Anzahl Käufe</p>
          <p className="text-sm font-semibold text-[var(--app-text)]">{hist.anzahlKaeufe}×</p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--app-text-muted)]">Ø Kaufpreis</p>
          <p className="text-sm font-semibold text-[var(--app-text)]">
            {hist.durchschnittskaufpreisEur != null
              ? `${hist.durchschnittskaufpreisEur.toFixed(2)} €`
              : '–'}
          </p>
        </div>
      </div>
    </PaCard>
  )
}

// ---------------------------------------------------------------------------
// Detail-Panel
// ---------------------------------------------------------------------------

function DetailPanel({
  eintrag,
  onDeepResearch,
  deepLaden,
  onRescan,
  rescanLaeuft,
  onNotizEdit,
}: {
  eintrag: NachkaufScanEintrag
  onDeepResearch: (e: NachkaufScanEintrag) => void
  deepLaden: boolean
  onRescan: (e: NachkaufScanEintrag) => void
  rescanLaeuft: boolean
  onNotizEdit: () => void
}) {
  const cfg = ampelConfig(eintrag.ampel)
  const dr = eintrag.tiefenAnalyse
  const portfolio = portfolioEmpfehlungVon(eintrag)
  const portfolioBadge = portfolioEmpfehlungBadge(portfolio.typ)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
            <h2 className="text-lg font-semibold tracking-tight text-[var(--app-text)]">{eintrag.name}</h2>
          </div>
          <p className="mt-0.5 pl-4 text-sm font-mono text-[var(--app-text-muted)]">
            {eintrag.ticker}
            {eintrag.isin ? ` · ${eintrag.isin}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide ${portfolioBadge.badge}`}>
            {portfolio.label}
          </span>
          <span className={`rounded-md px-2.5 py-1 text-xs font-medium tracking-wide ${cfg.badge}`}>
            {cfg.label}
          </span>
          <TriggerBadge ausgeloest={eintrag.kaufTriggerAusgeloest} text={eintrag.kaufTriggerText} />
          <InsiderBadge kaeufe={eintrag.insiderKaeufe} />
          <button
            type="button"
            onClick={() => onRescan(eintrag)}
            disabled={rescanLaeuft}
            title="Einzelnen Titel neu scannen"
            className="rounded-md bg-[var(--app-surface-hover)] px-2 py-1 text-[11px] text-[var(--app-text-muted)] ring-1 ring-white/[0.05] transition-all hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] disabled:opacity-50"
          >
            {rescanLaeuft ? '↻ Läuft …' : '↻ Rescan'}
          </button>
          <button
            type="button"
            onClick={onNotizEdit}
            title="Notiz bearbeiten"
            className="rounded-md bg-[var(--app-surface-hover)] px-2 py-1 text-[11px] text-[var(--app-text-muted)] ring-1 ring-white/[0.05] transition-all hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
          >
            {eintrag.notiz ? '📝 Notiz' : '+ Notiz'}
          </button>
        </div>
      </div>

      {/* Notiz */}
      {eintrag.notiz && (
        <div className="rounded-xl border border-white/[0.06] bg-[var(--app-surface-muted)]/40 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--app-text-muted)] mb-1">Deine Notiz</p>
          <p className="text-[13px] text-[var(--app-text)] leading-relaxed">{eintrag.notiz}</p>
        </div>
      )}

      {/* Trim-Signal */}
      {eintrag.trimSignal && (
        <div className={`rounded-xl border p-3 ${eintrag.trimSignal.aktion === 'ueberpruefen' ? 'border-amber-500/15 bg-amber-950/15' : eintrag.trimSignal.typ === 'trim' ? 'border-orange-500/20 bg-orange-950/25' : 'border-amber-500/20 bg-amber-950/20'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-[12px] font-semibold ${eintrag.trimSignal.aktion === 'vollverkauf' ? 'text-rose-300' : eintrag.trimSignal.aktion === 'teilverkauf' ? 'text-orange-300' : 'text-amber-300'}`}>
              {eintrag.trimSignal.aktion === 'vollverkauf' ? '🔴' : eintrag.trimSignal.aktion === 'teilverkauf' ? '✂️' : '👁'}{' '}
              {trimAktionLabel(eintrag.trimSignal)}
            </p>
            {eintrag.trimSignal.aktion !== 'ueberpruefen' && (
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-white/10 ${trimDringlichkeitFarbe(eintrag.trimSignal.dringlichkeit)}`}>
                {eintrag.trimSignal.dringlichkeit}
              </span>
            )}
            {eintrag.trimSignal.zielDepotGewichtPct != null && eintrag.trimSignal.aktion === 'teilverkauf' && (
              <span className="text-[10px] text-[var(--app-text-muted)]">
                Ziel: {eintrag.trimSignal.zielDepotGewichtPct.toFixed(1)} % Depot
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--app-text-muted)]">{eintrag.trimSignal.grund}</p>
          <p className="mt-1 text-[11px] italic text-[var(--app-text-muted)]/80">
            {portfolioEmpfehlungVon(eintrag).kurz}
          </p>
          {eintrag.trimSignal.faktoren.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {eintrag.trimSignal.faktoren.map((f, i) => (
                <span
                  key={i}
                  title={f.text}
                  className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] text-[var(--app-text-muted)] ring-1 ring-white/5"
                >
                  {trimKategorieLabel(f.kategorie)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {eintrag.disziplinHinweis && (
        <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-3">
          <p className="text-[12px] font-semibold text-sky-300">🧭 Nachkauf-Disziplin</p>
          <p className="mt-1 text-[12px] text-[var(--app-text-muted)]">{eintrag.disziplinHinweis}</p>
        </div>
      )}

      {/* Kaufzonen-Trigger Detail */}
      {eintrag.kaufTriggerAusgeloest && eintrag.kaufTriggerText && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-950/25 p-3">
          <p className="text-[12px] font-semibold text-yellow-300">⚡ Kaufzonen-Trigger ausgelöst</p>
          <p className="mt-1 text-[12px] text-[var(--app-text-muted)]">{eintrag.kaufTriggerText}</p>
        </div>
      )}

      {/* Kaufhistorie */}
      {eintrag.kaufhistorie && (
        <KaufhistorieSektion hist={eintrag.kaufhistorie} />
      )}

      {/* Score + Kennzahlen */}
      <PaCard className="p-4">
        <div className="mb-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--app-text-muted)]">Gesamt-Score</p>
          <div className="mt-2">
            <ScoreBar score={eintrag.score} ampel={eintrag.ampel} />
          </div>
        </div>

        {/* Score-Zerlegung */}
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[var(--app-text-muted)] ring-1 ring-white/[0.04]">
            Qualität {eintrag.scoreDetail.mantraScore} Pkt.
          </span>
          <span className="rounded bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[var(--app-text-muted)] ring-1 ring-white/[0.04]">
            Bewertung {eintrag.scoreDetail.bewertungsScore} Pkt.
          </span>
          {eintrag.scoreDetail.historischerBewertungsBonus !== 0 && (
            <span
              className={`rounded px-1.5 py-0.5 ring-1 ${
                eintrag.scoreDetail.historischerBewertungsBonus > 0
                  ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 ring-rose-500/20'
              }`}
            >
              Hist. Bonus {eintrag.scoreDetail.historischerBewertungsBonus > 0 ? '+' : ''}
              {eintrag.scoreDetail.historischerBewertungsBonus} Pkt.
            </span>
          )}
          {eintrag.scoreDetail.datenSignaleDelta !== 0 && (
            <span
              className={`rounded px-1.5 py-0.5 ring-1 ${
                eintrag.scoreDetail.datenSignaleDelta > 0
                  ? 'bg-sky-500/10 text-sky-400 ring-sky-500/20'
                  : 'bg-rose-500/10 text-rose-400 ring-rose-500/20'
              }`}
            >
              Dynamik/Struktur {eintrag.scoreDetail.datenSignaleDelta > 0 ? '+' : ''}
              {eintrag.scoreDetail.datenSignaleDelta} Pkt.
            </span>
          )}
          {eintrag.scoreDetail.momentumPunkte > 0 && eintrag.scoreDetail.momentumPunkte !== 6 ? (
            <span className="rounded bg-sky-500/5 px-1.5 py-0.5 text-sky-300/80 ring-1 ring-sky-500/10">
              Momentum {eintrag.scoreDetail.momentumPunkte}
            </span>
          ) : null}
          {eintrag.scoreDetail.strukturPunkte !== 0 ? (
            <span
              className={`rounded px-1.5 py-0.5 ring-1 ${
                eintrag.scoreDetail.strukturPunkte > 0
                  ? 'bg-violet-500/10 text-violet-300 ring-violet-500/20'
                  : 'bg-rose-500/10 text-rose-300 ring-rose-500/20'
              }`}
            >
              Struktur {eintrag.scoreDetail.strukturPunkte > 0 ? '+' : ''}
              {eintrag.scoreDetail.strukturPunkte}
            </span>
          ) : null}
          {eintrag.scoreDetail.drawdownBonus > 0 ? (
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300 ring-1 ring-emerald-500/20">
              Drawdown +{eintrag.scoreDetail.drawdownBonus}
            </span>
          ) : null}
          {eintrag.scoreDetail.insiderPunkte > 0 ? (
            <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-teal-300 ring-1 ring-teal-500/20">
              Insider +{eintrag.scoreDetail.insiderPunkte}
            </span>
          ) : null}
          {(eintrag.scoreDetail.datenVollstaendigkeitPct ?? 0) > 0 ? (
            <span
              className={`rounded px-1.5 py-0.5 ring-1 ${
                (eintrag.scoreDetail.datenVollstaendigkeitPct ?? 0) >= 60
                  ? 'bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] ring-white/[0.04]'
                  : 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
              }`}
            >
              Daten {eintrag.scoreDetail.datenVollstaendigkeitPct} %
            </span>
          ) : null}
          {eintrag.scoreDetail.sellTriggerPenalty !== 0 && (
            <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-400 ring-1 ring-rose-500/20">
              Sell-Trigger {eintrag.scoreDetail.sellTriggerPenalty} Pkt.
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-white/[0.05] pt-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">Mantra-Score</p>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {eintrag.mantraScorePct != null ? `${eintrag.mantraScorePct} %` : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">Mantra-Ampel</p>
            <p
              className={`text-sm font-medium ${
                eintrag.mantraAmpel === 'gruen'
                  ? 'text-emerald-400'
                  : eintrag.mantraAmpel === 'gelb'
                    ? 'text-amber-400'
                    : eintrag.mantraAmpel === 'rot'
                      ? 'text-rose-400'
                      : 'text-[var(--app-text-muted)]'
              }`}
            >
              {eintrag.mantraAmpel ?? '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">Sell-Trigger</p>
            <p className={`text-sm font-medium ${eintrag.sellTriggerOk ? 'text-emerald-400' : 'text-rose-400'}`}>
              {eintrag.sellTriggerOk ? 'OK' : 'Warnung'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">FCF-Rendite</p>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {eintrag.bewertung.fcfYieldPct != null ? `${eintrag.bewertung.fcfYieldPct.toFixed(1)} %` : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">NTM KGV</p>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {eintrag.bewertung.forwardPe != null ? `${eintrag.bewertung.forwardPe.toFixed(1)}×` : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">vs. 5J-Median</p>
            <p
              className={`text-sm font-medium ${
                (eintrag.bewertung.premiumDiscountPct ?? 0) < -3
                  ? 'text-emerald-400'
                  : (eintrag.bewertung.premiumDiscountPct ?? 0) > 3
                    ? 'text-rose-400'
                    : 'text-[var(--app-text-muted)]'
              }`}
            >
              {eintrag.bewertung.premiumDiscountPct != null
                ? `${eintrag.bewertung.premiumDiscountPct > 0 ? '+' : ''}${eintrag.bewertung.premiumDiscountPct.toFixed(0)} %`
                : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">KGV-Median (5J)</p>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {eintrag.bewertung.historischerMedianPe != null
                ? `${eintrag.bewertung.historischerMedianPe.toFixed(1)}×`
                : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">FCF-Yield Median (5J)</p>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {eintrag.bewertung.historischerMedianFcfYield != null
                ? `${eintrag.bewertung.historischerMedianFcfYield.toFixed(1)} %`
                : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">52w-Drawdown</p>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {eintrag.bewertung.drawdown52wPct != null ? `${eintrag.bewertung.drawdown52wPct.toFixed(0)} %` : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">EPS-Beat-Rate</p>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {eintrag.bewertung.epsBeatRatePct != null ? `${eintrag.bewertung.epsBeatRatePct} %` : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">Capital Allocation</p>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {eintrag.bewertung.capitalAllocationScorePct != null
                ? `${eintrag.bewertung.capitalAllocationScorePct}/100`
                : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">Net Debt / EBITDA</p>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {eintrag.bewertung.netDebtEbitda != null
                ? `${eintrag.bewertung.netDebtEbitda.toFixed(1)}×`
                : '–'}
            </p>
          </div>
          {eintrag.datenSignale?.epsBeatRate12Pct != null && (
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">EPS-Beat 12Q</p>
              <p className="text-sm font-medium text-[var(--app-text)]">{eintrag.datenSignale.epsBeatRate12Pct} %</p>
            </div>
          )}
          {eintrag.datenSignale?.epsStreakLaenge != null && eintrag.datenSignale.epsStreakLaenge >= 2 && (
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">EPS-Streak</p>
              <p className="text-sm font-medium text-[var(--app-text)]">
                {eintrag.datenSignale.epsStreakLaenge}× {eintrag.datenSignale.epsStreakArt}
              </p>
            </div>
          )}
          {eintrag.datenSignale?.capexDaRatio != null && (
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">CapEx / D&A</p>
              <p className="text-sm font-medium text-[var(--app-text)]">
                {eintrag.datenSignale.capexDaRatio.toFixed(2)}×
              </p>
            </div>
          )}
          {eintrag.datenSignale?.dividendenCagr5yPct != null && (
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">Div.-CAGR 5J</p>
              <p className="text-sm font-medium text-[var(--app-text)]">
                {eintrag.datenSignale.dividendenCagr5yPct.toFixed(1)} %
              </p>
            </div>
          )}
          {eintrag.datenSignale?.umsatzBeatRate12Pct != null && (
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">Umsatz-Beat 12Q</p>
              <p className="text-sm font-medium text-[var(--app-text)]">{eintrag.datenSignale.umsatzBeatRate12Pct} %</p>
            </div>
          )}
          {eintrag.datenSignale?.nettoCashMio != null && (
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">Netto-Cash (Bilanz)</p>
              <p className="text-sm font-medium text-[var(--app-text)]">
                ${eintrag.datenSignale.nettoCashMio.toLocaleString('de-DE')} Mio.
              </p>
            </div>
          )}
          {eintrag.datenSignale?.goodwillAnteilPct != null && eintrag.datenSignale.goodwillAnteilPct >= 20 && (
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">Goodwill-Anteil</p>
              <p className="text-sm font-medium text-[var(--app-text)]">{eintrag.datenSignale.goodwillAnteilPct.toFixed(0)} %</p>
            </div>
          )}
          {eintrag.datenSignale?.segmentKonzentrationPct != null && (
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">Größtes Segment</p>
              <p className="text-sm font-medium text-[var(--app-text)]">{eintrag.datenSignale.segmentKonzentrationPct.toFixed(0)} %</p>
            </div>
          )}
          {eintrag.datenSignale?.insiderNettoRichtung && eintrag.datenSignale.insiderNettoRichtung !== 'neutral' && (
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">Insider-Netto 90T</p>
              <p
                className={`text-sm font-medium ${
                  eintrag.datenSignale.insiderNettoRichtung === 'kauf' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {eintrag.datenSignale.insiderNettoRichtung === 'kauf' ? 'Netto-Kauf' : 'Netto-Verkauf'}
              </p>
            </div>
          )}
          <div>
            <p className="text-[11px] text-[var(--app-text-muted)]">Depot-Gewicht</p>
            <p className={`text-sm font-medium ${eintrag.klumpenrisiko ? 'text-orange-400' : 'text-[var(--app-text)]'}`}>
              {eintrag.depotGewichtPct != null ? `${eintrag.depotGewichtPct.toFixed(1)} %` : '–'}
            </p>
          </div>
        </div>
      </PaCard>

      {/* Klumpenrisiko-Warnung */}
      {eintrag.klumpenrisiko && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-950/30 p-3">
          <p className="text-[12px] text-orange-300">
            <span className="font-semibold">Klumpenrisiko:</span> Diese Position macht aktuell{' '}
            {eintrag.depotGewichtPct?.toFixed(1)} % deines Depots aus (Marktwert).
            Nachkauf nur sehr selektiv — prüfe ob die Übergewichtung durch besondere Qualität gerechtfertigt ist.
          </p>
        </div>
      )}

      {/* Score-Verlauf */}
      <ScoreVerlaufSektion verlauf={eintrag.scoreVerlauf} ampel={eintrag.ampel} />

      {/* Insider-Käufe */}
      <InsiderKaeufeSektion kaeufe={eintrag.insiderKaeufe} />

      {/* KI-Begründung */}
      {eintrag.kiBegruendung && (
        <PaCard className="p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[var(--app-text-muted)]">
            KI-Einschätzung (Flash)
          </p>
          <p className="text-sm leading-relaxed text-[var(--app-text)]">{eintrag.kiBegruendung}</p>
          <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
            Gescannt: {new Date(eintrag.gescannt_am).toLocaleString('de-DE')}
          </p>
        </PaCard>
      )}

      {/* Deep Research Button */}
      {!dr && (
        <button
          type="button"
          onClick={() => onDeepResearch(eintrag)}
          disabled={deepLaden}
          className="w-full rounded-xl bg-gradient-to-br from-teal-500/15 to-teal-600/10 py-3 text-sm font-medium text-teal-300 ring-1 ring-teal-500/20 transition-all hover:from-teal-500/20 hover:to-teal-600/15 disabled:opacity-50"
        >
          {deepLaden ? 'Deep Research wird erstellt …' : 'Deep Research starten (Gemini Pro)'}
        </button>
      )}

      {/* Deep Research Memo */}
      {dr && (
        <PaCard className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--app-text-muted)]">
              Deep Research · Gemini Pro
            </p>
            <button
              type="button"
              onClick={() => onDeepResearch(eintrag)}
              disabled={deepLaden}
              className="rounded-lg bg-[var(--app-surface-hover)] px-2.5 py-1 text-[10px] font-medium text-[var(--app-text-muted)] ring-1 ring-white/[0.04] hover:text-[var(--app-text)] disabled:opacity-50"
            >
              {deepLaden ? 'Aktualisiert …' : 'Aktualisieren'}
            </button>
          </div>
          <p className="mb-3 text-[10px] text-[var(--app-text-muted)]">
            Erstellt: {new Date(dr.erstellt_am).toLocaleString('de-DE')}
          </p>
          <div className="pr-1">
            <EarningsCallAnalyseDarstellung text={dr.memo} />
          </div>
        </PaCard>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hauptkomponente
// ---------------------------------------------------------------------------

type FilterAmpel = 'alle' | 'gruen' | 'gelb' | 'rot' | 'teuer'
type SortKey = 'score' | 'name' | 'ampel' | 'depot' | 'trigger'

// ---------------------------------------------------------------------------
// Einfacher Markdown-Renderer (bold, italic, headings, lists)
// ---------------------------------------------------------------------------

function KiMdText({ text }: { text: string }) {
  function renderInline(line: string, key: number) {
    // Split by **bold** and *italic* patterns
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={i} className="font-semibold text-[var(--app-text)]">{part.slice(2, -2)}</strong>
          if (part.startsWith('*') && part.endsWith('*'))
            return <em key={i} className="not-italic text-[var(--app-text-muted)]">{part.slice(1, -1)}</em>
          return part
        })}
      </span>
    )
  }

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.startsWith('### ')) {
      elements.push(
        <p key={i} className="mt-4 mb-1 text-[11px] font-bold uppercase tracking-wider text-violet-400">
          {line.slice(4)}
        </p>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <p key={i} className="mt-4 mb-1 text-xs font-bold text-violet-300">{line.slice(3)}</p>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-1.5 py-0.5">
          <span className="mt-0.5 shrink-0 text-violet-500">•</span>
          <span>{renderInline(line.slice(2), i)}</span>
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(<p key={i} className="py-0.5">{renderInline(line, i)}</p>)
    }
    i++
  }
  return <div className="text-xs leading-relaxed text-[var(--app-text)]">{elements}</div>
}

export function NachkaufRadarClient() {
  const [ergebnisse, setErgebnisse] = useState<NachkaufScanEintrag[]>([])
  const [monatsEmpfehlung, setMonatsEmpfehlung] = useState<MonatsEmpfehlung | null>(null)
  const [gescannt_am, setGescannt_am] = useState<string | null>(null)
  const [gesamtAnzahl, setGesamtAnzahl] = useState<number>(32)
  const [ausstehend, setAusstehend] = useState<number>(0)
  const [laden, setLaden] = useState(true)
  const [scanLaeuft, setScanLaeuft] = useState(false)
  const [deepLadenTicker, setDeepLadenTicker] = useState<string | null>(null)
  const [rescanTicker, setRescanTicker] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [filterAmpel, setFilterAmpel] = useState<FilterAmpel>('alle')
  const [filterTrigger, setFilterTrigger] = useState(false)
  const [filterInsider, setFilterInsider] = useState(false)
  const [filterTrim, setFilterTrim] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [notizEdit, setNotizEdit] = useState<{ ticker: string; text: string } | null>(null)
  const [notizSpeichern, setNotizSpeichern] = useState(false)
  const [kaufempfehlungLaeuft, setKaufempfehlungLaeuft] = useState(false)
  const [kaufempfehlungText, setKaufempfehlungText] = useState<string | null>(null)
  const [kaufempfehlungAllokation, setKaufempfehlungAllokation] = useState<SparplanPosten[]>([])
  const [verkaufAllokation, setVerkaufAllokation] = useState<VerkaufPosten[]>([])
  const [kaufBudget, setKaufBudget] = useState<number>(500)
  const scanRef = useRef(false)

  // Gespeicherte Ergebnisse beim Start laden
  useEffect(() => {
    async function init() {
      setLaden(true)
      try {
        const res = await fetch('/api/portfolio-analyse/nachkaeufe/ergebnisse')
        if (res.ok) {
          const paket = (await res.json()) as NachkaufErgebnissePaket
          if (paket.gesamtAnzahl) setGesamtAnzahl(paket.gesamtAnzahl)
          if (paket.ausstehend != null) setAusstehend(paket.ausstehend)
          if (paket.ergebnisse.length > 0) {
            setErgebnisse(paket.ergebnisse)
            setMonatsEmpfehlung(paket.monatsEmpfehlung)
            setGescannt_am(paket.gescannt_am)
            setSelectedTicker(paket.ergebnisse[0]?.ticker ?? null)
          }
        }
        // Gespeicherte Kaufempfehlung für aktuellen Monat laden
        const empRes = await fetch('/api/portfolio-analyse/nachkaeufe/kaufempfehlung')
        if (empRes.ok) {
          const { daten } = await empRes.json()
          if (daten?.ki_text) {
            setKaufempfehlungText(daten.ki_text)
            setKaufempfehlungAllokation(daten.basis_allokation ?? [])
            setVerkaufAllokation(daten.verkauf_allokation ?? [])
          }
        }
      } catch {
        // ignorieren — leerer Zustand wird angezeigt
      } finally {
        setLaden(false)
      }
    }
    void init()
  }, [])

  async function starteKaufempfehlung() {
    setKaufempfehlungLaeuft(true)
    setKaufempfehlungText(null)
    setVerkaufAllokation([])
    try {
      const res = await fetch('/api/portfolio-analyse/nachkaeufe/kaufempfehlung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget: kaufBudget }),
      })
      const daten = await res.json()
      if (!res.ok || !daten.ok) {
        setKaufempfehlungText(`Fehler: ${daten.fehler ?? 'Unbekannter Fehler'}`)
        return
      }
      setKaufempfehlungText(daten.kiEmpfehlungText)
      setKaufempfehlungAllokation(daten.basisAllokation ?? [])
      setVerkaufAllokation(daten.basisVerkaufAllokation ?? [])
    } catch (e) {
      setKaufempfehlungText(`Fehler: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setKaufempfehlungLaeuft(false)
    }
  }

  // Scan starten
  const starteNeuenScan = useCallback(async (erzwingen = true) => {
    if (scanRef.current) return
    scanRef.current = true
    setScanLaeuft(true)
    setFehler(null)
    try {
      const res = await fetch('/api/portfolio-analyse/nachkaeufe/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erzwingen }),
      })
      if (!res.ok && res.status !== 502) {
        const text = await res.text().catch(() => `HTTP ${res.status}`)
        throw new Error(`Scan-API Fehler ${res.status}: ${text.slice(0, 200)}`)
      }
      const paket = (await res.json()) as NachkaufScanPaket
      if (paket.ok && paket.ergebnisse.length > 0) {
        setErgebnisse(paket.ergebnisse)
        setMonatsEmpfehlung(paket.monatsEmpfehlung)
        setGescannt_am(paket.gescannt_am)
        setGesamtAnzahl(paket.gesamtAnzahl ?? 32)
        setAusstehend(paket.ausstehend ?? 0)
        setSelectedTicker(paket.ergebnisse[0]?.ticker ?? null)
      } else if (!paket.ok) {
        setFehler(paket.fehler ?? 'Scan fehlgeschlagen.')
      }
    } catch (e) {
      setFehler(String(e))
    } finally {
      setScanLaeuft(false)
      scanRef.current = false
    }
  }, [])

  // Deep Research
  const starteDeepResearch = useCallback(async (eintrag: NachkaufScanEintrag) => {
    if (deepLadenTicker) return
    setDeepLadenTicker(eintrag.ticker)
    try {
      const res = await fetch('/api/portfolio-analyse/nachkaeufe/deep-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: eintrag.ticker, isin: eintrag.isin, name: eintrag.name }),
      })
      const data = (await res.json()) as { ok: boolean; dr?: NachkaufDeepResearch; fehler?: string }
      if (data.ok && data.dr) {
        setErgebnisse((prev) =>
          prev.map((e) =>
            e.ticker === eintrag.ticker ? { ...e, tiefenAnalyse: data.dr! } : e,
          ),
        )
      } else {
        setFehler(data.fehler ?? 'Deep Research fehlgeschlagen.')
      }
    } catch (e) {
      setFehler(String(e))
    } finally {
      setDeepLadenTicker(null)
    }
  }, [deepLadenTicker])

  // Einzel-Rescan
  const starteRescan = useCallback(async (eintrag: NachkaufScanEintrag) => {
    if (rescanTicker) return
    setRescanTicker(eintrag.isin)
    setFehler(null)
    try {
      const res = await fetch('/api/portfolio-analyse/nachkaeufe/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isin: eintrag.isin }),
      })
      if (res.ok) {
        // Ergebnisse neu laden
        const fresh = await fetch('/api/portfolio-analyse/nachkaeufe/ergebnisse')
        if (fresh.ok) {
          const paket = (await fresh.json()) as NachkaufErgebnissePaket
          if (paket.ergebnisse.length > 0) {
            setErgebnisse(paket.ergebnisse)
            setMonatsEmpfehlung(paket.monatsEmpfehlung)
          }
        }
      } else {
        const d = await res.json() as { fehler?: string }
        setFehler(d.fehler ?? 'Rescan fehlgeschlagen.')
      }
    } catch (e) {
      setFehler(String(e))
    } finally {
      setRescanTicker(null)
    }
  }, [rescanTicker])

  // Notiz speichern
  const speichereNotiz = useCallback(async (ticker: string, notiz: string) => {
    setNotizSpeichern(true)
    try {
      await fetch('/api/portfolio-analyse/nachkaeufe/notiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, notiz }),
      })
      setErgebnisse((prev) => prev.map((e) => e.ticker === ticker ? { ...e, notiz } : e))
      setNotizEdit(null)
    } finally {
      setNotizSpeichern(false)
    }
  }, [])

  // Filter + Sort
  const gefilterteSortiert = (() => {
    let liste = ergebnisse
    if (filterAmpel !== 'alle') liste = liste.filter((e) => e.ampel === filterAmpel)
    if (filterTrigger) liste = liste.filter((e) => e.kaufTriggerAusgeloest)
    if (filterInsider) liste = liste.filter((e) => e.insiderKaeufe.length > 0)
    if (filterTrim) liste = liste.filter((e) => !!e.trimSignal)
    switch (sortKey) {
      case 'name': return [...liste].sort((a, b) => a.name.localeCompare(b.name))
      case 'ampel': {
        const ord: Record<NachkaufAmpel, number> = { gruen: 0, gelb: 1, gelb2: 2, teuer: 3, rot: 4, grau: 5 } as unknown as Record<NachkaufAmpel, number>
        return [...liste].sort((a, b) => (ord[a.ampel] ?? 9) - (ord[b.ampel] ?? 9))
      }
      case 'depot': return [...liste].sort((a, b) => (b.depotGewichtPct ?? 0) - (a.depotGewichtPct ?? 0))
      case 'trigger': return [...liste].sort((a, b) => Number(b.kaufTriggerAusgeloest) - Number(a.kaufTriggerAusgeloest) || b.score - a.score)
      default: return [...liste].sort((a, b) => b.score - a.score)
    }
  })()

  const selected = ergebnisse.find((e) => e.ticker === selectedTicker) ?? null

  // Statistiken
  const gruen = ergebnisse.filter((e) => e.ampel === 'gruen').length
  const trigger = ergebnisse.filter((e) => e.kaufTriggerAusgeloest).length
  const mitInsider = ergebnisse.filter((e) => e.insiderKaeufe.length > 0).length
  const mitTrim = ergebnisse.filter((e) => !!e.trimSignal).length

  // Sektor-Konzentration (aggregiert aus depotGewichtPct wenn vorhanden)
  const sektorGewichte = (() => {
    const map = new Map<string, number>()
    for (const e of ergebnisse) {
      if (e.depotGewichtPct != null) {
        // Sektor aus dem Namen ableiten — wird serverseitig nicht übermittelt, daher hier nicht verfügbar
        // Wir überspringen — Sektordaten kommen aus der Whitelist (nur serverseitig bekannt)
      }
    }
    return map
  })()

  return (
    <PortfolioAnalyseShell title="Nachkauf-Radar">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PaSectionTitle
            title="Nachkauf-Radar"
            description="Monatliche Priorisierung: Wo neues Kapital hin — und wo Positionen reduziert werden sollten?"
          />
          <div className="flex flex-wrap items-center gap-2">
            {gescannt_am && (
              <span className="text-[11px] text-[var(--app-text-muted)]">
                Letzter Scan: {new Date(gescannt_am).toLocaleDateString('de-DE')}
              </span>
            )}
            {ausstehend > 0 && !scanLaeuft && (
              <button
                type="button"
                onClick={() => starteNeuenScan(false)}
                disabled={scanLaeuft || laden}
                className="rounded-xl bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-300 ring-1 ring-amber-500/25 transition-all hover:bg-amber-500/20 disabled:opacity-50"
              >
                Scan fortsetzen ({ergebnisse.length}/{gesamtAnzahl})
              </button>
            )}
            <button
              type="button"
              onClick={() => starteNeuenScan(true)}
              disabled={scanLaeuft || laden}
              className="rounded-xl bg-teal-500/15 px-4 py-2 text-sm font-medium text-teal-300 ring-1 ring-teal-500/25 transition-all hover:bg-teal-500/20 disabled:opacity-50"
            >
              {scanLaeuft ? 'Scan läuft …' : 'Neuer Scan'}
            </button>
          </div>
        </div>

        {/* Schnell-Stats */}
        {ergebnisse.length > 0 && !scanLaeuft && (
          <div className="flex flex-wrap gap-3">
            {gruen > 0 && (
              <button
                type="button"
                onClick={() => setFilterAmpel(filterAmpel === 'gruen' ? 'alle' : 'gruen')}
                className={`rounded-xl px-3 py-2 ring-1 transition-all ${filterAmpel === 'gruen' ? 'bg-emerald-500/25 ring-emerald-400/40' : 'bg-emerald-500/10 ring-emerald-500/20'}`}
              >
                <p className="text-[10px] text-[var(--app-text-muted)]">Nachkauf-Kandidaten</p>
                <p className="text-lg font-bold text-emerald-400">{gruen}</p>
              </button>
            )}
            {trigger > 0 && (
              <button
                type="button"
                onClick={() => setFilterTrigger(!filterTrigger)}
                className={`rounded-xl px-3 py-2 ring-1 transition-all ${filterTrigger ? 'bg-yellow-500/25 ring-yellow-400/40' : 'bg-yellow-500/10 ring-yellow-500/20'}`}
              >
                <p className="text-[10px] text-[var(--app-text-muted)]">Trigger ausgelöst</p>
                <p className="text-lg font-bold text-yellow-300">{trigger}</p>
              </button>
            )}
            {mitInsider > 0 && (
              <button
                type="button"
                onClick={() => setFilterInsider(!filterInsider)}
                className={`rounded-xl px-3 py-2 ring-1 transition-all ${filterInsider ? 'bg-violet-500/25 ring-violet-400/40' : 'bg-violet-500/10 ring-violet-500/20'}`}
              >
                <p className="text-[10px] text-[var(--app-text-muted)]">Insider-Käufe aktiv</p>
                <p className="text-lg font-bold text-violet-300">{mitInsider}</p>
              </button>
            )}
            {mitTrim > 0 && (
              <button
                type="button"
                onClick={() => setFilterTrim(!filterTrim)}
                className={`rounded-xl px-3 py-2 ring-1 transition-all ${filterTrim ? 'bg-orange-500/25 ring-orange-400/40' : 'bg-orange-500/10 ring-orange-500/20'}`}
              >
                <p className="text-[10px] text-[var(--app-text-muted)]">Hinweis Verkauf/Trim</p>
                <p className="text-lg font-bold text-orange-300">{mitTrim}</p>
              </button>
            )}
          </div>
        )}

        {/* Fehler */}
        {fehler && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/30 p-4 text-sm text-rose-400">
            {fehler}
            <button
              type="button"
              onClick={() => setFehler(null)}
              className="ml-3 text-rose-600 underline hover:text-rose-400"
            >
              Schließen
            </button>
          </div>
        )}

        {/* Scan läuft */}
        {scanLaeuft && (
          <div className="rounded-xl border border-teal-500/20 bg-teal-950/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-teal-300">Scan läuft …</p>
                <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                  Jede Position wird nach Abschluss sofort gespeichert. Falls der Browser-Tab schließt, kannst du mit
                  &ldquo;Scan fortsetzen&rdquo; weitermachen.
                </p>
                {ergebnisse.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all"
                        style={{ width: `${Math.round((ergebnisse.length / gesamtAnzahl) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-[var(--app-text-muted)]">
                      {ergebnisse.length}/{gesamtAnzahl}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lade-Zustand */}
        {laden && !scanLaeuft && (
          <div className="py-12 text-center text-sm text-[var(--app-text-muted)]">
            <div className="mb-3 inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--app-border-strong)] border-t-transparent" />
            <p>Lade gespeicherte Scan-Ergebnisse …</p>
          </div>
        )}

        {/* Erster Start */}
        {!laden && !scanLaeuft && ergebnisse.length === 0 && (
          <PaCard className="p-8 text-center">
            <p className="text-sm text-[var(--app-text-muted)]">
              Noch kein Scan durchgeführt. Klicke auf{' '}
              <span className="font-medium text-teal-400">Neuer Scan</span>, um alle Positionen zu analysieren.
            </p>
            <p className="mt-2 text-xs text-[var(--app-text-muted)]">
              Der Radar berücksichtigt historische Medianwerte, Kaufzonen-Trigger, Insider-Käufe (US) und Klumpenrisiko.
            </p>
          </PaCard>
        )}

        {/* Monatliche Empfehlung */}
        {monatsEmpfehlung && !scanLaeuft && (
          <MonatsEmpfehlungBanner emp={monatsEmpfehlung} />
        )}

        {/* KI-Portfolio-Empfehlung (Kauf + Verkauf) */}
        {ergebnisse.length > 0 && !scanLaeuft && (
          <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/50 to-[var(--app-surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-xl" role="img" aria-hidden>🤖</span>
                <div>
                  <p className="text-sm font-semibold text-violet-300">Portfolio-Empfehlung</p>
                  <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                    Nachkauf, Halten, Beobachten oder optional Teilverkauf — langfristig, ohne Übertreibung.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={starteKaufempfehlung}
                disabled={kaufempfehlungLaeuft}
                className="shrink-0 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
              >
                {kaufempfehlungLaeuft ? 'Analysiere…' : kaufempfehlungText ? 'Neu generieren' : 'Empfehlung generieren'}
              </button>
            </div>

            {/* Budget-Eingabe */}
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-violet-500/10 bg-violet-950/20 px-3 py-2">
              <span className="text-[11px] text-[var(--app-text-muted)]">Monatsbudget:</span>
              <div className="flex items-center gap-1">
                {[200, 300, 500, 750, 1000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setKaufBudget(v)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-all ${kaufBudget === v ? 'bg-violet-600 text-white' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                  >
                    {v} €
                  </button>
                ))}
                <input
                  type="number"
                  min={100}
                  max={10000}
                  step={50}
                  value={kaufBudget}
                  onChange={(ev) => {
                    const v = parseInt(ev.target.value, 10)
                    if (!isNaN(v) && v >= 100) setKaufBudget(v)
                  }}
                  className="ml-1 w-20 rounded-md border border-violet-500/20 bg-[var(--app-surface-muted)] px-2 py-0.5 text-[11px] text-[var(--app-text)] focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            {kaufempfehlungLaeuft && (
              <div className="mt-4 flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-violet-400 border-t-transparent" />
                Gemini liest die Deep Research Memos… (30–90 Sek.)
              </div>
            )}

            {kaufempfehlungText && !kaufempfehlungLaeuft && (
              <div className="mt-4 space-y-3">
                {verkaufAllokation.length > 0 && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                      Verkaufs-Hinweise (selten, nur klare Fälle)
                    </p>
                    <div className="space-y-2">
                      {verkaufAllokation.map((p) => (
                        <div key={p.ticker} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[12px] font-semibold text-[var(--app-text)]">{p.name}</span>
                              <span className={`text-[10px] font-medium ${trimDringlichkeitFarbe(p.dringlichkeit)}`}>
                                {p.dringlichkeit}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)] line-clamp-2">{p.begruendung}</p>
                          </div>
                          <span className="shrink-0 text-[13px] font-bold tabular-nums text-rose-300">
                            −{p.verkaufAnteilPct} %
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {kaufempfehlungAllokation.length > 0 && (
                  <div className="rounded-xl border border-violet-500/15 bg-violet-950/20 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-400">
                      Regelbasierte Basis-Allokation
                    </p>
                    <div className="space-y-1.5">
                      {kaufempfehlungAllokation.map((p) => {
                        const gesamt = kaufempfehlungAllokation.reduce((s, x) => s + x.betragEur, 0)
                        return (
                          <div key={p.ticker} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-1.5 rounded-full bg-violet-500/60"
                                style={{ width: `${Math.round((p.betragEur / gesamt) * 72)}px` }}
                              />
                              <span className="text-[11px] text-[var(--app-text)]">{p.name}</span>
                              <span className="text-[10px] text-[var(--app-text-muted)]">{p.begruendung}</span>
                            </div>
                            <span className="text-[12px] font-bold tabular-nums text-violet-300">{p.betragEur} €</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-white/5 bg-[var(--app-surface-muted)] p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-400">
                    KI-Analyse (Halten/Verkauf vor Käufen, dann Budget)
                  </p>
                  <KiMdText text={kaufempfehlungText} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter- und Sort-Leiste */}
        {ergebnisse.length > 0 && !laden && !scanLaeuft && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.05] bg-[var(--app-surface-muted)] px-3 py-2">
            <span className="text-[11px] text-[var(--app-text-muted)]">Filter:</span>
            {(['gruen', 'gelb', 'teuer', 'rot'] as const).map((amp) => {
              const cfg = ampelConfig(amp)
              return (
                <button
                  key={amp}
                  type="button"
                  onClick={() => setFilterAmpel(filterAmpel === amp ? 'alle' : amp)}
                  className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${filterAmpel === amp ? cfg.badge + ' opacity-100' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                >
                  {cfg.label}
                </button>
              )
            })}
            <span className="ml-auto text-[11px] text-[var(--app-text-muted)]">Sort:</span>
            {([['score', 'Score'], ['name', 'A–Z'], ['depot', 'Depot %'], ['trigger', 'Trigger'], ['ampel', 'Ampel']] as [SortKey, string][]).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSortKey(k)}
                className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${sortKey === k ? 'text-[var(--app-text)] bg-[var(--app-surface-muted)]' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
              >
                {label}
              </button>
            ))}
            {(filterAmpel !== 'alle' || filterTrigger || filterInsider || filterTrim) && (
              <button
                type="button"
                onClick={() => { setFilterAmpel('alle'); setFilterTrigger(false); setFilterInsider(false); setFilterTrim(false) }}
                className="ml-1 text-[11px] text-rose-500 hover:text-rose-400"
              >
                ✕ Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {/* Haupt-Layout */}
        {ergebnisse.length > 0 && !laden && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr]">
            {/* Titel-Liste */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--app-text-muted)]">
                {gefilterteSortiert.length} von {ergebnisse.length} Positionen
                {ausstehend > 0 && (
                  <span className="ml-1.5 text-amber-500/80">({ausstehend} noch ausstehend)</span>
                )}
              </p>
              <div className="space-y-2">
                {gefilterteSortiert.map((e) => (
                  <TitelKarte
                    key={e.ticker}
                    eintrag={e}
                    aktiv={selectedTicker === e.ticker}
                    onClick={() => setSelectedTicker(e.ticker)}
                    onDeepResearch={starteDeepResearch}
                    deepLaden={deepLadenTicker === e.ticker}
                  />
                ))}
              </div>
              {gefilterteSortiert.length === 0 && (
                <p className="py-6 text-center text-sm text-[var(--app-text-muted)]">Keine Positionen für diesen Filter.</p>
              )}
            </div>

            {/* Detail-Panel */}
            <div>
              {selected ? (
                <DetailPanel
                  eintrag={selected}
                  onDeepResearch={starteDeepResearch}
                  deepLaden={deepLadenTicker === selected.ticker}
                  onRescan={starteRescan}
                  rescanLaeuft={rescanTicker === selected.isin}
                  onNotizEdit={() => setNotizEdit({ ticker: selected.ticker, text: selected.notiz ?? '' })}
                />
              ) : (
                <PaCard className="p-8 text-center text-sm text-[var(--app-text-muted)]">
                  Titel auswählen für Details
                </PaCard>
              )}
            </div>
          </div>
        )}

        {/* Notiz-Modal */}
        {notizEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-[var(--app-surface-muted)] p-6 ring-1 ring-white/[0.08]">
              <h3 className="mb-3 text-sm font-semibold text-[var(--app-text)]">
                Notiz für {notizEdit.ticker}
              </h3>
              <textarea
                className="w-full rounded-lg bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] ring-1 ring-white/[0.06] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-teal-500/50"
                rows={5}
                placeholder="z. B. »Warte auf Q3-Earnings«, »Bereits bei 20× PE nachgekauft«…"
                value={notizEdit.text}
                onChange={(e) => setNotizEdit((prev) => prev ? { ...prev, text: e.target.value } : null)}
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNotizEdit(null)}
                  className="rounded-lg px-3 py-1.5 text-sm text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={notizSpeichern}
                  onClick={() => speichereNotiz(notizEdit.ticker, notizEdit.text)}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-teal-500"
                >
                  {notizSpeichern ? 'Speichert …' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legende */}
        {ergebnisse.length > 0 && (
          <div className="flex flex-wrap gap-3 border-t border-white/[0.04] pt-4">
            {(
              [
                ['gruen', 'Nachkauf', 'bg-emerald-400'],
                ['gelb', 'Beobachten', 'bg-amber-400'],
                ['teuer', 'Zu teuer', 'bg-sky-400'],
                ['rot', 'Nicht kaufen', 'bg-rose-400'],
                ['grau', 'Keine Daten', 'bg-[var(--app-surface-muted)]'],
              ] as const
            ).map(([, label, dot]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${dot}`} />
                <span className="text-[11px] text-[var(--app-text-muted)]">{label}</span>
              </div>
            ))}
            <p className="ml-auto text-[11px] text-[var(--app-text-muted)]">
              Score: Qualität (60) + Bewertung (40) ± Hist. Bonus (10) − Sell-Trigger
            </p>
          </div>
        )}
      </div>
    </PortfolioAnalyseShell>
  )
}

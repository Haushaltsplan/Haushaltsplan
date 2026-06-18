'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EarningsCallAnalyseDarstellung } from '@/components/portfolio-analyse/pa-earnings-call-analyse'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PaSectionTitle, PA_SCROLL_ELEGANT } from '@/components/portfolio-analyse/pa-ui'
import type {
  MonatsEmpfehlung,
  NachkaufAmpel,
  NachkaufDeepResearch,
  NachkaufErgebnissePaket,
  NachkaufScanEintrag,
  NachkaufScanPaket,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

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
      }
    case 'gelb':
      return {
        dot: 'bg-amber-400',
        badge: 'bg-amber-500/12 text-amber-400 ring-1 ring-amber-500/20',
        label: 'Beobachten',
        cardRing: 'ring-1 ring-amber-500/20',
      }
    case 'rot':
      return {
        dot: 'bg-rose-400',
        badge: 'bg-rose-500/12 text-rose-400 ring-1 ring-rose-500/20',
        label: 'Nicht kaufen',
        cardRing: 'ring-1 ring-rose-500/20',
      }
    case 'teuer':
      return {
        dot: 'bg-sky-400',
        badge: 'bg-sky-500/12 text-sky-400 ring-1 ring-sky-500/20',
        label: 'Zu teuer',
        cardRing: 'ring-1 ring-sky-500/20',
      }
    default:
      return {
        dot: 'bg-zinc-500',
        badge: 'bg-zinc-800/60 text-zinc-400 ring-1 ring-white/[0.04]',
        label: 'Keine Daten',
        cardRing: '',
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
            : 'bg-zinc-600'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${fill}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-zinc-500">{score}/100</span>
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
          bg: 'from-emerald-950/60 to-zinc-950/80 border-emerald-500/20',
          icon: '📈',
          titel: 'Nachkauf-Signal',
          textColor: 'text-emerald-300',
        }
      : emp.typ === 'sparen'
        ? {
            bg: 'from-sky-950/60 to-zinc-950/80 border-sky-500/20',
            icon: '💰',
            titel: 'Diesen Monat sparen',
            textColor: 'text-sky-300',
          }
        : {
            bg: 'from-amber-950/60 to-zinc-950/80 border-amber-500/20',
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
        <div className="min-w-0">
          <p className={`text-sm font-semibold tracking-tight ${config.textColor}`}>{config.titel}</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{emp.text}</p>
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
            <p className="truncate text-sm font-semibold text-zinc-100">{eintrag.name}</p>
          </div>
          <p className="mt-0.5 pl-4 text-[11px] font-mono text-zinc-500">{eintrag.ticker}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      <div className="mt-3 pl-4">
        <ScoreBar score={eintrag.score} ampel={eintrag.ampel} />
      </div>

      {/* Kennzahlen */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pl-4">
        {eintrag.bewertung.fcfYieldPct != null && (
          <span className="text-[11px] text-zinc-500">
            FCF-Rendite{' '}
            <span className="text-zinc-300">{eintrag.bewertung.fcfYieldPct.toFixed(1)} %</span>
          </span>
        )}
        {eintrag.bewertung.forwardPe != null && (
          <span className="text-[11px] text-zinc-500">
            NTM KGV <span className="text-zinc-300">{eintrag.bewertung.forwardPe.toFixed(1)}×</span>
          </span>
        )}
        {eintrag.mantraScorePct != null && (
          <span className="text-[11px] text-zinc-500">
            Mantra <span className="text-zinc-300">{eintrag.mantraScorePct} %</span>
          </span>
        )}
        {eintrag.depotGewichtPct != null && (
          <span className={`text-[11px] ${eintrag.klumpenrisiko ? 'font-medium text-orange-400' : 'text-zinc-500'}`}>
            Depot{' '}
            <span className={eintrag.klumpenrisiko ? 'text-orange-300' : 'text-zinc-300'}>
              {eintrag.depotGewichtPct.toFixed(1)} %
            </span>
            {eintrag.klumpenrisiko && ' ⚠'}
          </span>
        )}
        {!eintrag.sellTriggerOk && (
          <span className="text-[11px] font-medium text-rose-400">Sell-Trigger aktiv</span>
        )}
      </div>

      {/* KI-Begründung (Vorschau) */}
      {eintrag.kiBegruendung && (
        <p className="mt-3 line-clamp-2 pl-4 text-[12px] leading-relaxed text-zinc-500">
          {eintrag.kiBegruendung}
        </p>
      )}

      {/* Deep Research Button */}
      <div className="mt-3 flex items-center justify-between pl-4">
        <span className="text-[10px] text-zinc-600">
          {new Date(eintrag.gescannt_am).toLocaleDateString('de-DE')}
        </span>
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation()
            onDeepResearch(eintrag)
          }}
          disabled={deepLaden}
          className="rounded-lg bg-zinc-800/80 px-3 py-1.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/[0.06] transition-all hover:bg-zinc-700/80 hover:text-zinc-100 disabled:opacity-50"
        >
          {deepLaden ? 'Analysiert …' : eintrag.tiefenAnalyse ? 'Memo aktualisieren' : 'Deep Research'}
        </button>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Detail-Panel
// ---------------------------------------------------------------------------

function DetailPanel({
  eintrag,
  onDeepResearch,
  deepLaden,
}: {
  eintrag: NachkaufScanEintrag
  onDeepResearch: (e: NachkaufScanEintrag) => void
  deepLaden: boolean
}) {
  const cfg = ampelConfig(eintrag.ampel)
  const dr = eintrag.tiefenAnalyse

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
            <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{eintrag.name}</h2>
          </div>
          <p className="mt-0.5 pl-4 text-sm font-mono text-zinc-500">
            {eintrag.ticker}
            {eintrag.isin ? ` · ${eintrag.isin}` : ''}
          </p>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {/* Score + Kennzahlen */}
      <PaCard className="p-4">
        <div className="mb-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">Gesamt-Score</p>
          <div className="mt-2">
            <ScoreBar score={eintrag.score} ampel={eintrag.ampel} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-white/[0.05] pt-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-zinc-500">Mantra-Score</p>
            <p className="text-sm font-medium text-zinc-100">
              {eintrag.mantraScorePct != null ? `${eintrag.mantraScorePct} %` : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Mantra-Ampel</p>
            <p className={`text-sm font-medium ${eintrag.mantraAmpel === 'gruen' ? 'text-emerald-400' : eintrag.mantraAmpel === 'gelb' ? 'text-amber-400' : eintrag.mantraAmpel === 'rot' ? 'text-rose-400' : 'text-zinc-500'}`}>
              {eintrag.mantraAmpel ?? '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Sell-Trigger</p>
            <p className={`text-sm font-medium ${eintrag.sellTriggerOk ? 'text-emerald-400' : 'text-rose-400'}`}>
              {eintrag.sellTriggerOk ? 'OK' : 'Warnung'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">FCF-Rendite</p>
            <p className="text-sm font-medium text-zinc-100">
              {eintrag.bewertung.fcfYieldPct != null ? `${eintrag.bewertung.fcfYieldPct.toFixed(1)} %` : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">NTM KGV</p>
            <p className="text-sm font-medium text-zinc-100">
              {eintrag.bewertung.forwardPe != null ? `${eintrag.bewertung.forwardPe.toFixed(1)}×` : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">52w-Spanne</p>
            <p className="text-sm font-medium text-zinc-100">
              {eintrag.bewertung.drawdown52wPct != null ? `${eintrag.bewertung.drawdown52wPct.toFixed(0)} %` : '–'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Depot-Gewicht</p>
            <p className={`text-sm font-medium ${eintrag.klumpenrisiko ? 'text-orange-400' : 'text-zinc-100'}`}>
              {eintrag.depotGewichtPct != null ? `${eintrag.depotGewichtPct.toFixed(1)} %` : '–'}
            </p>
          </div>
        </div>
      </PaCard>
      {eintrag.klumpenrisiko && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-950/30 p-3">
          <p className="text-[12px] text-orange-300">
            <span className="font-semibold">Klumpenrisiko:</span> Diese Position macht aktuell{' '}
            {eintrag.depotGewichtPct?.toFixed(1)} % deines Depots aus (Marktwert).
            Nachkauf nur sehr selektiv — prüfe ob die Übergewichtung durch besondere Qualität gerechtfertigt ist.
          </p>
        </div>
      )}

      {/* KI-Begründung */}
      {eintrag.kiBegruendung && (
        <PaCard className="p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
            KI-Einschätzung (Flash)
          </p>
          <p className="text-sm leading-relaxed text-zinc-300">{eintrag.kiBegruendung}</p>
          <p className="mt-2 text-[10px] text-zinc-600">
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
            <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
              Deep Research · Gemini Pro
            </p>
            <button
              type="button"
              onClick={() => onDeepResearch(eintrag)}
              disabled={deepLaden}
              className="rounded-lg bg-zinc-800/80 px-2.5 py-1 text-[10px] font-medium text-zinc-400 ring-1 ring-white/[0.04] hover:text-zinc-200 disabled:opacity-50"
            >
              {deepLaden ? 'Aktualisiert …' : 'Aktualisieren'}
            </button>
          </div>
          <p className="mb-3 text-[10px] text-zinc-600">
            Erstellt: {new Date(dr.erstellt_am).toLocaleString('de-DE')}
          </p>
          <div className={`${PA_SCROLL_ELEGANT} max-h-[70vh] pr-1`}>
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

export function NachkaufRadarClient() {
  const [ergebnisse, setErgebnisse] = useState<NachkaufScanEintrag[]>([])
  const [monatsEmpfehlung, setMonatsEmpfehlung] = useState<MonatsEmpfehlung | null>(null)
  const [gescannt_am, setGescannt_am] = useState<string | null>(null)
  const [gesamtAnzahl, setGesamtAnzahl] = useState<number>(32)
  const [ausstehend, setAusstehend] = useState<number>(0)
  const [laden, setLaden] = useState(true)
  const [scanLaeuft, setScanLaeuft] = useState(false)
  const [deepLadenTicker, setDeepLadenTicker] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
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
      } catch {
        // ignorieren — leerer Zustand wird angezeigt
      } finally {
        setLaden(false)
      }
    }
    void init()
  }, [])

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

  const selected = ergebnisse.find((e) => e.ticker === selectedTicker) ?? null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PortfolioAnalyseShell title="Nachkauf-Radar">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PaSectionTitle
            title="Nachkauf-Radar"
            description="Monatliche Priorisierung: Welche Depot-Positionen verdienen neues Kapital — und welche nicht?"
          />
          <div className="flex flex-wrap items-center gap-2">
            {gescannt_am && (
              <span className="text-[11px] text-zinc-600">
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

        {/* Scan läuft — Fortschritts-Hinweis */}
        {scanLaeuft && (
          <div className="rounded-xl border border-teal-500/20 bg-teal-950/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-teal-300">Scan läuft …</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Jede Position wird nach Abschluss sofort gespeichert. Falls der Browser-Tab schließt, kannst du mit
                  &ldquo;Scan fortsetzen&rdquo; weitermachen.
                </p>
                {ergebnisse.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all"
                        style={{ width: `${Math.round((ergebnisse.length / gesamtAnzahl) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-zinc-500">
                      {ergebnisse.length}/{gesamtAnzahl}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lade-Zustand beim Start */}
        {laden && !scanLaeuft && (
          <div className="py-12 text-center text-sm text-zinc-500">
            <div className="mb-3 inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent" />
            <p>Lade gespeicherte Scan-Ergebnisse …</p>
          </div>
        )}

        {/* Kein Depot / erstes Mal */}
        {!laden && !scanLaeuft && ergebnisse.length === 0 && (
          <PaCard className="p-8 text-center">
            <p className="text-sm text-zinc-400">
              Noch kein Scan durchgeführt. Klicke auf{' '}
              <span className="font-medium text-teal-400">Neuer Scan</span>, um alle Aktien-Positionen
              zu analysieren.
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              Voraussetzung: Buchungen unter{' '}
              <a href="/portfolioanalyse/import" className="text-teal-600 underline">
                Import
              </a>{' '}
              eingelesen.
            </p>
          </PaCard>
        )}

        {/* Monatliche Empfehlung */}
        {monatsEmpfehlung && !scanLaeuft && (
          <MonatsEmpfehlungBanner emp={monatsEmpfehlung} />
        )}

        {/* Haupt-Layout: Liste + Detail */}
        {ergebnisse.length > 0 && !laden && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr]">
            {/* Titel-Liste */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
                {ergebnisse.length} von {gesamtAnzahl} Positionen
                {ausstehend > 0 && (
                  <span className="ml-1.5 text-amber-500/80">({ausstehend} ausstehend)</span>
                )}
              </p>
              <div className="space-y-2">
                {ergebnisse.map((e) => (
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
            </div>

            {/* Detail-Panel */}
            <div>
              {selected ? (
                <DetailPanel
                  eintrag={selected}
                  onDeepResearch={starteDeepResearch}
                  deepLaden={deepLadenTicker === selected.ticker}
                />
              ) : (
                <PaCard className="p-8 text-center text-sm text-zinc-500">
                  Titel auswählen für Details
                </PaCard>
              )}
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
                ['grau', 'Keine Daten', 'bg-zinc-500'],
              ] as const
            ).map(([, label, dot]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${dot}`} />
                <span className="text-[11px] text-zinc-500">{label}</span>
              </div>
            ))}
            <p className="ml-auto text-[11px] text-zinc-600">
              Score: Qualität (60 Pkt.) + Bewertung (40 Pkt.) − Sell-Trigger-Abzug
            </p>
          </div>
        )}
      </div>
    </PortfolioAnalyseShell>
  )
}

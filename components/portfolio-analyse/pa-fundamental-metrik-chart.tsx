'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { chartHoverFromClientX, type ChartHoverLayout } from '@/components/portfolio-analyse/chart-hover'
import {
  PaChartAnalyseExpandButton,
  PaChartAnalyseOverlay,
  PaChartAnalyseProvider,
  useChartAnalyseVollbild,
} from '@/components/portfolio-analyse/pa-chart-analyse'
import {
  bereinigeSchaetzungsniveausInZeilen,
  formatFundamentalWert,
  periodenOhneLeereSchaetzungen,
} from '@/lib/portfolio-analyse/fundamentaldaten-format'
import {
  anzahlWerteImZeitraum,
  berechneZeitraumSchnitt,
  bewertungForwardChartPerioden,
  chartPeriodeKurzlabel,
  chartZeitraumLabel,
  einheitSkalaGruppe,
  filterChartPeriodenZeitraum,
  finanzdatenChartPerioden,
  letzteJahreChartPerioden,
  prozentAbweichung,
} from '@/lib/portfolio-analyse/fundamentaldaten-chart-hilfen'
import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

/** Fallback: Hue-Sprünge, keine Helligkeitsrampe derselben Farbe. */
const FARBEN = ['#34d399', '#38bdf8', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf']

/** Pro Kennzahl ein eigener Hue — Serien im selben Panel müssen auf den ersten Blick trennbar sein. */
const METRIK_FARBE: Record<string, string> = {
  ocf: '#38bdf8',
  fcf: '#fbbf24',
  nettogewinn: '#34d399',
  eps: '#e879f9',
  dividenden_gezahlt: '#818cf8',
  umsatz: '#38bdf8',
  bruttogewinn: '#2dd4bf',
  ebit: '#4ade80',
  ebitda: '#a3e635',
  capex: '#fb923c',
  da: '#94a3b8',
  sga: '#f97316',
  rd: '#c084fc',
  sbc: '#e879f9',
  bruttomarge: '#fb7185',
  ebit_marge: '#fbbf24',
  ebitda_marge: '#a78bfa',
  nettomarge: '#34d399',
  kgv: '#34d399',
  ps: '#fbbf24',
  pfcf: '#22d3ee',
  pb: '#fb7185',
  ev_ebitda: '#a78bfa',
  ev_rev: '#fb923c',
  aktienrueckkauf: '#c084fc',
  aktien: '#a1a1aa',
  nettoverschuldung: '#f43f5e',
  gesamtverschuldung: '#fb7185',
  bargeld: '#2dd4bf',
  eigenkapital: '#fbbf24',
  roe: '#34d399',
  roi: '#38bdf8',
  roi_ex_goodwill: '#2dd4bf',
  dso: '#fb923c',
  dio: '#fbbf24',
  dpo: '#a78bfa',
  net_debt_ebitda: '#f43f5e',
}

/** Nur 1–2 „Hüllen“ als Fläche — sonst überlagern sich die Fills zu einem Brei. */
const FLAECHE_SERIEN = new Set(['ocf', 'umsatz'])

export function farbeFuerMetrik(id: string, fallbackIndex = 0): string {
  return METRIK_FARBE[id] ?? FARBEN[fallbackIndex % FARBEN.length]!
}

function serieDarstellung(
  id: string,
  einheit: FundamentalMetrikZeile['einheit'],
  extraFlaecheId?: string | null,
): 'flaeche' | 'linie' | 'balken' {
  if (id === 'dividenden_gezahlt' || id === 'aktienrueckkauf') return 'balken'
  if (FLAECHE_SERIEN.has(id) || id === extraFlaecheId) return 'flaeche'
  if (einheit === 'prozent' || einheit === 'multiple' || einheit === 'ratio' || einheit === 'aktien_mio') {
    return 'linie'
  }
  return 'linie'
}

function linieStrichMuster(id: string, einheit: FundamentalMetrikZeile['einheit']): string | undefined {
  if (einheit === 'prozent') return '6 4'
  if (einheit === 'aktien_mio' || id === 'aktien') return '2 3.5'
  return undefined
}

function zeichnungRang(s: { id: string; darstellung: 'flaeche' | 'linie' | 'balken' }): number {
  const typ = s.darstellung === 'flaeche' ? 0 : s.darstellung === 'linie' ? 1 : 2
  const idBoost: Record<string, number> = {
    ocf: 0,
    umsatz: 0,
    gesamtverschuldung: 0,
    bargeld: 1,
    fcf: 2,
    nettoverschuldung: 2,
    nettogewinn: 3,
    eigenkapital: 3,
    eps: 4,
    aktien: 4,
    dividenden_gezahlt: 5,
    aktienrueckkauf: 5,
  }
  return typ * 10 + (idBoost[s.id] ?? 5)
}

function SerieMark({
  art,
  farbe,
  aktiv,
}: {
  art: 'flaeche' | 'linie' | 'balken'
  farbe: string
  aktiv: boolean
}) {
  const c = aktiv ? farbe : '#52525b'
  if (art === 'balken') {
    return (
      <span className="inline-flex h-3 w-3.5 shrink-0 items-end justify-center gap-px" aria-hidden>
        <span className="h-2 w-[3px] rounded-[1px]" style={{ background: c }} />
        <span className="h-2.5 w-[3px] rounded-[1px]" style={{ background: c }} />
        <span className="h-[7px] w-[3px] rounded-[1px]" style={{ background: c }} />
      </span>
    )
  }
  if (art === 'linie') {
    return (
      <span className="inline-flex h-3 w-4 shrink-0 items-center" aria-hidden>
        <span className="h-[2.5px] w-full rounded-full" style={{ background: c }} />
      </span>
    )
  }
  return (
    <span
      className="inline-block h-2.5 w-4 shrink-0 rounded-sm"
      style={{ background: `linear-gradient(180deg, ${c} 0%, ${c}55 100%)` }}
      aria-hidden
    />
  )
}

/** Cash-Abflüsse (Dividende, Buybacks) liegen in der GuV/CF oft negativ — im Chart Betrag nach oben. */
const CHART_BETRAG_POSITIV = new Set(['dividenden_gezahlt', 'aktienrueckkauf'])

function chartWert(id: string, wert: number): number {
  if (CHART_BETRAG_POSITIV.has(id) && wert < 0) return Math.abs(wert)
  return wert
}
const AKTUELL_FARBE = '#fafafa'
const SCHÄTZUNG_FARBE = '#38bdf8'
const ACHSE_FONT = 13
const LABEL_FONT = 11

const VIEW_W = 1000
const HOEHE = 320
const PAD_LINKS_SINGLE = 58
const PAD_LINKS_DUAL = 58
const PAD_RECHTS_SINGLE = 20
const PAD_RECHTS_DUAL = 58
const PAD_OBEN = 38
const PAD_UNTEN = 48

type ChartPunkt = {
  x: number
  y: number
  label: string
  wert: number
  aktuell?: boolean
  istSchaetzung?: boolean
  slotIdx?: number
}

type YAxisScale = {
  side: 'left' | 'right'
  minY: number
  maxY: number
  span: number
  einheit: FundamentalMetrikZeile['einheit']
  ticks: number[]
  farbe: string
}

type ChartSerie = {
  id: string
  label: string
  farbe: string
  einheit: FundamentalMetrikZeile['einheit']
  yAxis: 0 | 1
  darstellung: 'flaeche' | 'linie' | 'balken'
  strichMuster?: string
  letzterWert: number | null
  historisch: ChartPunkt[]
  schaetzung: ChartPunkt[]
  aktuell: ChartPunkt | null
  schnitt: number | null
  jahreSchnitt: number
  abweichungPct: number | null
  pathHistorisch: string
  pathSchaetzung: string
  areaD: string
}

function punkteEinerSerie(s: ChartSerie): ChartPunkt[] {
  return [...s.historisch, ...s.schaetzung, ...(s.aktuell ? [s.aktuell] : [])]
}

function wertAmSlot(s: ChartSerie | undefined, index: number): number | null {
  if (!s) return null
  const pt = punkteEinerSerie(s).find((p) => p.slotIdx === index)
  return pt != null && Number.isFinite(pt.wert) ? pt.wert : null
}

function hoverIndexAusSvg(
  svg: SVGSVGElement,
  clientX: number,
  padLinks: number,
  padRechts: number,
  pointCount: number,
): { index: number; tooltipLeftPct: number } | null {
  if (pointCount <= 0) return null
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const viewX = new DOMPoint(clientX, 0).matrixTransform(ctm.inverse()).x
  const plotW = VIEW_W - padLinks - padRechts
  if (plotW <= 0) return null
  const rel = Math.min(1, Math.max(0, (viewX - padLinks) / plotW))
  const index = Math.round(rel * Math.max(0, pointCount - 1))
  const dataCenterX = padLinks + (index / Math.max(1, pointCount - 1)) * plotW
  const screenX = new DOMPoint(dataCenterX, 0).matrixTransform(ctm).x
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0) return null
  const tooltipLeftPct = Math.min(98, Math.max(2, ((screenX - rect.left) / rect.width) * 100))
  return { index, tooltipLeftPct }
}

function aktuellerKeyFuerZeile(z: FundamentalMetrikZeile, variant: 'standard' | 'bewertung'): string | null {
  if (variant !== 'bewertung') return null
  if (z.gruppe === 'bewertung_trailing') return FUNDAMENTAL_TTM_KEY
  return FUNDAMENTAL_TTM_KEY
}

function yAusWert(wert: number, min: number, span: number, plotH: number): number {
  return PAD_OBEN + plotH - ((wert - min) / span) * plotH
}

function formatAchse(wert: number, einheit: FundamentalMetrikZeile['einheit']): string {
  if (einheit === 'multiple') return `${wert.toFixed(1)}x`
  if (einheit === 'prozent') return `${wert.toFixed(0)}%`
  if (Math.abs(wert) >= 1000) return `${(wert / 1000).toFixed(1)}k`
  return wert.toFixed(1)
}

function berechneSkala(werte: number[]): { minY: number; maxY: number; span: number; ticks: number[] } {
  if (werte.length === 0) return { minY: 0, maxY: 1, span: 1, ticks: [0, 0.5, 1] }
  const min = Math.min(...werte, 0)
  const max = Math.max(...werte, 1)
  const pad = (max - min) * 0.1 || 1
  const minY = min - pad
  const maxY = max + pad
  const span = maxY - minY || 1
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => minY + span * t)
  return { minY, maxY, span, ticks }
}

function ChartSerieChip({
  label,
  farbe,
  dualAxis,
  yAxis,
  onRemove,
}: {
  label: string
  farbe: string
  dualAxis: boolean
  yAxis: 0 | 1
  onRemove: () => void
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] py-1 pl-2 pr-1 text-[11px] text-[var(--app-text)] transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-hover)]/90"
      title={`${label} aus Chart entfernen`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: farbe }} aria-hidden />
      <span className="truncate">
        {label}
        {dualAxis ? (yAxis === 1 ? ' (rechts)' : ' (links)') : ''}
      </span>
      <span
        className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[13px] leading-none text-[var(--app-text-muted)]"
        aria-hidden
      >
        ×
      </span>
    </button>
  )
}

function SchnittBadge({
  label,
  zeitraum,
  schnitt,
  aktuell,
  abweichungPct,
  jahre,
  einheit,
  onRemove,
}: {
  label: string
  zeitraum: string
  schnitt: number | null
  aktuell: number | null
  abweichungPct: number | null
  jahre: number
  einheit: FundamentalMetrikZeile['einheit']
  onRemove?: () => void
}) {
  if (schnitt == null) return null
  const ueber = abweichungPct != null && abweichungPct > 0
  const unter = abweichungPct != null && abweichungPct < 0
  return (
    <div className="relative rounded-lg border border-white/[0.06] bg-[var(--app-surface-muted)] px-3 py-2 pr-8">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
          title={`${label} aus Chart entfernen`}
          aria-label={`${label} aus Chart entfernen`}
        >
          ×
        </button>
      ) : null}
      <p className="truncate text-[10px] font-medium text-[var(--app-text-muted)]">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[11px] text-[var(--app-text-muted)]">
          Schnitt {zeitraum ? `(${zeitraum})` : ''}{' '}
          <span className="font-semibold text-[var(--app-text)]">{formatFundamentalWert(schnitt, einheit)}</span>
          {jahre > 0 ? <span className="text-[var(--app-text-muted)]"> · {jahre} Werte</span> : null}
        </span>
        {aktuell != null ? (
          <>
            <span className="text-[var(--app-text-muted)]">·</span>
            <span className="text-[11px] text-[var(--app-text-muted)]">
              Aktuell{' '}
              <span className="font-semibold text-[var(--app-text)]">{formatFundamentalWert(aktuell, einheit)}</span>
            </span>
            {abweichungPct != null ? (
              <span
                className={`text-[10px] font-semibold tabular-nums ${
                  ueber ? 'text-rose-400/90' : unter ? 'text-emerald-400/90' : 'text-[var(--app-text-muted)]'
                }`}
              >
                {ueber ? '▲' : unter ? '▼' : '●'}{' '}
                {abweichungPct > 0 ? '+' : ''}
                {abweichungPct.toFixed(0)}% {ueber ? 'über' : unter ? 'unter' : 'am'} Schnitt
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

function ChartZeitraumWahl({
  allePerioden,
  vonIso,
  bisIso,
  onVonChange,
  onBisChange,
  onPreset,
  nurPresets = false,
}: {
  allePerioden: FundamentalPeriode[]
  vonIso: string
  bisIso: string
  onVonChange: (iso: string) => void
  onBisChange: (iso: string) => void
  onPreset: (von: string, bis: string) => void
  nurPresets?: boolean
}) {
  if (allePerioden.length < 2) return null

  const bisOptionen = allePerioden.filter((p) => p.iso >= vonIso)
  const hist = allePerioden.filter((p) => !p.istSchaetzung)
  const letzte10 = letzteJahreChartPerioden(hist, 10)
  const schaetz = allePerioden.filter((p) => p.istSchaetzung)
  const letzte10MitSchaetz = [...letzte10, ...schaetz.filter((s) => !letzte10.some((h) => h.iso === s.iso))]
  const letzte5 = letzteJahreChartPerioden(hist, 5)
  const letzte5MitSchaetz = [...letzte5, ...schaetz.filter((s) => !letzte5.some((h) => h.iso === s.iso))]

  return (
    <div className={`flex flex-wrap items-end gap-3 ${nurPresets ? 'justify-center' : 'mt-3 border-t border-white/[0.04] pt-3'}`}>
      {nurPresets ? null : (
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">Von</span>
          <select
            value={vonIso}
            onChange={(e) => {
              const neu = e.target.value
              onVonChange(neu)
              if (bisIso < neu) onBisChange(neu)
            }}
            className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-xs text-[var(--app-text)] outline-none focus:border-amber-500/50"
          >
            {allePerioden.filter((p) => !p.istSchaetzung).map((p) => (
              <option key={p.iso} value={p.iso}>
                {chartPeriodeKurzlabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">Bis</span>
          <select
            value={bisIso}
            onChange={(e) => onBisChange(e.target.value)}
            className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-xs text-[var(--app-text)] outline-none focus:border-amber-500/50"
          >
            {bisOptionen.map((p) => (
              <option key={p.iso} value={p.iso}>
                {chartPeriodeKurzlabel(p)}
              </option>
            ))}
          </select>
        </label>
      </div>
      )}
      <div className="flex flex-wrap gap-1">
        {[
          { label: '5J', von: letzte5MitSchaetz[0]?.iso, bis: letzte5MitSchaetz[letzte5MitSchaetz.length - 1]?.iso },
          { label: '10J', von: letzte10MitSchaetz[0]?.iso, bis: letzte10MitSchaetz[letzte10MitSchaetz.length - 1]?.iso },
          {
            label: 'Max',
            von: allePerioden.find((p) => !p.istSchaetzung)?.iso,
            bis: allePerioden[allePerioden.length - 1]?.iso,
          },
        ].map((preset) =>
          preset.von && preset.bis ? (
            <button
              key={preset.label}
              type="button"
              onClick={() => onPreset(preset.von!, preset.bis!)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                vonIso === preset.von && bisIso === preset.bis
                  ? 'bg-sky-600/90 text-white'
                  : 'bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {preset.label}
            </button>
          ) : null,
        )}
      </div>
    </div>
  )
}

export function PaFundamentalMetrikChart(props: MetrikChartProps) {
  const inner = <MetrikChartBody {...props} />
  if (!props.analyseSchluessel) return inner
  return (
    <PaChartAnalyseProvider
      schluessel={props.analyseSchluessel}
      titel={props.analyseTitel ?? props.titel ?? 'Kennzahlen'}
    >
      {inner}
    </PaChartAnalyseProvider>
  )
}

type MetrikChartProps = {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  aktivIds: Set<string>
  labelsAnzeigen: boolean
  onClear: () => void
  onToggleSerie: (id: string) => void
  onToggleLabels: () => void
  variant?: 'standard' | 'bewertung'
  eingebettet?: boolean
  werkzeugLeiste?: ReactNode
  titel?: string
  kompakt?: boolean
  chartId?: string
  analyseSchluessel?: string
  analyseTitel?: string
}

function MetrikChartBody({
  perioden,
  zeilen,
  aktivIds,
  labelsAnzeigen,
  onClear,
  onToggleSerie,
  onToggleLabels,
  variant = 'standard',
  eingebettet = false,
  werkzeugLeiste,
  titel,
  kompakt = false,
  chartId,
}: MetrikChartProps) {
  const zeilenClean = useMemo(
    () => bereinigeSchaetzungsniveausInZeilen(perioden, zeilen),
    [perioden, zeilen],
  )
  const alleChartPerioden = useMemo(() => {
    const base =
      variant === 'bewertung' ? bewertungForwardChartPerioden(perioden) : finanzdatenChartPerioden(perioden)
    const aktiv = zeilenClean.filter((z) => aktivIds.has(z.id))
    const check = aktiv.length > 0 ? aktiv : zeilenClean
    return periodenOhneLeereSchaetzungen(base, check)
  }, [perioden, variant, zeilenClean, aktivIds])
  const schaetzIso = useMemo(
    () => new Set(alleChartPerioden.filter((p) => p.istSchaetzung).map((p) => p.iso)),
    [alleChartPerioden],
  )
  const [vonIso, setVonIso] = useState('')
  const [bisIso, setBisIso] = useState('')
  const [chartArt, setChartArt] = useState<'linie' | 'balken'>('linie')
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set())
  const [hover, setHover] = useState<ChartHoverLayout | null>(null)
  const svgWrapRef = useRef<SVGSVGElement>(null)
  const vollbild = useChartAnalyseVollbild()

  const legendKey = [...aktivIds].join(',')
  const legendIds = useMemo(() => (legendKey ? legendKey.split(',') : []), [legendKey])

  useEffect(() => {
    setHiddenIds(new Set())
    setHover(null)
  }, [legendKey])

  const effektivAktiv = useMemo(() => {
    const next = new Set<string>()
    for (const id of legendIds) {
      if (!hiddenIds.has(id)) next.add(id)
    }
    return next
  }, [legendIds, hiddenIds])

  const toggleSerie = useCallback(
    (id: string) => {
      onToggleSerie(id)
      setHiddenIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [onToggleSerie],
  )

  useEffect(() => {
    if (alleChartPerioden.length === 0) {
      setVonIso('')
      setBisIso('')
      return
    }
    const hist = alleChartPerioden.filter((p) => !p.istSchaetzung)
    const letzte10 = letzteJahreChartPerioden(hist, 10)
    const schaetz = alleChartPerioden.filter((p) => p.istSchaetzung)
    setVonIso(letzte10[0]?.iso ?? '')
    setBisIso(schaetz[schaetz.length - 1]?.iso ?? letzte10[letzte10.length - 1]?.iso ?? '')
  }, [alleChartPerioden])

  const gefiltertePerioden = useMemo(() => {
    const basis = filterChartPeriodenZeitraum(alleChartPerioden, vonIso, bisIso)
    const schaetz = alleChartPerioden.filter((p) => p.istSchaetzung && !basis.some((b) => b.iso === p.iso))
    if (schaetz.length > 0) return [...basis.filter((p) => !p.istSchaetzung), ...schaetz]
    return basis
  }, [alleChartPerioden, vonIso, bisIso])

  const zeitraumLabel = useMemo(
    () =>
      chartZeitraumLabel(
        alleChartPerioden.find((p) => p.iso === vonIso),
        alleChartPerioden.find((p) => p.iso === bisIso),
      ),
    [alleChartPerioden, vonIso, bisIso],
  )

  const padLinks = PAD_LINKS_SINGLE
  const plotW = VIEW_W - padLinks - PAD_RECHTS_SINGLE

  const { serien, yAchsen, dualAxis, plotH, xLabels } = useMemo(() => {
    const plotH = HOEHE - PAD_OBEN - PAD_UNTEN
    const ausgewaehlt = zeilenClean.filter((z) => effektivAktiv.has(z.id))
    if (ausgewaehlt.length === 0 || gefiltertePerioden.length === 0) {
      return {
        serien: [] as ChartSerie[],
        yAchsen: [] as YAxisScale[],
        dualAxis: false,
        plotH,
        xLabels: [] as { label: string; istSchaetzung: boolean; x: number }[],
      }
    }

    const einheitZuAchse = new Map<string, 0 | 1>()
    for (const z of ausgewaehlt) {
      const g = einheitSkalaGruppe(z.einheit)
      if (!einheitZuAchse.has(g)) {
        einheitZuAchse.set(g, einheitZuAchse.size < 2 ? (einheitZuAchse.size as 0 | 1) : 0)
      }
    }
    const dualAxis = einheitZuAchse.size > 1
    const padL = dualAxis ? PAD_LINKS_DUAL : padLinks
    const padR = dualAxis ? PAD_RECHTS_DUAL : PAD_RECHTS_SINGLE
    const plotW = VIEW_W - padL - padR

    // Gemeinsame X-Achse: Perioden + optionaler TTM-Slot.
    type AchsenSlot = {
      key: string
      label: string
      istSchaetzung: boolean
      istAktuellSlot: boolean
    }
    const achsenSlots: AchsenSlot[] = gefiltertePerioden.map((p) => ({
      key: p.iso,
      label: p.istSchaetzung ? p.label : chartPeriodeKurzlabel(p),
      istSchaetzung: p.istSchaetzung ?? schaetzIso.has(p.iso),
      istAktuellSlot: false,
    }))
    const hatAktuellWert = ausgewaehlt.some((z) => {
      const k = aktuellerKeyFuerZeile(z, variant)
      const v = k ? z.werte[k] : null
      return v != null && Number.isFinite(v)
    })
    if (variant === 'bewertung' && hatAktuellWert) {
      achsenSlots.push({
        key: '__aktuell_slot__',
        label: 'TTM',
        istSchaetzung: false,
        istAktuellSlot: true,
      })
    }

    const n = Math.max(achsenSlots.length, 1)
    const xFuerIdx = (idx: number) => padL + (plotW * idx) / Math.max(1, n - 1)

    const flaecheKandidaten = ausgewaehlt.filter((z) => {
      if (z.id === 'dividenden_gezahlt' || z.id === 'aktienrueckkauf') return false
      return einheitSkalaGruppe(z.einheit) === 'waehrung_betrag'
    })
    const extraFlaecheId = flaecheKandidaten.length === 1 ? flaecheKandidaten[0]!.id : null

    const roh = ausgewaehlt.map((z, i) => {
      const aktKey = aktuellerKeyFuerZeile(z, variant)
      const achse = einheitZuAchse.get(einheitSkalaGruppe(z.einheit)) ?? 0

      const histWerte = gefiltertePerioden
        .map((p) => ({
          key: p.iso,
          label: p.istSchaetzung ? p.label : chartPeriodeKurzlabel(p),
          wert: z.werte[p.iso] != null && Number.isFinite(z.werte[p.iso]!) ? chartWert(z.id, z.werte[p.iso]!) : z.werte[p.iso],
          istSchaetzung: p.istSchaetzung ?? schaetzIso.has(p.iso),
        }))
        .filter((pt): pt is { key: string; label: string; wert: number; istSchaetzung: boolean } =>
          pt.wert != null && Number.isFinite(pt.wert),
        )

      const aktRoh = aktKey ? z.werte[aktKey] : null
      const aktWert = aktRoh != null && Number.isFinite(aktRoh) ? chartWert(z.id, aktRoh) : null
      const aktuell =
        aktWert != null && Number.isFinite(aktWert)
          ? {
              label: 'TTM',
              wert: aktWert,
              istSchaetzung: false,
            }
          : null

      const schnitt = berechneZeitraumSchnitt(histWerte.filter((p) => !p.istSchaetzung).map((p) => p.wert))
      const jahreSchnitt = anzahlWerteImZeitraum(histWerte.filter((p) => !p.istSchaetzung).map((p) => p.wert))
      const abweichungPct =
        aktuell && schnitt != null ? prozentAbweichung(aktuell.wert, schnitt) : null
      const letzterHist = histWerte.filter((p) => !p.istSchaetzung).at(-1)?.wert ?? histWerte.at(-1)?.wert ?? null

      return {
        id: z.id,
        label: z.label,
        farbe: farbeFuerMetrik(z.id, i),
        einheit: z.einheit,
        yAxis: achse,
        darstellung: serieDarstellung(z.id, z.einheit, extraFlaecheId),
        strichMuster: linieStrichMuster(z.id, z.einheit),
        letzterWert: aktuell?.wert ?? letzterHist,
        histWerte,
        aktuell,
        schnitt,
        jahreSchnitt,
        abweichungPct,
      }
    })

    const achsenRoh: { side: 'left' | 'right'; einheit: FundamentalMetrikZeile['einheit']; werte: number[] }[] = [
      { side: 'left', einheit: roh.find((s) => s.yAxis === 0)?.einheit ?? 'multiple', werte: [] },
    ]
    if (dualAxis) {
      achsenRoh.push({
        side: 'right',
        einheit: roh.find((s) => s.yAxis === 1)?.einheit ?? roh[0]!.einheit,
        werte: [],
      })
    }

    for (const s of roh) {
      const idx = s.yAxis
      const werte = [
        ...s.histWerte.map((p) => p.wert),
        ...(s.aktuell ? [s.aktuell.wert] : []),
        ...(s.schnitt != null ? [s.schnitt] : []),
      ]
      achsenRoh[idx]!.werte.push(...werte)
      if (achsenRoh[idx]!.einheit === 'multiple' && s.einheit !== 'multiple') {
        achsenRoh[idx]!.einheit = s.einheit
      }
    }

    const yAchsen: YAxisScale[] = achsenRoh.map((a, ai) => {
      const { minY, maxY, span, ticks } = berechneSkala(a.werte)
      const achsenFarbe = roh.find((s) => s.yAxis === ai)?.farbe ?? '#a1a1aa'
      return { side: a.side, minY, maxY, span, einheit: a.einheit, ticks, farbe: achsenFarbe }
    })

    const skalaFuer = (axis: 0 | 1) => yAchsen[axis] ?? yAchsen[0]!
    const slotIndex = new Map(achsenSlots.map((s, i) => [s.key, i]))
    const aktuellSlotIdx = achsenSlots.findIndex((s) => s.istAktuellSlot)

    const serien: ChartSerie[] = roh.map((s) => {
      const skala = skalaFuer(s.yAxis)

      const histPts: ChartPunkt[] = []
      const schaetzPts: ChartPunkt[] = []
      for (const p of s.histWerte) {
        const idx = slotIndex.get(p.key)
        if (idx == null) continue
        const pt: ChartPunkt = {
          x: xFuerIdx(idx),
          y: yAusWert(p.wert, skala.minY, skala.span, plotH),
          label: p.label,
          wert: p.wert,
          istSchaetzung: p.istSchaetzung,
          slotIdx: idx,
        }
        if (p.istSchaetzung) schaetzPts.push(pt)
        else histPts.push(pt)
      }

      let aktuellPt: ChartPunkt | null = null
      if (s.aktuell && aktuellSlotIdx >= 0) {
        aktuellPt = {
          x: xFuerIdx(aktuellSlotIdx),
          y: yAusWert(s.aktuell.wert, skala.minY, skala.span, plotH),
          label: s.aktuell.label,
          wert: s.aktuell.wert,
          aktuell: true,
          istSchaetzung: false,
          slotIdx: aktuellSlotIdx,
        }
      } else if (s.aktuell && variant !== 'bewertung') {
        // Standard-Charts: Aktuell-Punkt hinter der letzten Periode
        const idx = gefiltertePerioden.length
        const nStd = gefiltertePerioden.length + 1
        const x = padL + (plotW * idx) / Math.max(1, nStd - 1)
        aktuellPt = {
          x,
          y: yAusWert(s.aktuell.wert, skala.minY, skala.span, plotH),
          label: s.aktuell.label,
          wert: s.aktuell.wert,
          aktuell: true,
          slotIdx: idx,
        }
      }

      const letzterHist = histPts[histPts.length - 1]
      const pathHistorisch = histPts
        .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
        .join(' ')
      const schaetzMitBruecke =
        letzterHist && schaetzPts.length > 0
          ? [
              `M ${letzterHist.x.toFixed(1)} ${letzterHist.y.toFixed(1)}`,
              ...schaetzPts.map((pt) => `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`),
            ].join(' ')
          : schaetzPts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')

      const yNull = yAusWert(0, skala.minY, skala.span, plotH)
      const areaD =
        histPts.length > 0
          ? `${pathHistorisch} L ${histPts[histPts.length - 1]!.x.toFixed(1)} ${yNull.toFixed(1)} L ${histPts[0]!.x.toFixed(1)} ${yNull.toFixed(1)} Z`
          : ''

      return {
        id: s.id,
        label: s.label,
        farbe: s.farbe,
        einheit: s.einheit,
        yAxis: s.yAxis,
        darstellung: s.darstellung,
        strichMuster: s.strichMuster,
        letzterWert: s.letzterWert,
        historisch: histPts,
        schaetzung: schaetzPts,
        aktuell: aktuellPt,
        schnitt: s.schnitt,
        jahreSchnitt: s.jahreSchnitt,
        abweichungPct: s.abweichungPct,
        pathHistorisch,
        pathSchaetzung: schaetzMitBruecke,
        areaD,
      }
    })

    serien.sort((a, b) => zeichnungRang(a) - zeichnungRang(b))

    const xLabels = achsenSlots.map((slot, i) => ({
      label: slot.label,
      istSchaetzung: slot.istSchaetzung,
      x: xFuerIdx(i),
    }))

    return { serien, yAchsen, dualAxis, plotH, xLabels }
  }, [zeilenClean, effektivAktiv, gefiltertePerioden, variant, schaetzIso, padLinks])

  const effektivePlotW = VIEW_W - (dualAxis ? PAD_LINKS_DUAL : padLinks) - (dualAxis ? PAD_RECHTS_DUAL : PAD_RECHTS_SINGLE)
  const padLHover = dualAxis ? PAD_LINKS_DUAL : padLinks
  const padRHover = dualAxis ? PAD_RECHTS_DUAL : PAD_RECHTS_SINGLE
  const analysePlot = {
    viewW: VIEW_W,
    viewH: HOEHE,
    padL: padLHover,
    padR: padRHover,
    padT: PAD_OBEN,
    padB: PAD_UNTEN,
  }
  const snapPunkte = useMemo(
    () => serien.flatMap((s) => punkteEinerSerie(s).map((p) => ({ x: p.x, y: p.y }))),
    [serien],
  )

  const onChartMove = useCallback(
    (clientX: number) => {
      const el = svgWrapRef.current
      if (!el || xLabels.length === 0) return
      const viaSvg = hoverIndexAusSvg(el, clientX, padLHover, padRHover, xLabels.length)
      if (viaSvg) {
        setHover({
          index: viaSvg.index,
          tooltipLeftPct: viaSvg.tooltipLeftPct,
          dataCenterX: 0,
          scale: 1,
          offsetX: 0,
        })
        return
      }
      setHover(
        chartHoverFromClientX(
          clientX,
          el.getBoundingClientRect(),
          VIEW_W,
          HOEHE,
          padLHover,
          padRHover,
          xLabels.length,
        ),
      )
    },
    [xLabels.length, padLHover, padRHover],
  )

  const hoverSlot = hover != null ? xLabels[hover.index] ?? null : null
  const legendMeta = legendIds.map((id, i) => {
    const z = zeilenClean.find((r) => r.id === id)
    const s = serien.find((x) => x.id === id)
    const hoverWert = hover != null ? wertAmSlot(s, hover.index) : null
    return {
      id,
      label: z?.label ?? s?.label ?? id,
      farbe: farbeFuerMetrik(id, i),
      einheit: z?.einheit ?? s?.einheit ?? ('zahl' as const),
      darstellung: s?.darstellung ?? serieDarstellung(id, z?.einheit ?? 'zahl'),
      anzeigeWert: hover != null ? hoverWert : (s?.letzterWert ?? null),
      schnitt: s?.schnitt ?? null,
      aktiv: !hiddenIds.has(id),
    }
  })

  const hatLegend = legendIds.some((id) => zeilen.some((z) => z.id === id))

  const kastenKlasse = eingebettet
    ? 'bg-transparent'
    : kompakt
      ? 'overflow-hidden border-b border-[var(--app-border)] bg-[var(--app-surface-muted)]'
      : 'overflow-hidden rounded-2xl border border-[var(--app-border)]/70 bg-gradient-to-br from-[var(--app-surface-muted)] via-[var(--app-surface-muted)] to-[var(--app-surface)] shadow-lg shadow-black/20'

  const ankerId = chartId ?? 'fundamental-metrik-chart'

  if (!hatLegend) {
    return (
      <div
        id={ankerId}
        className={
          eingebettet || kompakt
            ? 'px-4 py-8 text-center'
            : 'rounded-2xl border border-dashed border-[var(--app-border)] bg-gradient-to-b from-[var(--app-surface-muted)] to-[var(--app-surface)] px-4 py-12 text-center'
        }
      >
        {werkzeugLeiste}
        {titel ? <p className="mb-2 text-sm font-medium text-[var(--app-text)]">{titel}</p> : null}
        <p className="text-sm text-[var(--app-text-muted)]">Keine Daten für diesen Chart.</p>
      </div>
    )
  }

  if (serien.length === 0 && hiddenIds.size === 0) {
    return (
      <div
        id={ankerId}
        className={eingebettet || kompakt ? 'px-4 py-8 text-center' : 'rounded-2xl border border-[var(--app-border)]/70 bg-[var(--app-surface-muted)] px-4 py-8 text-center'}
      >
        {werkzeugLeiste}
        <p className="text-sm text-[var(--app-text-muted)]">Keine Daten im gewählten Zeitraum.</p>
      </div>
    )
  }

  const x0 = dualAxis ? PAD_LINKS_DUAL : padLinks
  const x1 = VIEW_W - (dualAxis ? PAD_RECHTS_DUAL : PAD_RECHTS_SINGLE)
  const ersterSchaetzIdx = xLabels.findIndex((xl) => xl.istSchaetzung)
  const prognoseX =
    ersterSchaetzIdx < 0
      ? null
      : ersterSchaetzIdx === 0
        ? x0
        : (xLabels[ersterSchaetzIdx - 1]!.x + xLabels[ersterSchaetzIdx]!.x) / 2

  return (
    <div
      id={ankerId}
      className={vollbild ? `${kastenKlasse} flex h-full min-h-0 flex-col`.trim() : kastenKlasse}
    >
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {werkzeugLeiste}
            <div className="flex items-start justify-center gap-1">
              <p className="text-center text-sm font-medium text-[var(--app-text)]">
                {titel ?? (variant === 'bewertung' ? 'Bewertungsverlauf' : 'Historischer Kennzahlenverlauf')}
              </p>
              <PaChartAnalyseExpandButton />
            </div>
            {!kompakt ? (
              <p className="mt-0.5 text-center text-[11px] text-[var(--app-text-muted)]">
                {variant === 'bewertung'
                  ? 'Historie = Trailing · gestrichelt = FY-Schätzung · grauer Bereich = Prognose'
                  : 'Grauer Bereich = Prognose · Fläche = Cashflow/Umsatz · Linien = Gewinn/FCF · Balken = Dividende/Buybacks'}
              </p>
            ) : null}
          </div>
          {kompakt ? null : (
          <div className="flex flex-wrap gap-2">
            {variant === 'standard' ? (
              <div className="flex rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-0.5">
                {(['linie', 'balken'] as const).map((art) => (
                  <button
                    key={art}
                    type="button"
                    onClick={() => setChartArt(art)}
                    className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                      chartArt === art ? 'bg-amber-500/20 text-amber-200' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                    }`}
                  >
                    {art === 'linie' ? 'Linie' : 'Balken'}
                  </button>
                ))}
              </div>
            ) : null}
          <button
            type="button"
            onClick={onToggleLabels}
              className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2.5 py-1 text-[11px] text-[var(--app-text-muted)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]"
          >
              {labelsAnzeigen ? 'Labels aus' : 'Labels an'}
          </button>
          <button
            type="button"
            onClick={onClear}
              className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2.5 py-1 text-[11px] text-[var(--app-text-muted)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]"
          >
              Leeren
          </button>
          </div>
          )}
        </div>

        <div className="mt-2">
          <ChartZeitraumWahl
            allePerioden={alleChartPerioden}
            vonIso={vonIso}
            bisIso={bisIso}
            onVonChange={setVonIso}
            onBisChange={setBisIso}
            nurPresets={kompakt}
            onPreset={(von, bis) => {
              setVonIso(von)
              setBisIso(bis)
            }}
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-[11px]">
          {legendMeta.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSerie(s.id)}
              title={s.aktiv ? `${s.label} ausblenden` : `${s.label} einblenden`}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-[var(--app-surface-hover)] ${
                s.aktiv ? '' : 'opacity-45'
              }`}
            >
              <SerieMark art={s.darstellung} farbe={s.farbe} aktiv={s.aktiv} />
              <span className={s.aktiv ? 'text-[var(--app-text-muted)]' : 'text-[var(--app-text-muted)] line-through'}>
                {s.label}
              </span>
              <span
                className="inline-block min-w-[4.25rem] text-right font-semibold tabular-nums"
                style={{ color: s.aktiv && s.anzeigeWert != null ? s.farbe : undefined }}
              >
                {s.anzeigeWert != null ? formatFundamentalWert(s.anzeigeWert, s.einheit) : '–'}
              </span>
              {s.schnitt != null ? (
                <span className={`tabular-nums text-[var(--app-text-muted)] ${s.aktiv ? '' : 'opacity-45'}`}>
                  Ø {formatFundamentalWert(s.schnitt, s.einheit)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className={vollbild ? 'flex min-h-0 flex-1 flex-col px-2 pb-3 pt-1 sm:px-4' : 'px-2 pb-3 pt-1 sm:px-4'}>
        {serien.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--app-text-muted)]">
            Kennzahl in der Legende anklicken, um sie wieder einzublenden.
          </p>
        ) : (
        <div
          className={vollbild ? 'relative h-full min-h-[280px]' : 'relative aspect-[1000/320]'}
          onMouseMove={(e) => onChartMove(e.clientX)}
          onMouseLeave={() => setHover(null)}
        >
        <svg
          ref={svgWrapRef}
          viewBox={`0 0 ${VIEW_W} ${HOEHE}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full cursor-crosshair select-none"
          role="img"
          aria-label="Kennzahlen-Chart"
        >
          <defs>
            {serien.map((s) => (
              <linearGradient key={`grad-${s.id}`} id={`area-${ankerId}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.farbe} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.farbe} stopOpacity={0.03} />
              </linearGradient>
            ))}
          </defs>
          <rect x={0} y={0} width={VIEW_W} height={HOEHE} fill="transparent" />

          {prognoseX != null ? (
            <g>
              <rect
                x={prognoseX}
                y={PAD_OBEN}
                width={Math.max(0, x1 - prognoseX)}
                height={plotH}
                fill="rgba(148,163,184,0.10)"
              />
              <text
                x={prognoseX + 10}
                y={PAD_OBEN + 16}
                fill="#94a3b8"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                Prognose
              </text>
            </g>
          ) : null}

          {yAchsen.map((achse, ai) =>
            achse.ticks.map((tick, i) => {
              const y = yAusWert(tick, achse.minY, achse.span, plotH)
              return (
                <g key={`${ai}-${i}`}>
                  {ai === 0 ? (
                    <line
                      x1={x0}
                      y1={y}
                      x2={x1}
                      y2={y}
                      stroke="#3f3f46"
                      strokeOpacity={0.4}
                      strokeDasharray={i === 0 ? undefined : '3 5'}
                    />
                  ) : null}
                  <text
                    x={achse.side === 'left' ? x0 - 10 : x1 + 10}
                    y={y + 5}
                    textAnchor={achse.side === 'left' ? 'end' : 'start'}
                    fill={achse.side === 'right' ? achse.farbe : '#a1a1aa'}
                    style={{ fontSize: ACHSE_FONT, fontWeight: 500 }}
                  >
                    {formatAchse(tick, achse.einheit)}
                  </text>
                </g>
              )
            }),
          )}

          {yAchsen[0] && yAchsen[0].minY < 0 && yAchsen[0].maxY > 0 ? (
            <line
              x1={x0}
              y1={yAusWert(0, yAchsen[0].minY, yAchsen[0].span, plotH)}
              x2={x1}
              y2={yAusWert(0, yAchsen[0].minY, yAchsen[0].span, plotH)}
              stroke="#71717a"
              strokeWidth={1}
              strokeOpacity={0.7}
            />
          ) : null}

          <line x1={x0} y1={PAD_OBEN + plotH} x2={x1} y2={PAD_OBEN + plotH} stroke="#52525b" strokeWidth={1.2} />

          {!kompakt && serien.length <= 2
            ? serien.map((s) => {
                const skala = yAchsen[s.yAxis]
                return s.schnitt != null && skala ? (
                  <line
                    key={`avg-${s.id}`}
                    x1={x0}
                    y1={yAusWert(s.schnitt, skala.minY, skala.span, plotH)}
                    x2={x1}
                    y2={yAusWert(s.schnitt, skala.minY, skala.span, plotH)}
                    stroke={s.farbe}
                    strokeWidth={1.2}
                    strokeDasharray="5 5"
                    opacity={0.4}
                  />
                ) : null
              })
            : null}

          {serien.map((s) => {
            const art = chartArt === 'balken' && !kompakt ? 'balken' : s.darstellung
            const barW = Math.max(7, (effektivePlotW / Math.max(s.historisch.length + s.schaetzung.length, 1)) * 0.34)
            const skala = yAchsen[s.yAxis]
            const yNull = skala ? yAusWert(0, skala.minY, skala.span, plotH) : PAD_OBEN + plotH
            const strich = art === 'linie' ? 2.7 : 2.3
            return (
            <g key={s.id}>
              {art === 'flaeche' && s.areaD ? <path d={s.areaD} fill={`url(#area-${ankerId}-${s.id})`} /> : null}
              {art !== 'balken' && s.pathHistorisch ? (
                <>
                  <path
                    d={s.pathHistorisch}
                    fill="none"
                    stroke="#09090b"
                    strokeWidth={strich + 1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                  <path
                    d={s.pathHistorisch}
                    fill="none"
                    stroke={s.farbe}
                    strokeWidth={strich}
                    strokeDasharray={s.strichMuster}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </>
              ) : null}
              {art !== 'balken' && s.pathSchaetzung ? (
                <path
                  d={s.pathSchaetzung}
                  fill="none"
                  stroke={s.farbe}
                  strokeWidth={strich - 0.3}
                  strokeDasharray="6 5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.8}
                />
              ) : null}
              {art === 'balken'
                ? [...s.historisch, ...s.schaetzung].map((pt, i) => {
                    const h = yNull - pt.y
                    return (
                      <rect
                        key={i}
                        x={pt.x - barW / 2}
                        y={h >= 0 ? pt.y : yNull}
                        width={barW}
                        height={Math.abs(h)}
                        fill={s.farbe}
                        stroke="#09090b"
                        strokeWidth={0.7}
                        opacity={pt.istSchaetzung ? 0.5 : 0.95}
                        rx={1.5}
                      />
                    )
                  })
                : null}
              {kompakt || art === 'flaeche' || art === 'balken'
                ? null
                : [...s.historisch, ...s.schaetzung].map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={2.4}
                      fill="#09090b"
                      stroke={s.farbe}
                      strokeWidth={1.5}
                    />
                  ))}
              {s.aktuell ? (
                <>
                  <circle cx={s.aktuell.x} cy={s.aktuell.y} r={7} fill={s.farbe} opacity={0.2} />
                  <circle
                    cx={s.aktuell.x}
                    cy={s.aktuell.y}
                    r={4.5}
                    fill={AKTUELL_FARBE}
                    stroke={s.farbe}
                    strokeWidth={2}
                  />
                </>
              ) : null}
              {labelsAnzeigen
                ? [...s.historisch, ...s.schaetzung, ...(s.aktuell ? [s.aktuell] : [])].map((pt, i) => {
                    // Bei mehreren „aktuell“-Punkten auf derselben X-Position Labels gestaffelt
                    const aktuellOffset =
                      pt.aktuell && serien.filter((x) => x.aktuell).length > 1
                        ? serien.findIndex((x) => x.id === s.id) * 14
                        : 0
                    return (
                    <text
                      key={i}
                      x={pt.x}
                      y={pt.y - 12 - aktuellOffset}
                      textAnchor="middle"
                      fill={pt.aktuell ? AKTUELL_FARBE : pt.istSchaetzung ? SCHÄTZUNG_FARBE : s.farbe}
                      style={{ fontSize: LABEL_FONT, fontWeight: pt.aktuell ? 600 : 400 }}
                    >
                      {formatFundamentalWert(pt.wert, s.einheit)}
                      {pt.aktuell ? ` · ${pt.label}` : pt.istSchaetzung ? ' · Schätz.' : ''}
                  </text>
                    )
                  })
              : null}
            </g>
            )
          })}

          {hoverSlot ? (
            <g pointerEvents="none">
              <line
                x1={hoverSlot.x}
                y1={PAD_OBEN}
                x2={hoverSlot.x}
                y2={PAD_OBEN + plotH}
                stroke="#a1a1aa"
                strokeWidth={1}
                strokeDasharray="4 3"
                strokeOpacity={0.8}
              />
              {serien.map((s) => {
                const pt = [...s.historisch, ...s.schaetzung, ...(s.aktuell ? [s.aktuell] : [])].find(
                  (p) => p.slotIdx === hover?.index,
                )
                if (!pt) return null
                return (
                  <circle
                    key={`h-${s.id}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    fill={s.farbe}
                    stroke="#09090b"
                    strokeWidth={1.4}
                  />
                )
              })}
            </g>
          ) : null}

          {xLabels.map((xl, i) =>
            i % Math.max(1, Math.ceil(xLabels.length / 8)) === 0 || i === xLabels.length - 1 ? (
              <text
                key={i}
                x={xl.x}
                y={HOEHE - 12}
                textAnchor="middle"
                fill={
                  xl.label === 'TTM'
                    ? '#a1a1aa'
                    : xl.istSchaetzung
                      ? SCHÄTZUNG_FARBE
                      : '#71717a'
                }
                style={{
                  fontSize: ACHSE_FONT,
                  fontWeight: xl.label === 'TTM' || xl.istSchaetzung ? 600 : 500,
                }}
              >
                {xl.label}
              </text>
            ) : null,
          )}
      </svg>
        {hover && hoverSlot && serien.length > 0 ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[11rem] max-w-[16rem] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/95 px-2.5 py-2 shadow-lg shadow-black/40 ring-1 ring-white/[0.06]"
            style={{ left: `${hover.tooltipLeftPct}%`, transform: 'translateX(-50%)' }}
          >
            <p className="mb-1 text-[11px] font-semibold text-[var(--app-text)]">
              {hoverSlot.label}
              {hoverSlot.istSchaetzung ? ' · Schätzung' : ''}
            </p>
            <ul className="space-y-0.5">
              {legendMeta
                .filter((s) => s.aktiv)
                .map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="flex min-w-0 items-center gap-1.5 text-[var(--app-text-muted)]">
                      <SerieMark art={s.darstellung} farbe={s.farbe} aktiv />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span
                      className="min-w-[3.5rem] text-right font-semibold tabular-nums"
                      style={{ color: s.anzeigeWert != null ? s.farbe : undefined }}
                    >
                      {s.anzeigeWert != null ? formatFundamentalWert(s.anzeigeWert, s.einheit) : '–'}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        <PaChartAnalyseOverlay
          svgRef={svgWrapRef}
          plot={analysePlot}
          snapPunkte={snapPunkte}
          onChartPointer={(pt) => {
            if (!pt) {
              setHover(null)
              return
            }
            onChartMove(pt.x)
          }}
        />
        </div>
        )}

      {kompakt ? null : (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5 px-1 text-[10px] text-[var(--app-text-muted)]">
          {legendMeta.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggleSerie(s.id)}
                className="flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-[var(--app-surface-hover)]"
                title={s.aktiv ? `${s.label} ausblenden` : `${s.label} einblenden`}
              >
                <SerieMark art={s.darstellung} farbe={s.farbe} aktiv={s.aktiv} />
                <span className={s.aktiv ? 'text-[var(--app-text-muted)]' : 'text-[var(--app-text-muted)]/45 line-through'}>
                  {s.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  )
}

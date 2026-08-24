'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
  jahrAusPeriode,
  letzteNChartPerioden,
  prozentAbweichung,
} from '@/lib/portfolio-analyse/fundamentaldaten-chart-hilfen'
import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const FARBEN = ['#43a047', '#7cb342', '#5c6bc0', '#f9a825', '#26a69a', '#8d6e63']
const METRIK_FARBE: Record<string, string> = {
  nettogewinn: '#43a047',
  fcf: '#9ccc65',
  ocf: '#c5e1a5',
  eps: '#2e7d32',
  dividenden_gezahlt: '#5c6bc0',
  umsatz: '#66bb6a',
  bruttomarge: '#e53935',
  ebit_marge: '#1b5e20',
  ebitda_marge: '#558b2f',
  nettomarge: '#81c784',
  kgv: '#43a047',
  ps: '#f9a825',
  pfcf: '#80cbc4',
  pb: '#8d6e63',
  ev_ebitda: '#6d4c41',
  ev_rev: '#ffb74d',
  aktienrueckkauf: '#43a047',
  aktien: '#d4d4d8',
  nettoverschuldung: '#ef5350',
  bargeld: '#26a69a',
  eigenkapital: '#ffcc80',
}

export function farbeFuerMetrik(id: string, fallbackIndex = 0): string {
  return METRIK_FARBE[id] ?? FARBEN[fallbackIndex % FARBEN.length]!
}

function serieDarstellung(
  id: string,
  einheit: FundamentalMetrikZeile['einheit'],
): 'flaeche' | 'linie' | 'balken' {
  if (id === 'dividenden_gezahlt' || id === 'aktienrueckkauf') return 'balken'
  if (einheit === 'prozent' || einheit === 'multiple' || einheit === 'ratio' || einheit === 'aktien_mio') {
    return 'linie'
  }
  return 'flaeche'
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
}

type YAxisScale = {
  side: 'left' | 'right'
  minY: number
  maxY: number
  span: number
  einheit: FundamentalMetrikZeile['einheit']
  ticks: number[]
}

type ChartSerie = {
  id: string
  label: string
  farbe: string
  einheit: FundamentalMetrikZeile['einheit']
  yAxis: 0 | 1
  darstellung: 'flaeche' | 'linie' | 'balken'
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
  const letzte10 = letzteNChartPerioden(allePerioden.filter((p) => !p.istSchaetzung), 10)
  const schaetz = allePerioden.filter((p) => p.istSchaetzung)
  const letzte10MitSchaetz = [...letzte10, ...schaetz.filter((s) => !letzte10.some((h) => h.iso === s.iso))]
  const letzte5 = letzteNChartPerioden(allePerioden.filter((p) => !p.istSchaetzung), 5)
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

export function PaFundamentalMetrikChart({
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
}: {
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
}) {
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

  useEffect(() => {
    if (alleChartPerioden.length === 0) {
      setVonIso('')
      setBisIso('')
      return
    }
    const hist = alleChartPerioden.filter((p) => !p.istSchaetzung)
    const letzte10 = letzteNChartPerioden(hist, 10)
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
    const ausgewaehlt = zeilenClean.filter((z) => aktivIds.has(z.id))
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
      label: p.istSchaetzung ? p.label : jahrAusPeriode(p.iso),
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

    const roh = ausgewaehlt.map((z, i) => {
      const aktKey = aktuellerKeyFuerZeile(z, variant)
      const achse = einheitZuAchse.get(einheitSkalaGruppe(z.einheit)) ?? 0

      const histWerte = gefiltertePerioden
        .map((p) => ({
          key: p.iso,
          label: p.istSchaetzung ? p.label : jahrAusPeriode(p.iso),
          wert: z.werte[p.iso],
          istSchaetzung: p.istSchaetzung ?? schaetzIso.has(p.iso),
        }))
        .filter((pt): pt is { key: string; label: string; wert: number; istSchaetzung: boolean } =>
          pt.wert != null && Number.isFinite(pt.wert),
        )

      const aktWert = aktKey ? z.werte[aktKey] : null
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
        darstellung: serieDarstellung(z.id, z.einheit),
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

    const yAchsen: YAxisScale[] = achsenRoh.map((a) => {
      const { minY, maxY, span, ticks } = berechneSkala(a.werte)
      return { side: a.side, minY, maxY, span, einheit: a.einheit, ticks }
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

      const baseY = PAD_OBEN + plotH
      const areaD =
        histPts.length > 0
          ? `${pathHistorisch} L ${histPts[histPts.length - 1]!.x.toFixed(1)} ${baseY} L ${histPts[0]!.x.toFixed(1)} ${baseY} Z`
          : ''

      return {
        id: s.id,
        label: s.label,
        farbe: s.farbe,
        einheit: s.einheit,
        yAxis: s.yAxis,
        darstellung: s.darstellung,
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

    const xLabels = achsenSlots.map((slot, i) => ({
      label: slot.label,
      istSchaetzung: slot.istSchaetzung,
      x: xFuerIdx(i),
    }))

    return { serien, yAchsen, dualAxis, plotH, xLabels }
  }, [zeilenClean, aktivIds, gefiltertePerioden, variant, schaetzIso, padLinks])

  const effektivePlotW = VIEW_W - (dualAxis ? PAD_LINKS_DUAL : padLinks) - (dualAxis ? PAD_RECHTS_DUAL : PAD_RECHTS_SINGLE)

  const hatAktiveSerien = zeilen.some((z) => aktivIds.has(z.id))

  const kastenKlasse = eingebettet
    ? 'bg-transparent'
    : kompakt
      ? 'overflow-hidden border-b border-[var(--app-border)] bg-[var(--app-surface-muted)]'
      : 'overflow-hidden rounded-2xl border border-[var(--app-border)]/70 bg-gradient-to-br from-[var(--app-surface-muted)] via-[var(--app-surface-muted)] to-[var(--app-surface)] shadow-lg shadow-black/20'

  const ankerId = chartId ?? 'fundamental-metrik-chart'

  if (!hatAktiveSerien) {
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

  if (serien.length === 0) {
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
      className={kastenKlasse}
    >
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {werkzeugLeiste}
            <p className="text-center text-sm font-medium text-[var(--app-text)]">
              {titel ?? (variant === 'bewertung' ? 'Bewertungsverlauf' : 'Historischer Kennzahlenverlauf')}
            </p>
            {!kompakt ? (
              <p className="mt-0.5 text-center text-[11px] text-[var(--app-text-muted)]">
                {variant === 'bewertung'
                  ? 'Historie = Trailing · gestrichelt = FY-Schätzung · grauer Bereich = Prognose'
                  : 'Grauer Bereich = Prognose · Flächen = Beträge · Linien = Margen/Multiples'}
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

        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
          {serien.map((s) => (
            <span key={s.id} className="inline-flex items-baseline gap-1.5 text-[var(--app-text-muted)]">
              <span className="inline-block h-2 w-3.5 shrink-0 rounded-[2px]" style={{ background: s.farbe }} aria-hidden />
              <span>{s.label}</span>
              {s.letzterWert != null ? (
                <span className="font-semibold tabular-nums text-[var(--app-text)]">
                  {formatFundamentalWert(s.letzterWert, s.einheit)}
                </span>
              ) : null}
              {s.schnitt != null ? (
                <span className="tabular-nums">
                  (Ø {formatFundamentalWert(s.schnitt, s.einheit)})
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>

      <div className="px-2 pb-3 pt-1 sm:px-4">
        <svg viewBox={`0 0 ${VIEW_W} ${HOEHE}`} className="w-full" role="img" aria-label="Kennzahlen-Chart">
          <defs>
            {serien.map((s) => (
              <linearGradient key={`grad-${s.id}`} id={`area-${ankerId}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.farbe} stopOpacity={0.45} />
                <stop offset="100%" stopColor={s.farbe} stopOpacity={0.04} />
              </linearGradient>
            ))}
          </defs>

          {prognoseX != null ? (
            <g>
              <rect
                x={prognoseX}
                y={PAD_OBEN}
                width={Math.max(0, x1 - prognoseX)}
                height={plotH}
                fill="rgba(148,163,184,0.12)"
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
                  <line
                    x1={x0}
                    y1={y}
                    x2={x1}
                    y2={y}
                    stroke="#3f3f46"
                    strokeOpacity={0.55}
                    strokeDasharray={i === 0 && ai === 0 ? undefined : '3 5'}
                  />
                  <text
                    x={achse.side === 'left' ? x0 - 10 : x1 + 10}
                    y={y + 5}
                    textAnchor={achse.side === 'left' ? 'end' : 'start'}
                    fill={ai === 1 ? '#a3e635' : '#a1a1aa'}
                    style={{ fontSize: ACHSE_FONT, fontWeight: 500 }}
                  >
                    {formatAchse(tick, achse.einheit)}
                  </text>
                </g>
              )
            }),
          )}

          <line x1={x0} y1={PAD_OBEN + plotH} x2={x1} y2={PAD_OBEN + plotH} stroke="#52525b" strokeWidth={1.2} />

          {serien.map((s) => {
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
                opacity={0.45}
              />
            ) : null
          })}

          {serien.map((s) => {
            const art = chartArt === 'balken' && !kompakt ? 'balken' : s.darstellung
            const barW = Math.max(6, (effektivePlotW / Math.max(s.historisch.length + s.schaetzung.length, 1)) * 0.28)
            const baseY = PAD_OBEN + plotH
            return (
            <g key={s.id}>
              {art === 'flaeche' && s.areaD ? <path d={s.areaD} fill={`url(#area-${ankerId}-${s.id})`} /> : null}
              {art !== 'balken' && s.pathHistorisch ? (
                <path
                  d={s.pathHistorisch}
                  fill="none"
                  stroke={s.farbe}
                  strokeWidth={art === 'linie' ? 2 : 2.2}
                  strokeDasharray={art === 'linie' && s.einheit === 'prozent' ? '6 4' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {art !== 'balken' && s.pathSchaetzung ? (
                <path
                  d={s.pathSchaetzung}
                  fill="none"
                  stroke={s.farbe}
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.85}
                />
              ) : null}
              {art === 'balken'
                ? [...s.historisch, ...s.schaetzung].map((pt, i) => {
                    const h = baseY - pt.y
                    return (
                      <rect
                        key={i}
                        x={pt.x - barW / 2}
                        y={h >= 0 ? pt.y : baseY}
                        width={barW}
                        height={Math.abs(h)}
                        fill={s.farbe}
                        opacity={pt.istSchaetzung ? 0.55 : 0.9}
                        rx={1}
                      />
                    )
                  })
                : null}
              {kompakt || art === 'flaeche'
                ? null
                : [...s.historisch, ...s.schaetzung].map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={2.5}
                      fill="#09090b"
                      stroke={s.farbe}
                      strokeWidth={1.6}
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

          {xLabels.map((xl, i) =>
            i % Math.max(1, Math.floor(xLabels.length / 8)) === 0 || i === xLabels.length - 1 ? (
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

      {kompakt ? null : (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5 px-1 text-[10px] text-[var(--app-text-muted)]">
          {serien.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onToggleSerie(s.id)}
                className="flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-[var(--app-surface-hover)]"
                title={`${s.label} aus Chart entfernen`}
              >
                <span className="h-2 w-4 shrink-0 rounded-full" style={{ background: s.farbe }} aria-hidden />
                <span className="text-[var(--app-text-muted)]">
                  {s.label}
                  {dualAxis ? (s.yAxis === 1 ? ' (rechts)' : ' (links)') : ''}
                </span>
                <span className="text-[var(--app-text-muted)]" aria-hidden>
                  ×
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

'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { chartHoverFromClientX, clientToSvgViewBox } from '@/components/portfolio-analyse/chart-hover'
import {
  PaChartAnalyseExpandButton,
  PaChartAnalyseOverlay,
  PaChartAnalyseProvider,
  useChartAnalyseVollbild,
} from '@/components/portfolio-analyse/pa-chart-analyse'
import { chartAnalyseSchluessel } from '@/lib/portfolio-analyse/chart-analyse-store'
import { formatDatumDe } from '@/lib/portfolio-analyse/berechnung'

const TIKR_ACCENT = '#d97706'
const DRAWDOWN_ACCENT = '#f04438'
const ACHSE_FONT = 13
const VIEW_W = 1000

export type KursZeitraum = '1d' | '1w' | '1m' | '3m' | '6m' | 'ytd' | '1yr' | '3yr' | '5yr' | '10yr' | 'all'

const ZEITRAUM_OPTIONS: { id: KursZeitraum; label: string }[] = [
  { id: '1d', label: '1T' },
  { id: '1w', label: '1W' },
  { id: '1m', label: '1M' },
  { id: '3m', label: '3m' },
  { id: '6m', label: '6m' },
  { id: 'ytd', label: 'YTD' },
  { id: '1yr', label: '1J' },
  { id: '3yr', label: '3J' },
  { id: '5yr', label: '5J' },
  { id: '10yr', label: '10J' },
  { id: 'all', label: 'Max' },
]

function intervallFuerZeitraum(z: KursZeitraum): '5m' | '15m' | '1h' | '1d' {
  switch (z) {
    case '1d':
      return '5m'
    case '1w':
      return '15m'
    case '1m':
      return '1h'
    default:
      return '1d'
  }
}

function vonDatumFuerZeitraum(z: KursZeitraum): string {
  const heute = new Date()
  const d = new Date(heute)
  switch (z) {
    case '1d':
      d.setDate(d.getDate() - 2)
      break
    case '1w':
      d.setDate(d.getDate() - 7)
      break
    case '1m':
      d.setMonth(d.getMonth() - 1)
      break
      d.setMonth(d.getMonth() - 3)
      break
    case '6m':
      d.setMonth(d.getMonth() - 6)
      break
    case 'ytd':
      return `${heute.getFullYear()}-01-01`
    case '1yr':
      d.setFullYear(d.getFullYear() - 1)
      break
    case '3yr':
      d.setFullYear(d.getFullYear() - 3)
      break
    case '5yr':
      d.setFullYear(d.getFullYear() - 5)
      break
    case '10yr':
      d.setFullYear(d.getFullYear() - 10)
      break
    case 'all':
      d.setFullYear(d.getFullYear() - 15)
      break
  }
  return d.toISOString().slice(0, 10)
}

type KursPunkt = { datum: string; kurs: number }
type PlotPunkt = { x: number; y: number; p: KursPunkt; dd?: number }

type KursChartModus = 'kurs' | 'drawdown'

function kursrenditePct(punkte: KursPunkt[]): number | null {
  if (punkte.length < 2) return null
  const start = punkte[0].kurs
  const end = punkte[punkte.length - 1].kurs
  if (start <= 0) return null
  return ((end - start) / start) * 100
}

function berechneDrawdown(punkte: KursPunkt[]): { datum: string; kurs: number; drawdownProzent: number }[] {
  let peak = -Infinity
  return punkte.map((p) => {
    peak = Math.max(peak, p.kurs)
    const dd = peak > 0 ? ((p.kurs - peak) / peak) * 100 : 0
    return { ...p, drawdownProzent: Math.min(0, dd) }
  })
}

function nicePriceStep(span: number): number {
  if (span <= 4) return 1
  if (span <= 12) return 2
  if (span <= 30) return 5
  if (span <= 80) return 10
  if (span <= 200) return 25
  if (span <= 500) return 50
  if (span <= 1200) return 100
  return 250
}

function formatYAxisUsd(price: number): string {
  const abs = Math.abs(price)
  if (abs >= 1000) return `$${(price / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k`
  if (abs >= 100) return `$${Math.round(price)}`
  return `$${price.toLocaleString('de-DE', { maximumFractionDigits: abs >= 10 ? 1 : 2 })}`
}

function formatXAxisDatum(datum: string, zeitraum: KursZeitraum): string {
  if (datum.includes('T')) {
    const d = new Date(datum)
    if (zeitraum === '1d') {
      return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
  }
  const d = new Date(`${datum}T12:00:00`)
  return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

function ySkalaKurs(werte: number[]): { yMin: number; yMax: number } {
  const minV = Math.min(...werte)
  const maxV = Math.max(...werte)
  const span = maxV - minV || maxV * 0.05 || 1
  const pad = Math.max(span * 0.06, maxV * 0.01)
  return { yMin: minV - pad, yMax: maxV + pad }
}

export function PaFundamentalKursChart({
  symbolYahoo,
  ticker,
  firmenname,
  kompakt = false,
}: {
  symbolYahoo: string | null
  ticker: string
  firmenname: string
  kompakt?: boolean
}) {
  return (
    <PaChartAnalyseProvider
      schluessel={chartAnalyseSchluessel(ticker, 'kurs')}
      titel={`${ticker} · ${firmenname}`}
    >
      <KursChartBody symbolYahoo={symbolYahoo} ticker={ticker} firmenname={firmenname} kompakt={kompakt} />
    </PaChartAnalyseProvider>
  )
}

function KursChartBody({
  symbolYahoo,
  ticker,
  firmenname,
  kompakt = false,
}: {
  symbolYahoo: string | null
  ticker: string
  firmenname: string
  kompakt?: boolean
}) {
  const areaGradId = useId()
  const ddGradId = useId()
  const [modus, setModus] = useState<KursChartModus>('kurs')
  const [zeitraum, setZeitraum] = useState<KursZeitraum>('1yr')
  const [punkte, setPunkte] = useState<KursPunkt[]>([])
  const [laden, setLaden] = useState(false)
  const [range, setRange] = useState<[number, number]>([0, 100])
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const vollbild = useChartAnalyseVollbild()

  useEffect(() => {
    if (!symbolYahoo) {
      setPunkte([])
      return
    }
    const sym = symbolYahoo
    let cancelled = false
    async function run() {
      setLaden(true)
      try {
        const von = vonDatumFuerZeitraum(zeitraum)
        const bis = new Date().toISOString().slice(0, 10)
        const interval = intervallFuerZeitraum(zeitraum)
        const res = await fetch('/api/portfolio-analyse/kurse/historie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbols: [sym],
            vonDatum: von,
            bisDatum: bis,
            interval: interval === '1d' ? '1d' : interval,
          }),
        })
        const j = (await res.json()) as { ok?: boolean; serien?: Record<string, Record<string, number>> }
        if (cancelled) return
        const serie = j.serien?.[sym] ?? j.serien?.[sym.toUpperCase()] ?? {}
        const pts = Object.entries(serie)
          .map(([datum, kurs]) => ({ datum, kurs }))
          .sort((a, b) => a.datum.localeCompare(b.datum))
        setPunkte(pts)
        setRange([0, 100])
      } catch {
        if (!cancelled) setPunkte([])
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [symbolYahoo, zeitraum])

  const gefiltert = useMemo(() => {
    if (punkte.length === 0) return []
    const startIdx = Math.floor((range[0] / 100) * (punkte.length - 1))
    const endIdx = Math.ceil((range[1] / 100) * (punkte.length - 1))
    return punkte.slice(startIdx, endIdx + 1)
  }, [punkte, range])

  const rendite = useMemo(() => kursrenditePct(gefiltert.length >= 2 ? gefiltert : punkte), [gefiltert, punkte])
  const drawdownSerie = useMemo(() => berechneDrawdown(gefiltert), [gefiltert])
  const maxDrawdown = useMemo(() => {
    if (drawdownSerie.length === 0) return null
    return Math.min(...drawdownSerie.map((p) => p.drawdownProzent))
  }, [drawdownSerie])

  const hoehe = vollbild ? 520 : kompakt ? 268 : 360
  const padLinks = 12
  const padRechts = 54
  const padOben = kompakt ? 16 : 24
  const padUnten = kompakt ? 40 : 44
  const plotW = VIEW_W - padLinks - padRechts
  const plotH = hoehe - padOben - padUnten

  const { linePath, areaPath, yTicks, xLabels, plotPts, yMin, yMax, letzterKurs, istDrawdown } = useMemo((): {
    linePath: string
    areaPath: string
    yTicks: number[]
    xLabels: { x: number; label: string }[]
    plotPts: PlotPunkt[]
    yMin: number
    yMax: number
    letzterKurs: number | null
    istDrawdown: boolean
  } => {
    if (gefiltert.length === 0) {
      return {
        linePath: '',
        areaPath: '',
        yTicks: [] as number[],
        xLabels: [] as { x: number; label: string }[],
        plotPts: [] as PlotPunkt[],
        yMin: 0,
        yMax: 1,
        letzterKurs: null as number | null,
        istDrawdown: false,
      }
    }

    const n = gefiltert.length
    const istDrawdown = modus === 'drawdown'

    if (istDrawdown) {
      const dd = drawdownSerie
      const minDd = Math.min(0, ...dd.map((p) => p.drawdownProzent))
      const floor = Math.floor(minDd / 10) * 10 - 10
      const span = 0 - floor || 10
      const yMin = floor
      const yMax = 0

      const pts = dd.map((p, i) => {
        const x = padLinks + (plotW * i) / Math.max(1, n - 1)
        const y = padOben + ((0 - p.drawdownProzent) / span) * plotH
        return { x, y, p, dd: p.drawdownProzent }
      })

      const line = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
      const topY = padOben
      const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${topY} L ${pts[0].x.toFixed(1)} ${topY} Z`

      const ticks: number[] = [0]
      for (let t = -10; t >= floor; t -= 10) ticks.push(t)

      const labelCount = kompakt ? 5 : 6
      const labelStep = Math.max(1, Math.ceil(n / labelCount))
      const labels: { x: number; label: string }[] = []
      for (let i = 0; i < n; i += labelStep) {
        labels.push({ x: pts[i].x, label: formatXAxisDatum(gefiltert[i].datum, zeitraum) })
      }
      const lastIdx = n - 1
      if (lastIdx % labelStep !== 0) {
        labels.push({ x: pts[lastIdx].x, label: formatXAxisDatum(gefiltert[lastIdx].datum, zeitraum) })
      }

      return {
        linePath: line,
        areaPath: area,
        yTicks: ticks,
        xLabels: labels,
        plotPts: pts,
        yMin,
        yMax,
        letzterKurs: dd[dd.length - 1]?.drawdownProzent ?? null,
        istDrawdown: true,
      }
    }

    const werte = gefiltert.map((p) => p.kurs)
    const skala = ySkalaKurs(werte)
    const yMin = skala.yMin
    const yMax = skala.yMax
    const span = yMax - yMin || 1

    const pts = gefiltert.map((p, i) => {
      const x = padLinks + (plotW * i) / Math.max(1, n - 1)
      const y = padOben + ((yMax - p.kurs) / span) * plotH
      return { x, y, p }
    })

    const line = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
    const baseY = padOben + plotH
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${baseY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${baseY.toFixed(1)} Z`

    const step = nicePriceStep(span)
    const ticks: number[] = []
    const start = Math.floor(yMin / step) * step
    for (let t = start; t <= yMax + step * 0.01; t += step) ticks.push(t)
    ticks.sort((a, b) => b - a)

    const labelCount = kompakt ? 5 : 6
    const labelStep = Math.max(1, Math.ceil(n / labelCount))
    const labels: { x: number; label: string }[] = []
    for (let i = 0; i < n; i += labelStep) {
      labels.push({ x: pts[i].x, label: formatXAxisDatum(gefiltert[i].datum, zeitraum) })
    }
    const lastIdx = n - 1
    if (lastIdx % labelStep !== 0) {
      labels.push({ x: pts[lastIdx].x, label: formatXAxisDatum(gefiltert[lastIdx].datum, zeitraum) })
    }

    return {
      linePath: line,
      areaPath: area,
      yTicks: ticks,
      xLabels: labels,
      plotPts: pts,
      yMin,
      yMax,
      letzterKurs: gefiltert[gefiltert.length - 1]?.kurs ?? null,
      istDrawdown: false,
    }
  }, [gefiltert, drawdownSerie, modus, kompakt, padLinks, padOben, plotH, plotW, zeitraum])

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg || plotPts.length === 0) return
      const view = clientToSvgViewBox(svg, clientX, clientY, VIEW_W, hoehe)
      if (view) {
        const plotWInner = VIEW_W - padLinks - padRechts
        if (plotWInner > 0) {
          const rel = Math.min(1, Math.max(0, (view.x - padLinks) / plotWInner))
          setHoverIndex(Math.round(rel * Math.max(0, plotPts.length - 1)))
          return
        }
      }
      const layout = chartHoverFromClientX(
        clientX,
        svg.getBoundingClientRect(),
        VIEW_W,
        hoehe,
        padLinks,
        padRechts,
        plotPts.length,
      )
      setHoverIndex(layout?.index ?? null)
    },
    [plotPts.length, hoehe, padLinks, padRechts],
  )

  const hover = hoverIndex != null ? plotPts[hoverIndex] : null
  const zeitraumLabel = ZEITRAUM_OPTIONS.find((z) => z.id === zeitraum)?.label ?? zeitraum
  const angezeigterKurs = istDrawdown
    ? (hover?.dd ?? letzterKurs)
    : (hover?.p.kurs ?? letzterKurs)
  const chartFarbe = istDrawdown ? DRAWDOWN_ACCENT : TIKR_ACCENT
  const analysePlot = {
    viewW: VIEW_W,
    viewH: hoehe,
    padL: padLinks,
    padR: padRechts,
    padT: padOben,
    padB: padUnten,
  }
  const snapPunkte = useMemo(() => plotPts.map((p) => ({ x: p.x, y: p.y })), [plotPts])

  return (
    <div
      className={
        vollbild
          ? 'flex h-full min-h-0 flex-col'
          : kompakt
            ? 'flex h-full min-h-[320px] flex-col'
            : 'flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/70 ring-1 ring-white/[0.03]'
      }
    >
      <div className={`border-b border-[var(--app-border)] ${kompakt ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {kompakt ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {angezeigterKurs != null ? (
                  <span className="text-lg font-semibold tabular-nums text-[var(--app-text)]">
                    {istDrawdown
                      ? `${angezeigterKurs.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
                      : `${angezeigterKurs.toLocaleString('de-DE', { maximumFractionDigits: 2 })} $`}
                  </span>
                ) : null}
                {istDrawdown && maxDrawdown != null ? (
                  <span className="text-xs font-medium text-rose-400/90">
                    Max. Drawdown {maxDrawdown.toLocaleString('de-DE', { maximumFractionDigits: 1 })} % · {zeitraumLabel}
                  </span>
                ) : rendite != null ? (
                  <span className={`text-xs font-medium ${rendite >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
                    {rendite >= 0 ? '+' : ''}
                    {rendite.toLocaleString('de-DE', { maximumFractionDigits: 1 })} % · {zeitraumLabel}
                  </span>
                ) : null}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-[var(--app-text)]">{ticker}</span>
                  <span className="text-sm text-[var(--app-text-muted)]">{firmenname}</span>
                </div>
                {rendite != null ? (
                  <p className={`mt-1 text-xs font-medium ${rendite >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
                    {rendite >= 0 ? '+' : ''}
                    {rendite.toLocaleString('de-DE', { maximumFractionDigits: 1 })} % Kursrendite · {zeitraumLabel}
                  </p>
                ) : null}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-0.5">
              {(['kurs', 'drawdown'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModus(m)}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                    modus === m
                      ? m === 'drawdown'
                        ? 'bg-rose-500/20 text-rose-200'
                        : 'bg-amber-500/20 text-amber-200'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {m === 'kurs' ? 'Kurs' : 'Drawdown'}
                </button>
              ))}
            </div>
            {ZEITRAUM_OPTIONS.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setZeitraum(z.id)}
                className={`rounded px-2 py-1 text-[10px] font-medium transition ${
                  zeitraum === z.id
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                    : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'
                }`}
              >
                {z.label}
              </button>
            ))}
            <PaChartAnalyseExpandButton />
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 w-full cursor-crosshair overflow-hidden px-1"
        onMouseMove={(e) => onMove(e.clientX, e.clientY)}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {laden ? (
          <p className="py-16 text-center text-xs text-[var(--app-text-muted)]">Kursdaten werden geladen …</p>
        ) : gefiltert.length === 0 ? (
          <p className="py-16 text-center text-xs text-[var(--app-text-muted)]">Kein Kursverlauf verfügbar.</p>
        ) : (
          <div className="relative">
          <svg
            ref={svgRef}
            width="100%"
            height={hoehe}
            viewBox={`0 0 ${VIEW_W} ${hoehe}`}
            preserveAspectRatio="xMidYMid meet"
            className="block w-full select-none"
            role="img"
            aria-label={`Kursverlauf ${ticker}`}
          >
            <defs>
              <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TIKR_ACCENT} stopOpacity={0.28} />
                <stop offset="100%" stopColor={TIKR_ACCENT} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={ddGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DRAWDOWN_ACCENT} stopOpacity={0.15} />
                <stop offset="100%" stopColor={DRAWDOWN_ACCENT} stopOpacity={0.85} />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => {
              const span = yMax - yMin || 1
              const y = istDrawdown
                ? padOben + ((0 - tick) / span) * plotH
                : padOben + ((yMax - tick) / span) * plotH
              return (
                <g key={tick}>
                  <line
                    x1={padLinks}
                    y1={y}
                    x2={VIEW_W - padRechts}
                    y2={y}
                    stroke="#27272a"
                    strokeWidth={1}
                  />
                  <text
                    x={VIEW_W - padRechts + 6}
                    y={y + 4}
                    textAnchor="start"
                    className="fill-[var(--app-text-muted)]"
                    style={{ fontSize: ACHSE_FONT, fontWeight: 500 }}
                  >
                    {istDrawdown
                      ? `${tick.toLocaleString('de-DE', { maximumFractionDigits: 0 })} %`
                      : formatYAxisUsd(tick)}
                  </text>
                </g>
              )
            })}

            <line
              x1={padLinks}
              y1={padOben + plotH}
              x2={VIEW_W - padRechts}
              y2={padOben + plotH}
              stroke="#3f3f46"
              strokeWidth={1}
            />

            <path d={areaPath} fill={istDrawdown ? `url(#${ddGradId})` : `url(#${areaGradId})`} />
            <path d={linePath} fill="none" stroke={chartFarbe} strokeWidth={2.25} strokeLinejoin="round" />

            {hover ? (
              <>
                <line
                  x1={hover.x}
                  y1={padOben}
                  x2={hover.x}
                  y2={padOben + plotH}
                  stroke="#52525b"
                  strokeDasharray="4 3"
                />
                <circle cx={hover.x} cy={hover.y} r={4} fill={chartFarbe} stroke="#18181b" strokeWidth={1.5} />
              </>
            ) : null}

            {xLabels.map((l, i) => (
              <text
                key={`${l.label}-${i}`}
                x={l.x}
                y={hoehe - 10}
                textAnchor="middle"
                className="fill-[var(--app-text-muted)]"
                style={{ fontSize: ACHSE_FONT, fontWeight: 500 }}
              >
                {l.label}
              </text>
            ))}
          </svg>
          <PaChartAnalyseOverlay
            svgRef={svgRef}
            plot={analysePlot}
            snapPunkte={snapPunkte}
            onChartPointer={(pt) => {
              if (!pt) {
                setHoverIndex(null)
                return
              }
              onMove(pt.x, pt.y)
            }}
          />
          </div>
        )}
      </div>

      {punkte.length > 4 && !kompakt ? (
        <div className="border-t border-[var(--app-border)]/50 px-4 py-2">
          <input
            type="range"
            min={0}
            max={100}
            value={range[0]}
            onChange={(e) => setRange([Math.min(Number(e.target.value), range[1] - 5), range[1]])}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--app-surface-muted)] accent-amber-500 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
            aria-label="Chart-Bereich Start"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={range[1]}
            onChange={(e) => setRange([range[0], Math.max(Number(e.target.value), range[0] + 5)])}
            className="mt-1.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--app-surface-muted)] accent-amber-500 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
            aria-label="Chart-Bereich Ende"
          />
        </div>
      ) : null}

      {hover ? (
        <div className={`border-t border-[var(--app-border)]/50 text-[10px] text-[var(--app-text-muted)] ${kompakt ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
          {formatDatumDe(hover.p.datum)} ·{' '}
          {istDrawdown
            ? `${(hover.dd ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 2 })} % Drawdown`
            : `${hover.p.kurs.toLocaleString('de-DE', { maximumFractionDigits: 2 })} $`}
        </div>
      ) : kompakt ? (
        <div className="border-t border-[var(--app-border)]/50 px-3 py-1.5 text-[10px] text-[var(--app-text-muted)]">USD · Yahoo Finance</div>
      ) : null}
    </div>
  )
}

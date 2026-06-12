'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { berechneLangfristEinstiegsplan } from '@/lib/portfolio-analyse/chartanalyse-einstieg'
import { generiereChartanalyseBericht } from '@/lib/portfolio-analyse/chartanalyse-bericht'
import {
  berechneChartanalyse,
  type ChartanalyseErgebnis,
  type HandelsSignal,
  type KursBar,
} from '@/lib/portfolio-analyse/chartanalyse-engine'
import {
  CHARTANALYSE_ZEITRAEUME,
  vonDatumFuerAbruf,
  vonDatumFuerZeitraum,
  zeitraumLabel,
  type ChartanalyseZeitraumId,
} from '@/lib/portfolio-analyse/chartanalyse-zeitraum'

const VIEW_W = 1000
const ACHSE_FONT = 12
const WICHTIGE_FIB = new Set([38.2, 50, 61.8])

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

function formatYAxis(price: number): string {
  const abs = Math.abs(price)
  if (abs >= 1000) return `${(price / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k`
  if (abs >= 100) return Math.round(price).toLocaleString('de-DE')
  return price.toLocaleString('de-DE', { maximumFractionDigits: abs >= 10 ? 1 : 2 })
}

function formatXAxis(datum: string): string {
  const d = new Date(`${datum}T12:00:00`)
  return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

function signalFarbe(typ: HandelsSignal['typ']): string {
  switch (typ) {
    case 'einstieg':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    case 'gewinnmitnahme':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    case 'risiko':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    case 'beobachten':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-200'
    default:
      return 'border-zinc-700/50 bg-zinc-900/60 text-zinc-400'
  }
}

function bodenBadgeStyle(status: ChartanalyseErgebnis['bodenUrteil']['status']): string {
  switch (status) {
    case 'wahrscheinlich':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
    case 'moeglich':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-200'
    default:
      return 'border-zinc-600/40 bg-zinc-800/60 text-zinc-400'
  }
}

function SignalKarte({ signal }: { signal: HandelsSignal }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${signalFarbe(signal.typ)}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{signal.titel}</p>
        <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">{signal.staerke}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{signal.detail}</p>
    </div>
  )
}

function HorizontPanel({
  titel,
  horizont,
}: {
  titel: string
  horizont: ChartanalyseErgebnis['kurzfristig']
}) {
  return (
    <PaCard className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">{titel}</h3>
        <span className="text-[11px] text-zinc-500">{horizont.zeitraumLabel}</span>
      </div>
      <dl className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-zinc-900/50 px-2 py-1.5">
          <dt className="text-zinc-500">Trend</dt>
          <dd className="font-medium text-zinc-200">{horizont.trendLabel}</dd>
        </div>
        <div className="rounded-lg bg-zinc-900/50 px-2 py-1.5">
          <dt className="text-zinc-500">RSI (14)</dt>
          <dd className="font-medium tabular-nums text-zinc-200">
            {horizont.rsi != null ? horizont.rsi.toFixed(0) : '—'}
          </dd>
        </div>
        <div className="rounded-lg bg-zinc-900/50 px-2 py-1.5">
          <dt className="text-zinc-500">MACD</dt>
          <dd className="font-medium capitalize text-zinc-200">{horizont.macd}</dd>
        </div>
        <div className="rounded-lg bg-zinc-900/50 px-2 py-1.5">
          <dt className="text-zinc-500">vs. EMA 200</dt>
          <dd className="font-medium text-zinc-200">
            {horizont.preisVsEma200 === 'n/a'
              ? '—'
              : horizont.preisVsEma200 === 'darueber'
                ? 'Darüber'
                : 'Darunter'}
          </dd>
        </div>
      </dl>
      <div className="space-y-2">
        {horizont.signale.map((s, i) => (
          <SignalKarte key={`${s.titel}-${i}`} signal={s} />
        ))}
      </div>
    </PaCard>
  )
}

function BerichtText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold text-zinc-100">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  )
}

function pfadAusSerie(
  werte: (number | null)[],
  yMap: (v: number) => number,
  xAt: (i: number) => number,
): string {
  const pts: string[] = []
  for (let i = 0; i < werte.length; i++) {
    const v = werte[i]
    if (v == null) continue
    pts.push(`${pts.length === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yMap(v).toFixed(1)}`)
  }
  return pts.join(' ')
}

export function PaFundamentalChartanalyse({
  symbolYahoo,
  ticker,
  firmenname,
}: {
  symbolYahoo: string | null
  ticker: string
  firmenname: string
}) {
  const gradId = useId()
  const bodenGradId = useId()
  const [zeitraum, setZeitraum] = useState<ChartanalyseZeitraumId>('1y')
  const [bars, setBars] = useState<KursBar[]>([])
  const [laden, setLaden] = useState(false)
  const [showFib, setShowFib] = useState(true)
  const [showBb, setShowBb] = useState(false)
  const [showEma, setShowEma] = useState(true)
  const [showBoden, setShowBoden] = useState(true)
  const [showEinstieg, setShowEinstieg] = useState(true)

  useEffect(() => {
    if (!symbolYahoo) {
      setBars([])
      return
    }
    const sym = symbolYahoo
    let cancelled = false
    async function run() {
      setLaden(true)
      try {
        const von = vonDatumFuerAbruf(zeitraum)
        const bis = new Date().toISOString().slice(0, 10)
        const res = await fetch('/api/portfolio-analyse/kurse/historie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: [sym], vonDatum: von, bisDatum: bis }),
        })
        const j = (await res.json()) as { serien?: Record<string, Record<string, number>> }
        if (cancelled) return
        const serie = j.serien?.[sym] ?? j.serien?.[sym.toUpperCase()] ?? {}
        const pts = Object.entries(serie)
          .map(([datum, close]) => ({ datum, close }))
          .sort((a, b) => a.datum.localeCompare(b.datum))
        setBars(pts)
      } catch {
        if (!cancelled) setBars([])
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [symbolYahoo, zeitraum])

  const anzeigeAb = useMemo(() => vonDatumFuerZeitraum(zeitraum), [zeitraum])

  const barsAnzeige = useMemo(() => {
    if (bars.length === 0) return []
    const idx = bars.findIndex((b) => b.datum >= anzeigeAb)
    const gefiltert = idx >= 0 ? bars.slice(idx) : bars
    if (gefiltert.length >= 2) return gefiltert
    // Tagesdaten: 1T/1W liefern oft nur 1–2 Punkte — letzte Handelstage als Fallback
    if (zeitraum === '1d') return bars.slice(-Math.min(5, bars.length))
    if (zeitraum === '1w') return bars.slice(-Math.min(10, bars.length))
    return gefiltert
  }, [bars, anzeigeAb, zeitraum])

  const analyse = useMemo(
    () => berechneChartanalyse(bars, { anzeigeAbDatum: anzeigeAb }),
    [bars, anzeigeAb],
  )

  const bericht = useMemo(() => {
    if (!analyse) return null
    return generiereChartanalyseBericht(analyse, {
      firmenname: firmenname || ticker,
      zeitraumLabel: zeitraumLabel(zeitraum),
      bodenMuster: analyse.bodenMuster,
      bodenUrteil: analyse.bodenUrteil,
    })
  }, [analyse, firmenname, ticker, zeitraum])

  const chartLayout = useMemo(() => {
    if (!analyse || barsAnzeige.length < 2) return null

    const offset = bars.length - barsAnzeige.length
    const slice = <T,>(arr: T[]) => (offset > 0 ? arr.slice(offset) : arr)

    const padL = 58
    const padR = 12
    const padT = 24
    const padB = 28
    const hMain = 300
    const hRsi = 80
    const hMacd = 80
    const gap = 12
    const totalH = padT + hMain + gap + hRsi + gap + hMacd + padB
    const plotW = VIEW_W - padL - padR
    const n = barsAnzeige.length
    const closes = barsAnzeige.map((b) => b.close)
    const ema20S = slice(analyse.ema20)
    const ema50S = slice(analyse.ema50)
    const ema200S = slice(analyse.ema200)
    const bbUpperS = slice(analyse.bollinger.upper)
    const bbLowerS = slice(analyse.bollinger.lower)
    const rsiS = slice(analyse.rsi)
    const macdHistS = slice(analyse.macdHist)

    const bodenMuster = analyse.bodenMuster[0]
    const einstiegsplan = berechneLangfristEinstiegsplan(analyse, analyse.bodenMuster)
    const bodenZone =
      showBoden && bodenMuster?.zonenUnter != null
        ? { unter: bodenMuster.zonenUnter, ober: bodenMuster.zonenOber ?? bodenMuster.zonenUnter * 1.04 }
        : null

    const allY = [
      ...closes,
      ...(bodenZone ? [bodenZone.unter, bodenZone.ober] : []),
      ...(showFib ? analyse.fibonacci.filter((f) => WICHTIGE_FIB.has(f.pct)).map((f) => f.preis) : []),
      ...(showBb ? bbUpperS.filter((v): v is number => v != null) : []),
      ...(showBb ? bbLowerS.filter((v): v is number => v != null) : []),
      ...(showEma ? ema200S.filter((v): v is number => v != null) : []),
      ...(showEinstieg ? einstiegsplan.tranchen.map((t) => t.kurs) : []),
      ...(showEinstieg && einstiegsplan.stopLoss != null ? [einstiegsplan.stopLoss] : []),
    ]
    const rawMin = Math.min(...allY)
    const rawMax = Math.max(...allY)
    const span = rawMax - rawMin || rawMax * 0.05 || 1
    const pad = Math.max(span * 0.05, rawMax * 0.01)
    const yMin = rawMin - pad
    const yMax = rawMax + pad
    const ySpan = yMax - yMin

    const step = nicePriceStep(ySpan / 5)
    const yTicks: number[] = []
    const start = Math.ceil(yMin / step) * step
    for (let v = start; v <= yMax; v += step) yTicks.push(v)

    const xAt = (i: number) => padL + (plotW * i) / Math.max(1, n - 1)
    const yMap = (v: number) => padT + ((yMax - v) / ySpan) * hMain
    const mainBottom = padT + hMain

    const xTickCount = Math.min(6, n)
    const xTicks = Array.from({ length: xTickCount }, (_, k) => {
      const idx = Math.round((k / Math.max(1, xTickCount - 1)) * (n - 1))
      return { idx, label: formatXAxis(barsAnzeige[idx]!.datum), x: xAt(idx) }
    })

    const kursPath = pfadAusSerie(closes, yMap, xAt)
    const ema20Path = showEma ? pfadAusSerie(ema20S, yMap, xAt) : ''
    const ema50Path = showEma ? pfadAusSerie(ema50S, yMap, xAt) : ''
    const ema200Path = showEma ? pfadAusSerie(ema200S, yMap, xAt) : ''
    const bbUpPath = showBb ? pfadAusSerie(bbUpperS, yMap, xAt) : ''
    const bbLoPath = showBb ? pfadAusSerie(bbLowerS, yMap, xAt) : ''

    const fibLines = showFib
      ? analyse.fibonacci
          .filter((f) => WICHTIGE_FIB.has(f.pct))
          .map((f) => ({ ...f, y: yMap(f.preis) }))
      : []

    const rsiTop = mainBottom + gap
    const rsiH = hRsi - 16
    const rsiPath = pfadAusSerie(rsiS, (v) => rsiTop + ((100 - v) / 100) * rsiH, xAt)
    const rsi30 = rsiTop + 0.7 * rsiH
    const rsi70 = rsiTop + 0.3 * rsiH

    const macdTop = rsiTop + hRsi + gap
    const macdMid = macdTop + hMacd / 2
    const macdVals = macdHistS.filter((v): v is number => v != null)
    const macdMax = Math.max(...macdVals.map(Math.abs), 0.01)
    const macdBars = macdHistS.map((v, i) => {
      if (v == null) return null
      const h = (v / macdMax) * (hMacd / 2 - 10)
      return { x: xAt(i), h, pos: v >= 0 }
    })
    const macdLinePath = pfadAusSerie(
      macdHistS,
      (v) => macdMid - (v / macdMax) * (hMacd / 2 - 10),
      xAt,
    )

    const einstiegLinien = showEinstieg
      ? einstiegsplan.tranchen.map((t, i) => ({
          kurs: t.kurs,
          y: yMap(t.kurs),
          label: `T${i + 1} ${t.kurs.toLocaleString('de-DE', { maximumFractionDigits: 2 })}`,
          typ: t.typ,
        }))
      : []
    const stopLinie =
      showEinstieg && einstiegsplan.stopLoss != null
        ? { kurs: einstiegsplan.stopLoss, y: yMap(einstiegsplan.stopLoss) }
        : null

    const bodenRect =
      bodenZone != null
        ? {
            y1: yMap(bodenZone.ober),
            y2: yMap(bodenZone.unter),
            x1: padL,
            x2: padL + plotW,
          }
        : null

    const musterMarkierung =
      showBoden && bodenMuster
        ? {
            von: xAt(Math.max(0, Math.min(n - 1, bodenMuster.vonIdx - offset))),
            bis: xAt(Math.max(0, Math.min(n - 1, bodenMuster.bisIdx - offset))),
          }
        : null

    return {
      totalH,
      padL,
      padR,
      padT,
      hMain,
      yMin,
      yMax,
      plotW,
      mainBottom,
      yMap,
      yTicks,
      xTicks,
      kursPath,
      ema20Path,
      ema50Path,
      ema200Path,
      bbUpPath,
      bbLoPath,
      fibLines,
      rsiPath,
      rsiTop,
      rsi30,
      rsi70,
      macdBars,
      macdLinePath,
      macdTop,
      macdMid,
      bodenRect,
      musterMarkierung,
      bodenMuster,
      einstiegLinien,
      stopLinie,
    }
  }, [analyse, bars.length, barsAnzeige, showBb, showBoden, showEinstieg, showEma, showFib])

  if (!symbolYahoo) {
    return (
      <PaCard className="p-8 text-center text-sm text-zinc-500">
        Kein Börsensymbol für {firmenname || ticker} — Chartanalyse nicht verfügbar.
      </PaCard>
    )
  }

  return (
    <div className="space-y-4">
      <PaCard className="overflow-hidden p-0">
        <div className="border-b border-zinc-800/70 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Chartanalyse</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {firmenname} · Fibonacci, EMA, RSI, MACD, Bodenmuster
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHARTANALYSE_ZEITRAEUME.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setZeitraum(z.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    zeitraum === z.id
                      ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { id: 'fib', label: 'Fib 38–62 %', on: showFib, set: setShowFib },
              { id: 'bb', label: 'Bollinger', on: showBb, set: setShowBb },
              { id: 'ema', label: 'EMA 20/50/200', on: showEma, set: setShowEma },
              { id: 'boden', label: 'Boden-Zone', on: showBoden, set: setShowBoden },
              { id: 'einstieg', label: 'Einstiegs-Limits', on: showEinstieg, set: setShowEinstieg },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => t.set((v) => !v)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  t.on ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25' : 'bg-zinc-900 text-zinc-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {analyse ? (
          <div className={`mx-4 mt-3 rounded-xl border px-4 py-3 ${bodenBadgeStyle(analyse.bodenUrteil.status)}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">Bodenbewertung</p>
                <p className="mt-0.5 text-base font-semibold">{analyse.bodenUrteil.label}</p>
              </div>
              {analyse.bodenMuster.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {analyse.bodenMuster.slice(0, 3).map((m) => (
                    <span
                      key={m.id}
                      className="rounded-md bg-black/20 px-2 py-0.5 text-[11px] font-medium"
                      title={m.beschreibung}
                    >
                      {m.titel}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-relaxed opacity-90">{analyse.bodenUrteil.kurz}</p>
          </div>
        ) : null}

        {laden ? (
          <p className="px-4 py-16 text-center text-sm text-zinc-500">Kursdaten werden geladen …</p>
        ) : !analyse || !chartLayout ? (
          <p className="px-4 py-16 text-center text-sm text-zinc-500">Zu wenig Kursdaten für die Analyse.</p>
        ) : (
          <div className="px-2 pb-3 pt-2 sm:px-4">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1 text-xs text-zinc-500">
              <span>
                Kurs{' '}
                <strong className="text-zinc-200">
                  {analyse.aktuellerKurs.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                </strong>
              </span>
              {analyse.renditeZeitraum != null ? (
                <span>
                  Zeitraum{' '}
                  <strong className={analyse.renditeZeitraum >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {analyse.renditeZeitraum >= 0 ? '+' : ''}
                    {analyse.renditeZeitraum.toFixed(1)} %
                  </strong>
                </span>
              ) : null}
              {analyse.drawdownAktuell != null ? (
                <span>
                  Drawdown{' '}
                  <strong className="text-rose-400/90">{analyse.drawdownAktuell.toFixed(1)} %</strong>
                </span>
              ) : null}
            </div>

            <svg viewBox={`0 0 ${VIEW_W} ${chartLayout.totalH}`} className="w-full" role="img" aria-label="Chartanalyse">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97706" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={bodenGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.04} />
                </linearGradient>
              </defs>

              {/* Y-Grid Hauptchart */}
              {chartLayout.yTicks.map((v) => {
                const yy = chartLayout.yMap(v)
                return (
                  <g key={v}>
                    <line
                      x1={chartLayout.padL}
                      x2={VIEW_W - chartLayout.padR}
                      y1={yy}
                      y2={yy}
                      stroke="#27272a"
                      strokeWidth={1}
                    />
                    <text
                      x={chartLayout.padL - 6}
                      y={yy + 4}
                      textAnchor="end"
                      fill="#71717a"
                      style={{ fontSize: ACHSE_FONT }}
                    >
                      {formatYAxis(v)}
                    </text>
                  </g>
                )
              })}

              {/* Boden-Zone */}
              {chartLayout.bodenRect ? (
                <>
                  <rect
                    x={chartLayout.bodenRect.x1}
                    y={Math.min(chartLayout.bodenRect.y1, chartLayout.bodenRect.y2)}
                    width={chartLayout.bodenRect.x2 - chartLayout.bodenRect.x1}
                    height={Math.abs(chartLayout.bodenRect.y2 - chartLayout.bodenRect.y1)}
                    fill={`url(#${bodenGradId})`}
                    stroke="#22c55e"
                    strokeOpacity={0.35}
                    strokeDasharray="4 3"
                  />
                  {chartLayout.musterMarkierung ? (
                    <rect
                      x={chartLayout.musterMarkierung.von}
                      y={chartLayout.padT}
                      width={chartLayout.musterMarkierung.bis - chartLayout.musterMarkierung.von}
                      height={chartLayout.hMain}
                      fill="#22c55e"
                      fillOpacity={0.06}
                      stroke="#22c55e"
                      strokeOpacity={0.2}
                    />
                  ) : null}
                </>
              ) : null}

              {/* Fibonacci (nur 38/50/62) */}
              {chartLayout.fibLines.map((f) => (
                <g key={f.pct}>
                  <line
                    x1={chartLayout.padL}
                    x2={VIEW_W - chartLayout.padR}
                    y1={f.y}
                    y2={f.y}
                    stroke="#a78bfa"
                    strokeOpacity={0.45}
                    strokeDasharray="5 4"
                  />
                  <text x={VIEW_W - chartLayout.padR - 4} y={f.y - 3} textAnchor="end" fill="#a78bfa" style={{ fontSize: 10 }}>
                    Fib {f.label}
                  </text>
                </g>
              ))}

              {chartLayout.bbUpPath ? (
                <path d={chartLayout.bbUpPath} fill="none" stroke="#64748b" strokeWidth={1} strokeOpacity={0.45} />
              ) : null}
              {chartLayout.bbLoPath ? (
                <path d={chartLayout.bbLoPath} fill="none" stroke="#64748b" strokeWidth={1} strokeOpacity={0.45} />
              ) : null}
              {chartLayout.ema200Path ? (
                <path d={chartLayout.ema200Path} fill="none" stroke="#f472b6" strokeWidth={1.5} strokeOpacity={0.9} />
              ) : null}
              {chartLayout.ema50Path ? (
                <path d={chartLayout.ema50Path} fill="none" stroke="#38bdf8" strokeWidth={1.2} strokeOpacity={0.9} />
              ) : null}
              {chartLayout.ema20Path ? (
                <path d={chartLayout.ema20Path} fill="none" stroke="#2dd4bf" strokeWidth={1} strokeOpacity={0.9} />
              ) : null}

              {chartLayout.einstiegLinien.map((l) => (
                <g key={l.label}>
                  <line
                    x1={chartLayout.padL}
                    x2={VIEW_W - chartLayout.padR}
                    y1={l.y}
                    y2={l.y}
                    stroke={l.typ === 'market' ? '#34d399' : '#2dd4bf'}
                    strokeWidth={1.5}
                    strokeDasharray={l.typ === 'market' ? undefined : '6 4'}
                    strokeOpacity={0.85}
                  />
                  <text x={chartLayout.padL + 4} y={l.y - 4} fill="#2dd4bf" style={{ fontSize: 10 }}>
                    {l.label}
                  </text>
                </g>
              ))}
              {chartLayout.stopLinie ? (
                <g>
                  <line
                    x1={chartLayout.padL}
                    x2={VIEW_W - chartLayout.padR}
                    y1={chartLayout.stopLinie.y}
                    y2={chartLayout.stopLinie.y}
                    stroke="#f87171"
                    strokeWidth={1.2}
                    strokeDasharray="4 3"
                    strokeOpacity={0.8}
                  />
                  <text x={VIEW_W - chartLayout.padR - 4} y={chartLayout.stopLinie.y - 4} textAnchor="end" fill="#f87171" style={{ fontSize: 10 }}>
                    Stop {chartLayout.stopLinie.kurs.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                  </text>
                </g>
              ) : null}

              <path d={`${chartLayout.kursPath} L ${VIEW_W - chartLayout.padR} ${chartLayout.mainBottom} L ${chartLayout.padL} ${chartLayout.mainBottom} Z`} fill={`url(#${gradId})`} />
              <path d={chartLayout.kursPath} fill="none" stroke="#d97706" strokeWidth={2.2} />

              {/* X-Achse Hauptchart */}
              {chartLayout.xTicks.map((t) => (
                <text key={t.idx} x={t.x} y={chartLayout.mainBottom + 18} textAnchor="middle" fill="#71717a" style={{ fontSize: ACHSE_FONT }}>
                  {t.label}
                </text>
              ))}

              {/* RSI Panel */}
              <rect
                x={chartLayout.padL}
                y={chartLayout.rsiTop}
                width={chartLayout.plotW}
                height={64}
                fill="#18181b"
                fillOpacity={0.5}
                rx={4}
              />
              <text x={chartLayout.padL + 4} y={chartLayout.rsiTop + 12} fill="#71717a" style={{ fontSize: 11 }}>
                RSI (14)
              </text>
              <rect
                x={chartLayout.padL}
                y={chartLayout.rsi30}
                width={chartLayout.plotW}
                height={chartLayout.rsi70 - chartLayout.rsi30}
                fill="#22c55e"
                fillOpacity={0.06}
              />
              <line
                x1={chartLayout.padL}
                x2={VIEW_W - chartLayout.padR}
                y1={chartLayout.rsi30}
                y2={chartLayout.rsi30}
                stroke="#22c55e"
                strokeOpacity={0.35}
                strokeDasharray="4 3"
              />
              <line
                x1={chartLayout.padL}
                x2={VIEW_W - chartLayout.padR}
                y1={chartLayout.rsi70}
                y2={chartLayout.rsi70}
                stroke="#ef4444"
                strokeOpacity={0.35}
                strokeDasharray="4 3"
              />
              <text x={VIEW_W - chartLayout.padR - 2} y={chartLayout.rsi30 + 3} textAnchor="end" fill="#22c55e" style={{ fontSize: 9 }}>
                30
              </text>
              <text x={VIEW_W - chartLayout.padR - 2} y={chartLayout.rsi70 + 3} textAnchor="end" fill="#ef4444" style={{ fontSize: 9 }}>
                70
              </text>
              <path d={chartLayout.rsiPath} fill="none" stroke="#fbbf24" strokeWidth={1.5} />

              {/* MACD Panel */}
              <rect
                x={chartLayout.padL}
                y={chartLayout.macdTop}
                width={chartLayout.plotW}
                height={64}
                fill="#18181b"
                fillOpacity={0.5}
                rx={4}
              />
              <text x={chartLayout.padL + 4} y={chartLayout.macdTop + 12} fill="#71717a" style={{ fontSize: 11 }}>
                MACD
              </text>
              <line
                x1={chartLayout.padL}
                x2={VIEW_W - chartLayout.padR}
                y1={chartLayout.macdMid}
                y2={chartLayout.macdMid}
                stroke="#3f3f46"
                strokeWidth={1}
              />
              {chartLayout.macdBars.map((b, i) => {
                if (!b) return null
                const barW = Math.max(1.5, (chartLayout.plotW / Math.max(barsAnzeige.length, 1)) * 0.6)
                return (
                  <rect
                    key={i}
                    x={b.x - barW / 2}
                    y={b.pos ? chartLayout.macdMid - b.h : chartLayout.macdMid}
                    width={barW}
                    height={Math.abs(b.h)}
                    fill={b.pos ? '#22c55e' : '#ef4444'}
                    fillOpacity={0.65}
                  />
                )
              })}
              <path d={chartLayout.macdLinePath} fill="none" stroke="#818cf8" strokeWidth={1.2} strokeOpacity={0.9} />
            </svg>

            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[10px] text-zinc-500">
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-amber-500" /> Kurs
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-teal-400" /> EMA 20
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-sky-400" /> EMA 50
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-pink-400" /> EMA 200
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t border-dashed border-violet-400" /> Fibonacci
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-sm bg-emerald-500/30 ring-1 ring-emerald-500/40" /> Boden-Zone
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t border-dashed border-teal-400" /> Einstiegs-Limits
              </li>
            </ul>
          </div>
        )}
      </PaCard>

      {bericht ? (
        <PaCard className="p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Schriftliche Chartanalyse</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{bericht.zusammenfassung}</p>
          <div className="mt-5 space-y-5">
            {bericht.abschnitte.map((a) => (
              <div key={a.titel} className="border-t border-zinc-800/80 pt-4 first:border-t-0 first:pt-0">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-500/90">{a.titel}</h4>
                <div className="mt-2">
                  <BerichtText text={a.text} />
                </div>
              </div>
            ))}
          </div>
        </PaCard>
      ) : null}

      {analyse ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <HorizontPanel titel="Kurzfristig (Trading & Timing)" horizont={analyse.kurzfristig} />
            <HorizontPanel titel="Langfristig (Investieren & Compounden)" horizont={analyse.langfristig} />
          </div>

          <PaCard className="p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Unterstützung & Widerstand</h3>
            <p className="mt-1 text-xs text-zinc-500">Pivot-Cluster aus dem gewählten Zeitraum</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-500/80">Unterstützungen</p>
                <ul className="mt-1 space-y-1 text-sm tabular-nums text-zinc-300">
                  {analyse.unterstuetzungen.length
                    ? analyse.unterstuetzungen.map((p) => (
                        <li key={p}>{p.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</li>
                      ))
                    : '—'}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-rose-500/80">Widerstände</p>
                <ul className="mt-1 space-y-1 text-sm tabular-nums text-zinc-300">
                  {analyse.widerstaende.length
                    ? analyse.widerstaende.map((p) => (
                        <li key={p}>{p.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</li>
                      ))
                    : '—'}
                </ul>
              </div>
            </div>
          </PaCard>

          <p className="text-[11px] leading-relaxed text-zinc-600">
            Hinweis: Automatische technische Analyse auf Schlusskursen — keine Anlageberatung. Signale sollten mit
            Fundamentaldaten und eigenem Risikomanagement kombiniert werden.
          </p>
        </>
      ) : null}
    </div>
  )
}

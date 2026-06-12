'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  berechneChartanalyse,
  type ChartanalyseErgebnis,
  type HandelsSignal,
  type KursBar,
} from '@/lib/portfolio-analyse/chartanalyse-engine'

const VIEW_W = 1000
const ZEITRAEUME = [
  { id: '6m' as const, label: '6M', monate: 6 },
  { id: '1y' as const, label: '1J', monate: 12 },
  { id: '3y' as const, label: '3J', jahre: 3 },
  { id: '5y' as const, label: '5J', jahre: 5 },
]

function vonDatum(id: (typeof ZEITRAEUME)[number]['id']): string {
  const d = new Date()
  const opt = ZEITRAEUME.find((z) => z.id === id)!
  if ('monate' in opt && opt.monate) d.setMonth(d.getMonth() - opt.monate)
  else if ('jahre' in opt && opt.jahre) d.setFullYear(d.getFullYear() - opt.jahre)
  return d.toISOString().slice(0, 10)
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
  const [zeitraum, setZeitraum] = useState<(typeof ZEITRAEUME)[number]['id']>('1y')
  const [bars, setBars] = useState<KursBar[]>([])
  const [laden, setLaden] = useState(false)
  const [showFib, setShowFib] = useState(true)
  const [showBb, setShowBb] = useState(true)
  const [showEma, setShowEma] = useState(true)

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
        const von = vonDatum(zeitraum)
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

  const analyse = useMemo(() => berechneChartanalyse(bars), [bars])

  const chartLayout = useMemo(() => {
    if (!analyse || bars.length < 2) return null
    const padL = 12
    const padR = 54
    const padT = 20
    const padB = 36
    const hMain = 280
    const hRsi = 72
    const hMacd = 72
    const totalH = hMain + hRsi + hMacd + 16
    const plotW = VIEW_W - padL - padR
    const n = bars.length
    const closes = bars.map((b) => b.close)

    const allY = [
      ...closes,
      ...analyse.fibonacci.map((f) => f.preis),
      ...(showBb ? analyse.bollinger.upper.filter((v): v is number => v != null) : []),
      ...(showBb ? analyse.bollinger.lower.filter((v): v is number => v != null) : []),
      ...(showEma ? analyse.ema200.filter((v): v is number => v != null) : []),
    ]
    const yMin = Math.min(...allY) * 0.98
    const yMax = Math.max(...allY) * 1.02
    const ySpan = yMax - yMin || 1

    const xAt = (i: number) => padL + (plotW * i) / Math.max(1, n - 1)
    const yMap = (v: number) => padT + ((yMax - v) / ySpan) * (hMain - padT - padB)

    const kursPath = pfadAusSerie(closes, yMap, xAt)
    const ema20Path = showEma ? pfadAusSerie(analyse.ema20, yMap, xAt) : ''
    const ema50Path = showEma ? pfadAusSerie(analyse.ema50, yMap, xAt) : ''
    const ema200Path = showEma ? pfadAusSerie(analyse.ema200, yMap, xAt) : ''
    const bbUpPath = showBb ? pfadAusSerie(analyse.bollinger.upper, yMap, xAt) : ''
    const bbLoPath = showBb ? pfadAusSerie(analyse.bollinger.lower, yMap, xAt) : ''

    const fibLines = showFib
      ? analyse.fibonacci.map((f) => ({ ...f, y: yMap(f.preis) }))
      : []

    const rsiBase = padT + hMain + 8
    const rsiH = hRsi - 20
    const rsiPath = pfadAusSerie(
      analyse.rsi,
      (v) => rsiBase + ((100 - v) / 100) * rsiH,
      xAt,
    )

    const macdBase = rsiBase + hRsi + 8
    const macdVals = [...analyse.macdHist.filter((v): v is number => v != null)]
    const macdMax = Math.max(...macdVals.map(Math.abs), 0.01)
    const macdPath = pfadAusSerie(
      analyse.macdHist,
      (v) => macdBase + hMacd / 2 - (v / macdMax) * (hMacd / 2 - 8),
      xAt,
    )

    return {
      totalH,
      hMain,
      padL,
      padR,
      kursPath,
      ema20Path,
      ema50Path,
      ema200Path,
      bbUpPath,
      bbLoPath,
      fibLines,
      rsiPath,
      macdPath,
      rsiBase,
      macdBase,
      yMin,
      yMax,
    }
  }, [analyse, bars, showBb, showEma, showFib])

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
                {firmenname} · Fibonacci, EMA, Bollinger, RSI, MACD — Signale für Kurz- und Langfrist
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ZEITRAEUME.map((z) => (
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
              { id: 'fib', label: 'Fibonacci', on: showFib, set: setShowFib },
              { id: 'bb', label: 'Bollinger', on: showBb, set: setShowBb },
              { id: 'ema', label: 'EMA 20/50/200', on: showEma, set: setShowEma },
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

        {laden ? (
          <p className="px-4 py-16 text-center text-sm text-zinc-500">Kursdaten werden geladen …</p>
        ) : !analyse || !chartLayout ? (
          <p className="px-4 py-16 text-center text-sm text-zinc-500">Zu wenig Kursdaten für die Analyse.</p>
        ) : (
          <div className="px-2 pb-3 pt-1 sm:px-4">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1 text-xs text-zinc-500">
              <span>
                Kurs{' '}
                <strong className="text-zinc-200">
                  {analyse.aktuellerKurs.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                </strong>
              </span>
              <span>
                Schwung{' '}
                <strong className="text-zinc-400">
                  {analyse.swingTief.toFixed(2)} – {analyse.swingHoch.toFixed(2)}
                </strong>
              </span>
            </div>
            <svg viewBox={`0 0 ${VIEW_W} ${chartLayout.totalH}`} className="w-full" role="img" aria-label="Chartanalyse">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97706" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
              </defs>

              {chartLayout.fibLines.map((f) => (
                <g key={f.pct}>
                  <line
                    x1={chartLayout.padL}
                    x2={VIEW_W - chartLayout.padR}
                    y1={f.y}
                    y2={f.y}
                    stroke="#a78bfa"
                    strokeOpacity={0.35}
                    strokeDasharray="6 4"
                  />
                  <text x={VIEW_W - chartLayout.padR + 4} y={f.y + 4} fill="#a78bfa" style={{ fontSize: 9 }}>
                    {f.label}
                  </text>
                </g>
              ))}

              {chartLayout.bbUpPath ? (
                <path d={chartLayout.bbUpPath} fill="none" stroke="#64748b" strokeWidth={1} strokeOpacity={0.5} />
              ) : null}
              {chartLayout.bbLoPath ? (
                <path d={chartLayout.bbLoPath} fill="none" stroke="#64748b" strokeWidth={1} strokeOpacity={0.5} />
              ) : null}
              {chartLayout.ema200Path ? (
                <path d={chartLayout.ema200Path} fill="none" stroke="#f472b6" strokeWidth={1.5} strokeOpacity={0.85} />
              ) : null}
              {chartLayout.ema50Path ? (
                <path d={chartLayout.ema50Path} fill="none" stroke="#38bdf8" strokeWidth={1.2} strokeOpacity={0.85} />
              ) : null}
              {chartLayout.ema20Path ? (
                <path d={chartLayout.ema20Path} fill="none" stroke="#2dd4bf" strokeWidth={1} strokeOpacity={0.85} />
              ) : null}
              <path d={chartLayout.kursPath} fill="none" stroke="#d97706" strokeWidth={2.2} />

              <line
                x1={chartLayout.padL}
                x2={VIEW_W - chartLayout.padR}
                y1={chartLayout.rsiBase + (chartLayout.hMain > 0 ? 0 : 0)}
                y2={chartLayout.rsiBase}
                stroke="#3f3f46"
                strokeWidth={1}
              />
              <text x={chartLayout.padL} y={chartLayout.rsiBase - 4} fill="#71717a" style={{ fontSize: 10 }}>
                RSI
              </text>
              <path d={chartLayout.rsiPath} fill="none" stroke="#fbbf24" strokeWidth={1.2} />
              <line
                x1={chartLayout.padL}
                x2={VIEW_W - chartLayout.padR}
                y1={chartLayout.rsiBase + 14}
                y2={chartLayout.rsiBase + 14}
                stroke="#22c55e"
                strokeOpacity={0.25}
                strokeDasharray="4 3"
              />
              <line
                x1={chartLayout.padL}
                x2={VIEW_W - chartLayout.padR}
                y1={chartLayout.rsiBase + 52}
                y2={chartLayout.rsiBase + 52}
                stroke="#ef4444"
                strokeOpacity={0.25}
                strokeDasharray="4 3"
              />

              <text x={chartLayout.padL} y={chartLayout.macdBase - 4} fill="#71717a" style={{ fontSize: 10 }}>
                MACD Hist
              </text>
              <path d={chartLayout.macdPath} fill="none" stroke="#818cf8" strokeWidth={1.2} />
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
            </ul>
          </div>
        )}
      </PaCard>

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

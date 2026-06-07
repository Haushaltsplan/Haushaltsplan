'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chartHoverFromClientX } from '@/components/portfolio-analyse/chart-hover'
import { formatDatumDe } from '@/lib/portfolio-analyse/berechnung'

const TIKR_ACCENT = '#d97706'
const VIEW_W = 1000

export type KursZeitraum = '3m' | '6m' | 'ytd' | '1yr' | '3yr' | '5yr' | '10yr' | 'all'

const ZEITRAUM_OPTIONS: { id: KursZeitraum; label: string }[] = [
  { id: '3m', label: '3m' },
  { id: '6m', label: '6m' },
  { id: 'ytd', label: 'YTD' },
  { id: '1yr', label: '1J' },
  { id: '3yr', label: '3J' },
  { id: '5yr', label: '5J' },
  { id: '10yr', label: '10J' },
  { id: 'all', label: 'Max' },
]

function vonDatumFuerZeitraum(z: KursZeitraum): string {
  const heute = new Date()
  const bis = heute.toISOString().slice(0, 10)
  const d = new Date(heute)
  switch (z) {
    case '3m':
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

export function PaFundamentalKursChart({
  symbolYahoo,
  ticker,
}: {
  symbolYahoo: string | null
  ticker: string
}) {
  const [zeitraum, setZeitraum] = useState<KursZeitraum>('1yr')
  const [punkte, setPunkte] = useState<KursPunkt[]>([])
  const [laden, setLaden] = useState(false)
  const [linie, setLinie] = useState(true)
  const [range, setRange] = useState<[number, number]>([0, 100])
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

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
        const res = await fetch('/api/portfolio-analyse/kurse/historie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: [sym], vonDatum: von, bisDatum: bis }),
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

  const hoehe = 320
  const padLinks = 52
  const padRechts = 16
  const padOben = 24
  const padUnten = 36
  const plotW = VIEW_W - padLinks - padRechts
  const plotH = hoehe - padOben - padUnten

  const { path, minY, maxY, plotPts } = useMemo(() => {
    if (gefiltert.length === 0) {
      return { path: '', minY: 0, maxY: 1, plotPts: [] as { x: number; y: number; p: KursPunkt }[] }
    }
    const werte = gefiltert.map((p) => p.kurs)
    const minV = Math.min(...werte)
    const maxV = Math.max(...werte)
    const span = maxV - minV || 1
    const pts = gefiltert.map((p, i) => {
      const x = padLinks + (plotW * i) / Math.max(1, gefiltert.length - 1)
      const y = padOben + plotH - ((p.kurs - minV) / span) * plotH
      return { x, y, p }
    })
    const d = linie
      ? pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
      : pts
          .map((pt, i) => {
            const prev = pts[i - 1]
            if (!prev) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
            const body = Math.abs(pt.y - prev.y) * 0.35
            const top = Math.min(pt.y, prev.y)
            return `M ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} L ${pt.x.toFixed(1)} ${prev.y.toFixed(1)} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)} M ${pt.x.toFixed(1)} ${top.toFixed(1)} v ${body.toFixed(1)}`
          })
          .join(' ')
    return { path: d, minY: minV, maxY: maxV, plotPts: pts }
  }, [gefiltert, linie, padLinks, plotH, plotW, padOben])

  const onMove = useCallback(
    (clientX: number) => {
      const el = containerRef.current
      if (!el || plotPts.length === 0) return
      const layout = chartHoverFromClientX(
        clientX,
        el.getBoundingClientRect(),
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

  return (
    <div className="min-w-0 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">
          {ticker} · Kursverlauf
        </h3>
        <div className="flex flex-wrap gap-1">
          {ZEITRAUM_OPTIONS.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setZeitraum(z.id)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                zeitraum === z.id
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {laden ? (
          <p className="py-16 text-center text-xs text-zinc-500">Kursdaten werden geladen …</p>
        ) : gefiltert.length === 0 ? (
          <p className="py-16 text-center text-xs text-zinc-500">Kein Kursverlauf verfügbar.</p>
        ) : (
          <svg viewBox={`0 0 ${VIEW_W} ${hoehe}`} className="w-full" role="img">
            <line x1={padLinks} y1={padOben + plotH} x2={VIEW_W - padRechts} y2={padOben + plotH} stroke="#3f3f46" />
            <text x={padLinks - 6} y={padOben + 4} textAnchor="end" fill="#71717a" style={{ fontSize: 10 }}>
              {maxY.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
            </text>
            <text x={padLinks - 6} y={padOben + plotH} textAnchor="end" fill="#71717a" style={{ fontSize: 10 }}>
              {minY.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
            </text>
            {linie ? (
              <path d={path} fill="none" stroke={TIKR_ACCENT} strokeWidth={2} strokeLinejoin="round" />
            ) : (
              <path d={path} fill="none" stroke={TIKR_ACCENT} strokeWidth={1.5} />
            )}
            {plotPts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={hoverIndex === i ? 4 : 0} fill={TIKR_ACCENT} />
            ))}
            {hover ? (
              <>
                <line x1={hover.x} y1={padOben} x2={hover.x} y2={padOben + plotH} stroke="#52525b" strokeDasharray="4 3" />
                <text x={hover.x} y={padOben - 6} textAnchor="middle" fill="#fbbf24" style={{ fontSize: 10 }}>
                  {hover.p.kurs.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                </text>
              </>
            ) : null}
          </svg>
        )}
      </div>

      {punkte.length > 4 ? (
        <div className="mt-3 px-1">
          <input
            type="range"
            min={0}
            max={100}
            value={range[0]}
            onChange={(e) => setRange([Math.min(Number(e.target.value), range[1] - 5), range[1]])}
            className="w-full accent-amber-500"
            aria-label="Chart-Bereich Start"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={range[1]}
            onChange={(e) => setRange([range[0], Math.max(Number(e.target.value), range[0] + 5)])}
            className="mt-1 w-full accent-amber-500"
            aria-label="Chart-Bereich Ende"
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={linie} onChange={(e) => setLinie(e.target.checked)} className="accent-amber-500" />
          Linienchart
        </label>
        {hover ? (
          <span>
            {formatDatumDe(hover.p.datum)} · {hover.p.kurs.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
          </span>
        ) : null}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { CHART } from '@/lib/chart-theme'

export type FinanzChartPunkt = {
  /** ISO-Datum `YYYY-MM-DD` oder Monat `YYYY-MM` */
  time: string
  value: number
  label?: string
}

function toChartTime(raw: string): UTCTimestamp | string {
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`
  const ms = Date.parse(t)
  if (Number.isFinite(ms)) return Math.floor(ms / 1000) as UTCTimestamp
  return t
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/**
 * TradingView Lightweight Charts — Flächen-/Linien-Chart für Finanzzeitreihen.
 */
export function FinanzLineChart({
  punkte,
  hoehe = 220,
  farbe = CHART.emerald,
  wertFormat,
}: {
  punkte: FinanzChartPunkt[]
  hoehe?: number
  farbe?: string
  wertFormat?: (v: number) => string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const textColor = cssVar('--app-text-muted', '#94a3b8')
    const grid = cssVar('--app-chart-grid', 'rgba(148,163,184,0.15)')
    const bg = 'transparent'

    const chart = createChart(el, {
      height: hoehe,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        horzLine: { labelBackgroundColor: farbe },
        vertLine: { labelBackgroundColor: farbe },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: farbe,
      topColor: `${farbe}66`,
      bottomColor: `${farbe}00`,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: wertFormat
        ? {
            type: 'custom',
            formatter: wertFormat,
            minMove: 0.01,
          }
        : { type: 'price', precision: 0, minMove: 1 },
    })

    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (!hostRef.current) return
      chart.applyOptions({ width: hostRef.current.clientWidth, height: hoehe })
    })
    ro.observe(el)
    chart.applyOptions({ width: el.clientWidth })

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [farbe, hoehe, wertFormat])

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart) return

    const data = punkte
      .filter((p) => Number.isFinite(p.value))
      .map((p) => ({ time: toChartTime(p.time) as string, value: p.value }))
      .sort((a, b) => String(a.time).localeCompare(String(b.time)))

    // Duplikate (gleicher Tag) zusammenführen
    const dedup = new Map<string, number>()
    for (const d of data) dedup.set(String(d.time), d.value)
    const clean = [...dedup.entries()].map(([time, value]) => ({ time, value }))

    series.setData(clean as { time: string; value: number }[])
    chart.timeScale().fitContent()
  }, [punkte])

  if (punkte.length < 2) {
    return (
      <p className="py-12 text-center text-sm text-[var(--app-text-muted)]">
        Noch zu wenig Historie für einen Verlauf.
      </p>
    )
  }

  return <div ref={hostRef} className="w-full min-w-0" style={{ height: hoehe }} />
}

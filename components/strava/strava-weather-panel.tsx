'use client'

import { appTableScrollInlineClassName } from '@/components/page-shell'
import {
  formatWatts,
  formatWkg,
  StravaChartGrid,
  StravaChartHoverInfo,
  yFromValue,
} from '@/components/strava/strava-chart-utils'
import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import { REFERENZ_TEMP_C } from '@/lib/strava/strava-weather-adjust'
import type { WetterLeistungsAnalyse } from '@/lib/strava/strava-weather-adjust'
import { useState } from 'react'

export function StravaWeatherPanel({
  analysis,
  backlog,
}: {
  analysis: WetterLeistungsAnalyse
  backlog: number
}) {
  const [hoverBucket, setHoverBucket] = useState<string | null>(null)

  if (analysis.ridesWithWeather === 0) {
    return (
      <StravaCard padding="md" accent="cyan">
        <StravaSectionTitle
          title="Leistung & Wetter"
          subtitle="Open-Meteo · Einordnung nach Temperatur"
        />
        <p className="text-sm text-[var(--app-text-muted)]">
          Noch keine Wetterdaten — beim Sync werden bis zu 10 Fahrten pro Lauf angereichert
          {backlog > 0 ? ` (${backlog} ausstehend)` : ''}.
        </p>
      </StravaCard>
    )
  }

  const peak =
    Math.max(...analysis.buckets.map((b) => b.avgWatts ?? 0), 1) || 1
  const h = 140
  const w = Math.max(360, analysis.buckets.length * 56)
  const padTop = 16
  const padBottom = 28
  const chartH = h - padTop - padBottom

  return (
    <StravaCard padding="md" accent="cyan">
      <StravaSectionTitle
        title="Leistung & Wetter"
        subtitle={`Normalisiert auf ${REFERENZ_TEMP_C} °C · Optimal ${analysis.optimalTempRange}`}
      />

      <StravaChartHoverInfo>
        {hoverBucket ? (
          (() => {
            const b = analysis.buckets.find((x) => x.bucket === hoverBucket)
            if (!b) return null
            return (
              <p className="text-[var(--app-text-muted)]">
                <span className="font-semibold text-[var(--app-text)]">{b.bucket}</span> · {b.rides} Fahrten · Ø{' '}
                {formatWatts(b.avgWatts)}
                {b.avgWkg != null ? ` · ${formatWkg(b.avgWkg)}` : ''}
              </p>
            )
          })()
        ) : null}
      </StravaChartHoverInfo>

      <div className={appTableScrollInlineClassName}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ minWidth: w, width: '100%', height: h }}>
          <StravaChartGrid padX={8} padTop={padTop} padBottom={padBottom} width={w} height={h} />
          {analysis.buckets.map((b, i) => {
            const barW = Math.max(36, w / analysis.buckets.length - 8)
            const x = i * (w / analysis.buckets.length) + 4
            const barH = b.avgWatts != null ? (b.avgWatts / peak) * chartH : 0
            const active = hoverBucket === b.bucket
            const isHot = b.bucket.includes('25') || b.bucket.includes('30')
            return (
              <g
                key={b.bucket}
                onMouseEnter={() => setHoverBucket(b.bucket)}
                onMouseLeave={() => setHoverBucket(null)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={padTop + chartH - barH}
                  width={barW}
                  height={Math.max(barH, 4)}
                  fill={isHot ? '#f97316' : STRAVA_COLORS.cyan}
                  rx={3}
                  opacity={active ? 1 : hoverBucket != null ? 0.45 : 0.85}
                />
                <text x={x + barW / 2} y={h - 8} textAnchor="middle" fill="#71717a" fontSize="6">
                  {b.bucket.replace(' °C', '°')}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">
          Letzte Fahrten — wetter-adjustiert
        </p>
        {analysis.recentInsights.slice(0, 5).map((r) => (
          <div
            key={r.stravaId}
            className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-xs"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-[var(--app-text)]">{r.name}</span>
              <span className="tabular-nums text-[var(--app-text-muted)]">
                {Math.round(r.tempC)} °C · {formatWatts(r.rawWatts)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-cyan-200/80">{r.contextLabel}</p>
          </div>
        ))}
      </div>
    </StravaCard>
  )
}

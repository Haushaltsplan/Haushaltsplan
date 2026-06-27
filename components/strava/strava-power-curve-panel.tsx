'use client'

import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import type { PowerCurvePoint } from '@/lib/strava/strava-power-curve'

export function StravaPowerCurvePanel({
  curve,
  eftp,
  stravaFtp,
}: {
  curve: PowerCurvePoint[]
  eftp: number | null
  stravaFtp: number | null
}) {
  const withData = curve.filter((p) => p.bestWatts != null)
  if (withData.length === 0) {
    return (
      <StravaCard padding="md" accent="orange">
        <StravaSectionTitle title="Power Curve" subtitle="Sync mehrfach ausführen für Watt-Streams" />
        <p className="text-sm text-zinc-500">Noch keine Power-Peak-Daten — benötigt Powermeter + Stream-Sync.</p>
      </StravaCard>
    )
  }

  const peak = Math.max(...withData.map((p) => p.bestWatts ?? 0), 1)
  const h = 140
  const w = 360

  return (
    <StravaCard padding="md" accent="orange">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StravaSectionTitle title="Power Curve" subtitle="Beste Leistung über Dauer" />
        <div className="flex gap-4 text-right">
          {eftp ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">eFTP (geschätzt)</p>
              <p className="text-xl font-bold tabular-nums text-orange-300">{eftp} W</p>
            </div>
          ) : null}
          {stravaFtp ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Strava FTP</p>
              <p className="text-xl font-bold tabular-nums text-zinc-300">{stravaFtp} W</p>
            </div>
          ) : null}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full">
        {withData.map((p, i) => {
          const barW = w / withData.length - 6
          const x = i * (w / withData.length) + 3
          const barH = ((p.bestWatts ?? 0) / peak) * (h - 40)
          return (
            <g key={p.key}>
              <text x={x + barW / 2} y={14} textAnchor="middle" fill={STRAVA_COLORS.orange} fontSize="8" fontWeight="600">
                {p.bestWatts}
              </text>
              <rect
                x={x}
                y={h - 24 - barH}
                width={barW}
                height={Math.max(barH, 4)}
                fill={STRAVA_COLORS.orange}
                rx={3}
                opacity={0.9}
              />
              <text x={x + barW / 2} y={h - 6} textAnchor="middle" fill="#71717a" fontSize="7">
                {p.label.replace('Ø ', '')}
              </text>
            </g>
          )
        })}
      </svg>
    </StravaCard>
  )
}

'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import { formatRelativeDate, sportIcon, type TransformedStravaActivity } from '@/lib/strava/strava-activity-utils'

type Props = {
  activities: TransformedStravaActivity[]
}

function MetricCell({ value, muted }: { value: string; muted?: boolean }) {
  const isNa = value === 'N/A'
  return (
    <span
      className={[
        'text-xs tabular-nums',
        isNa || muted ? 'text-zinc-600' : 'text-zinc-300',
      ].join(' ')}
    >
      {value}
    </span>
  )
}

export function StravaActivityFeed({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <StravaCard padding="lg">
        <p className="text-center text-sm text-zinc-500">Noch keine Aktivitäten — synchronisiere mit Strava.</p>
      </StravaCard>
    )
  }

  return (
    <div className="space-y-3">
      <StravaSectionTitle title="Aktivitäten-Feed" subtitle="Letzte Fahrten & Runs" />
      <div className="space-y-2">
        {activities.map((a) => (
          <a
            key={a.id}
            href={a.stravaUrl}
            target="_blank"
            rel="noreferrer"
            className={[
              'group flex items-center gap-3 rounded-2xl border border-slate-500/15 bg-[#0c0d0f] p-3',
              'shadow-[0_2px_12px_rgba(0,0,0,0.25)]',
              STRAVA_INTERACTIVE,
              'hover:border-[#FC4C02]/30 hover:bg-[#141618]',
            ].join(' ')}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg transition-colors duration-200"
              style={{
                background:
                  a.kind === 'ride'
                    ? STRAVA_COLORS.orangeMuted
                    : a.kind === 'run'
                      ? STRAVA_COLORS.cyanMuted
                      : 'rgba(167, 139, 250, 0.12)',
              }}
            >
              {sportIcon(a.kind)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-zinc-100 group-hover:text-orange-100">{a.name}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{formatRelativeDate(a.startDate)}</p>
            </div>

            <div className="hidden shrink-0 grid-cols-4 gap-x-4 text-right sm:grid">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-zinc-600">Dist</p>
                <MetricCell value={a.distanceLabel} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-zinc-600">Zeit</p>
                <MetricCell value={a.movingTimeCompact} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-zinc-600">Ø HF</p>
                <MetricCell value={a.avgHrLabel} muted={a.avgHr == null} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-zinc-600">Hm</p>
                <MetricCell value={a.elevationLabel} muted={a.elevationGainM == null || a.elevationGainM <= 0} />
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-1 text-right sm:hidden">
              <MetricCell value={a.distanceLabel} />
              <MetricCell value={a.movingTimeCompact} />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

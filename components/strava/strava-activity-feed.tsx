'use client'

import { STRAVA_CARD_HOVER, STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import { formatRelativeDate, sportIcon, type TransformedStravaActivity } from '@/lib/strava/strava-activity-utils'

type Props = {
  activities: TransformedStravaActivity[]
  onSelect?: (id: number) => void
  filterBlocked?: boolean
}

function MetricCell({ value, muted }: { value: string; muted?: boolean }) {
  const isNa = value === 'N/A'
  return (
    <span
      className={[
        'text-xs tabular-nums',
        isNa || muted ? 'text-[var(--app-text-muted)]' : 'text-[var(--app-text)]',
      ].join(' ')}
    >
      {value}
    </span>
  )
}

export function StravaActivityFeed({ activities, onSelect, filterBlocked }: Props) {
  if (activities.length === 0) {
    return (
      <StravaCard padding="lg">
        <p className="text-center text-sm text-[var(--app-text-muted)]">
          {filterBlocked
            ? 'Keine Aktivitäten im aktuellen Filter — oben Zeitraum oder Sportart anpassen.'
            : 'Noch keine Aktivitäten — „Jetzt synchronisieren“ oder Vollimport ausführen.'}
        </p>
      </StravaCard>
    )
  }

  return (
    <div className="space-y-3">
      <StravaSectionTitle title="Aktivitäten-Feed" subtitle="Letzte Fahrten & Runs" />
      <div className="space-y-2">
        {activities.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect?.(a.id)}
            className={[
              'group flex w-full items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-left',
              'shadow-[var(--app-shadow)]',
              STRAVA_INTERACTIVE,
              STRAVA_CARD_HOVER,
              'hover:bg-[var(--app-surface-muted)]',
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
              <p className="truncate text-sm font-bold text-[var(--app-text)] group-hover:text-orange-100">{a.name}</p>
              <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">{formatRelativeDate(a.startDate)}</p>
            </div>

            <div className="hidden shrink-0 grid-cols-6 gap-x-3 text-right lg:grid">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">Dist</p>
                <MetricCell value={a.distanceLabel} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">Zeit</p>
                <MetricCell value={a.movingTimeCompact} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">Ø W</p>
                <MetricCell value={a.wattsLabel} muted={a.avgWatts == null} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">W/kg</p>
                <MetricCell value={a.wkgLabel} muted={a.wkg == null} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">TSS</p>
                <MetricCell value={a.tssLabel} muted={a.tss == null} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">Hm</p>
                <MetricCell value={a.elevationLabel} muted={a.elevationGainM == null || a.elevationGainM <= 0} />
              </div>
            </div>

            <div className="hidden shrink-0 grid-cols-3 gap-x-3 text-right sm:grid lg:hidden">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">Dist</p>
                <MetricCell value={a.distanceLabel} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">W/kg</p>
                <MetricCell value={a.wkgLabel} muted={a.wkg == null} />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">TSS</p>
                <MetricCell value={a.tssLabel} muted={a.tss == null} />
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-1 text-right sm:hidden">
              <MetricCell value={a.distanceLabel} />
              <MetricCell value={a.wkgLabel} muted={a.wkg == null} />
              <MetricCell value={a.tssLabel} muted={a.tss == null} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

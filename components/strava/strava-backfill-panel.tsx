'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import type { BackfillKategorieStatus, BackfillStatus } from '@/lib/strava/strava-backfill-status'

const BAR_COLORS: Record<string, string> = {
  streams: STRAVA_COLORS.orange,
  weather: STRAVA_COLORS.cyan,
  segments: '#84cc16',
  decoupling: '#a78bfa',
}

function BackfillBar({ item }: { item: BackfillKategorieStatus }) {
  const color = BAR_COLORS[item.key] ?? STRAVA_COLORS.orange
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-[var(--app-text-muted)]">{item.label}</span>
        <span className="tabular-nums text-[var(--app-text)]">
          {item.complete}/{item.total}
          {item.pending > 0 ? (
            <span className="ml-1 text-[var(--app-text-muted)]">({item.pending} offen)</span>
          ) : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${item.pct}%`, background: color }}
        />
      </div>
      {item.pending > 0 ? (
        <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">
          ~{Math.ceil(item.pending / item.perRun)} Sync-Durchläufe à {item.perRun}/Lauf
        </p>
      ) : null}
    </div>
  )
}

export function StravaBackfillPanel({
  backfill,
  busy,
  backfillRound,
  onBackfill,
}: {
  backfill: BackfillStatus
  busy?: boolean
  backfillRound?: number | null
  onBackfill?: () => void
}) {
  if (backfill.allComplete && backfill.categories.length === 0) return null

  return (
    <StravaCard padding="md" accent={backfill.allComplete ? undefined : 'orange'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StravaSectionTitle
          title="Datenqualität"
          subtitle={
            backfill.allComplete
              ? 'Alle Analysen vollständig'
              : `${backfill.totalPending} Aktivitäten warten auf Nachbearbeitung`
          }
        />
        {onBackfill && !backfill.allComplete ? (
          <button
            type="button"
            disabled={busy}
            onClick={onBackfill}
            className={[
              'rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-200 hover:bg-orange-500/15 disabled:opacity-50',
              STRAVA_INTERACTIVE,
            ].join(' ')}
          >
            {busy
              ? backfillRound != null
                ? `Analyse läuft… (${backfillRound})`
                : 'Analyse läuft…'
              : 'Analyse vervollständigen'}
          </button>
        ) : null}
      </div>

      {backfill.allComplete ? (
        <p className="mt-2 text-sm text-emerald-400/90">
          Streams, Wetter, Segmente und Dekoupling sind auf dem neuesten Stand.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {backfill.categories.map((c) => (
            <BackfillBar key={c.key} item={c} />
          ))}
        </div>
      )}
    </StravaCard>
  )
}

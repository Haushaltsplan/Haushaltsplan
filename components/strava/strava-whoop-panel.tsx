'use client'

import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import type { WhoopStravaInsight } from '@/lib/strava/strava-whoop-bridge'
import Link from 'next/link'

export function StravaWhoopPanel({ insight }: { insight: WhoopStravaInsight }) {
  return (
    <StravaCard padding="md" accent="cyan">
      <StravaSectionTitle title="WHOOP × Strava" subtitle="Recovery vs. Wochenbelastung" />
      <div className="flex flex-wrap items-center gap-4">
        {insight.recovery != null ? (
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2" style={{ borderColor: insight.color }}>
            <span className="text-lg font-bold tabular-nums" style={{ color: insight.color }}>
              {insight.recovery}%
            </span>
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[var(--app-border-strong)] text-[var(--app-text-muted)]">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          {insight.recoveryLabel ? (
            <p className="text-sm font-semibold" style={{ color: insight.color }}>
              {insight.recoveryLabel}
            </p>
          ) : null}
          <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">{insight.recommendation}</p>
          <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">Wochen-TSS (Rad): {insight.weekTss}</p>
        </div>
      </div>
      {!insight.hasWhoop ? (
        <Link href="/fitnessdaten" className="mt-3 inline-block text-xs text-cyan-400 underline hover:text-cyan-300">
          WHOOP unter Fitnessdaten verbinden →
        </Link>
      ) : null}
    </StravaCard>
  )
}

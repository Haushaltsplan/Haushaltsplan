'use client'

import { WhoopCard, formatHhMm, useWhoopReveal } from '@/components/fitnessdaten/whoop-chart-kit'
import { WHOOP_SLEEP_STAGES, type WhoopSleepStageKey } from '@/components/fitnessdaten/whoop-design-tokens'

const REIHENFOLGE: WhoopSleepStageKey[] = ['awake', 'light', 'rem', 'deep']

export function WhoopSleepArchitectureBar({
  awakeMin,
  lightMin,
  remMin,
  deepMin,
  title = 'Schlafphasen',
  onInfo,
}: {
  awakeMin: number | null | undefined
  lightMin: number | null | undefined
  remMin: number | null | undefined
  deepMin: number | null | undefined
  title?: string
  onInfo?: () => void
}) {
  const shown = useWhoopReveal()
  const werte: Record<WhoopSleepStageKey, number> = {
    awake: Math.max(0, awakeMin ?? 0),
    light: Math.max(0, lightMin ?? 0),
    rem: Math.max(0, remMin ?? 0),
    deep: Math.max(0, deepMin ?? 0),
  }
  const total = REIHENFOLGE.reduce((a, k) => a + werte[k], 0)
  const schlaf = total - werte.awake

  return (
    <WhoopCard
      title={title}
      onInfo={onInfo}
      aside={total > 0 ? <span className="tabular-nums">{formatHhMm(schlaf)} Schlaf</span> : undefined}
    >
      {total <= 0 ? (
        <p className="py-3 text-center text-xs text-[#8B93A1]">Keine Phasendaten für diese Nacht.</p>
      ) : (
        <>
          <div className="flex h-3.5 w-full gap-[3px] overflow-hidden rounded-full bg-white/[0.05]">
            {REIHENFOLGE.map((k) => {
              const pct = (werte[k] / total) * 100
              if (pct <= 0) return null
              return (
                <div
                  key={k}
                  className="h-full rounded-full transition-[width] duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                  style={{
                    width: shown ? `${pct}%` : '0%',
                    minWidth: shown ? 6 : 0,
                    background: `linear-gradient(90deg, ${WHOOP_SLEEP_STAGES[k].color}cc, ${WHOOP_SLEEP_STAGES[k].color})`,
                  }}
                  title={`${WHOOP_SLEEP_STAGES[k].label}: ${formatHhMm(werte[k])}`}
                />
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {REIHENFOLGE.map((k) => {
              const pct = Math.round((werte[k] / total) * 100)
              return (
                <div key={k} className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8B93A1]">
                    <span className="h-2 w-2 rounded-full" style={{ background: WHOOP_SLEEP_STAGES[k].color }} />
                    {WHOOP_SLEEP_STAGES[k].label}
                  </p>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold tabular-nums text-white">{formatHhMm(werte[k])}</span>
                    <span className="text-[11px] tabular-nums text-[#6B7280]">{pct}%</span>
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </WhoopCard>
  )
}

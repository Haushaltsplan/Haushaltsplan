'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaRouteMap } from '@/components/strava/strava-route-map'
import { transformActivity } from '@/lib/strava/strava-activity-utils'
import { leistungWatts, wattProKg } from '@/lib/strava/strava-auswertung'
import { POWER_PEAK_LABELS } from '@/lib/strava/strava-power'
import type { StravaActivityRow, StravaAthleteProfile } from '@/lib/strava/strava-types'
import { appModalScrollHiddenClassName } from '@/lib/app-modal-overlay'

type Props = {
  activity: StravaActivityRow | null
  athlete: StravaAthleteProfile | null
  onClose: () => void
}

export function StravaActivityModal({ activity, athlete, onClose }: Props) {
  if (!activity) return null

  const t = transformActivity(activity)
  const w = leistungWatts(activity)
  const wkg = wattProKg(w, athlete?.omnia_weight_kg ?? null)
  const peaks = activity.power_peaks

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4 ${appModalScrollHiddenClassName}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0c0d0f] shadow-2xl sm:rounded-2xl ${STRAVA_INTERACTIVE}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <StravaRouteMap polyline={activity.summary_polyline} height={180} className="rounded-t-2xl sm:rounded-t-2xl" />

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400/80">{t.sportType}</p>
              <h2 className="mt-1 text-lg font-bold text-zinc-50">{t.name}</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {new Date(t.startDate).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
              ✕
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: 'Distanz', v: t.distanceLabel },
              { l: 'Zeit', v: t.movingTimeCompact },
              { l: 'Tempo', v: t.speedOrPaceLabel },
              { l: 'Hm', v: t.elevationLabel },
              { l: 'Ø HF', v: t.avgHrLabel },
              { l: 'Leistung', v: t.wattsLabel },
              { l: 'W/kg', v: wkg ? `${wkg.toFixed(2)}` : 'N/A' },
              { l: 'TSS', v: activity.estimated_tss ? `${Math.round(activity.estimated_tss)}` : activity.suffer_score ? `${Math.round(activity.suffer_score)}` : 'N/A' },
            ].map((m) => (
              <div key={m.l} className="rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-zinc-600">{m.l}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-200">{m.v}</p>
              </div>
            ))}
          </div>

          {peaks && Object.values(peaks).some((v) => v != null) ? (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Power Peaks</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(peaks) as (keyof typeof peaks)[]).map((k) =>
                  peaks[k] ? (
                    <div key={k} className="rounded-lg bg-orange-500/10 px-2 py-1.5 text-center">
                      <p className="text-[9px] text-orange-300/80">{POWER_PEAK_LABELS[k]}</p>
                      <p className="text-sm font-bold tabular-nums text-orange-200">{Math.round(peaks[k]!)} W</p>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          ) : null}

          <a
            href={t.stravaUrl}
            target="_blank"
            rel="noreferrer"
            className={`mt-5 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-white ${STRAVA_INTERACTIVE}`}
            style={{ background: STRAVA_COLORS.orange }}
          >
            Auf Strava öffnen
          </a>
        </div>
      </div>
    </div>
  )
}

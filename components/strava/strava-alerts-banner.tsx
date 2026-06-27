'use client'

import { STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import type { SmartAlert } from '@/lib/strava/strava-insights'

const LEVEL_STYLE = {
  info: 'border-cyan-500/25 bg-cyan-500/8 text-cyan-100',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
} as const

export function StravaAlertsBanner({ alerts }: { alerts: SmartAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={[
            'rounded-xl border px-3 py-2.5 text-xs leading-relaxed',
            STRAVA_INTERACTIVE,
            LEVEL_STYLE[a.level],
          ].join(' ')}
        >
          {a.message}
        </div>
      ))}
    </div>
  )
}

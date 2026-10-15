'use client'

import { coachTagesbotschaft } from '@/lib/trainingsplan/coach-messages'
import { TRAININGS_ZIEL } from '@/lib/trainingsplan/profile'
import type { DaySession } from '@/lib/trainingsplan/types'

const MOOD_RING: Record<string, string> = {
  kraft: 'from-orange-500/30 to-amber-500/5 ring-orange-400/30',
  rad: 'from-rose-500/30 to-pink-500/5 ring-rose-400/30',
  ruhe: 'from-teal-500/20 to-cyan-500/5 ring-teal-400/25',
  feier: 'from-emerald-500/30 to-teal-500/5 ring-emerald-400/30',
  shift: 'from-violet-500/25 to-indigo-500/5 ring-violet-400/30',
}

export function CoachBanner({
  heute,
  name,
  rescheduleNote,
}: {
  heute: DaySession | undefined
  name: string
  rescheduleNote: string | null
}) {
  const msg = coachTagesbotschaft(heute, name, rescheduleNote)
  const ring = MOOD_RING[msg.mood] ?? MOOD_RING.ruhe

  return (
    <div
      className={`app-surface-card relative overflow-hidden bg-gradient-to-br ${ring} ring-1`}
    >
      <div className="flex gap-4 p-4 sm:p-5">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-surface-muted)] text-2xl shadow-inner ring-1 ring-[var(--app-ring)]"
          aria-hidden
        >
          {msg.mood === 'kraft' ? '💪' : msg.mood === 'rad' ? '🚴' : msg.mood === 'feier' ? '🎉' : msg.mood === 'shift' ? '🔄' : '🧘'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="app-eyebrow text-[10px]">Personal Coach</p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[var(--app-text)] sm:text-lg">
            {msg.headline}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--app-text-muted)]">{msg.body}</p>
          <p className="mt-3 text-[11px] text-[var(--app-text-muted)]/80">
            Ziel {TRAININGS_ZIEL.label}: Sixpack · W/kg · Baustellen-Kraft
          </p>
        </div>
      </div>
    </div>
  )
}

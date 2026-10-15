'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ExerciseVideoPlayer } from '@/components/trainingsplan/exercise-video-player'
import { coachAbschluss, coachRestTip } from '@/lib/trainingsplan/coach-messages'
import type { DaySession, WorkoutExercise } from '@/lib/trainingsplan/types'

type Phase = 'work' | 'rest' | 'done'

export function WorkoutModeModal({
  session,
  coachName,
  onClose,
  onFinish,
}: {
  session: DaySession
  coachName: string
  onClose: () => void
  onFinish: () => void
}) {
  const exercises = session.exercises ?? []
  const [exIdx, setExIdx] = useState(0)
  const [setNr, setSetNr] = useState(1)
  const [phase, setPhase] = useState<Phase>('work')
  const [restLeft, setRestLeft] = useState(0)

  const current: WorkoutExercise | undefined = exercises[exIdx]
  const totalExercises = exercises.length

  useEffect(() => {
    if (phase !== 'rest') return
    const t = window.setInterval(() => {
      setRestLeft((s) => {
        if (s <= 1) {
          setPhase('work')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [phase])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  function completeSet() {
    if (!current) return
    const finishedSet = setNr
    if (finishedSet < current.sets) {
      setRestLeft(current.restSec)
      setPhase('rest')
      setSetNr(finishedSet + 1)
      return
    }
    // letzter Satz dieser Übung
    if (exIdx < totalExercises - 1) {
      setExIdx((i) => i + 1)
      setSetNr(1)
      setRestLeft(current.restSec)
      setPhase('rest')
      return
    }
    setPhase('done')
  }

  function skipRest() {
    setRestLeft(0)
    setPhase('work')
  }

  if (phase === 'done') {
    const fin = coachAbschluss(coachName, session.kind)
    return (
      <ModalShell onClose={onClose}>
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="text-5xl" aria-hidden>
            🎉
          </span>
          <h2 className="mt-4 text-xl font-semibold text-[var(--app-text)]">{fin.title}</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--app-text-muted)]">
            {fin.tip}
          </p>
          <button
            type="button"
            onClick={() => {
              onFinish()
              onClose()
            }}
            className="mt-8 rounded-xl bg-emerald-500/90 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Fortschritt speichern
          </button>
        </div>
      </ModalShell>
    )
  }

  if (!current) {
    return (
      <ModalShell onClose={onClose}>
        <p className="p-6 text-sm text-[var(--app-text-muted)]">Keine Übungen hinterlegt.</p>
      </ModalShell>
    )
  }

  const setForTip = phase === 'rest' ? Math.max(1, setNr - 1) : setNr
  const restTip = coachRestTip(current.name, setForTip, current.sets)
  const progressPct = ((exIdx + (setNr - 1) / current.sets) / totalExercises) * 100

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
            Mit-Trainieren · {exIdx + 1}/{totalExercises}
          </p>
          <p className="truncate text-sm font-semibold text-[var(--app-text)]">{session.title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm text-[var(--app-text-muted)] hover:bg-white/5 hover:text-[var(--app-text)]"
        >
          Schließen
        </button>
      </div>

      <div className="h-1 bg-[var(--app-chart-track)]">
        <div
          className="h-full bg-orange-400 transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="space-y-4 p-4">
        <ExerciseVideoPlayer exercise={current} />

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/50 p-4">
          <p className="text-2xl font-semibold tabular-nums text-[var(--app-text)]">
            {phase === 'rest'
              ? `Pause nach Satz ${setForTip}`
              : `Satz ${Math.min(setNr, current.sets)} / ${current.sets}`}
          </p>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">Ziel: {current.reps}</p>
          <p className="mt-2 text-xs leading-relaxed text-orange-200/80">{current.tip}</p>
        </div>

        {phase === 'rest' ? (
          <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-300">Satzpause</p>
            <p className="mt-2 font-mono text-5xl font-semibold tabular-nums text-[var(--app-text)]">
              {String(Math.floor(restLeft / 60)).padStart(1, '0')}:
              {String(restLeft % 60).padStart(2, '0')}
            </p>
            <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full bg-teal-400 transition-[width] duration-1000 linear"
                style={{
                  width: `${Math.min(100, (restLeft / Math.max(1, current.restSec)) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-3 text-sm text-[var(--app-text-muted)]">{restTip}</p>
            <button
              type="button"
              onClick={skipRest}
              className="mt-4 text-xs font-medium text-teal-300 hover:text-teal-200"
            >
              Pause überspringen
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={completeSet}
            className="w-full rounded-2xl bg-orange-500 py-4 text-base font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 active:scale-[0.99]"
          >
            Satz erledigt
          </button>
        )}
      </div>
    </ModalShell>
  )
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--app-border-strong)] bg-[var(--app-bg)] shadow-2xl sm:rounded-3xl">
        {children}
      </div>
    </div>
  )
}

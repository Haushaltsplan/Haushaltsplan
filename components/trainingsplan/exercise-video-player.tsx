'use client'

import { useEffect, useRef, useState } from 'react'
import type { WorkoutExercise } from '@/lib/trainingsplan/types'

export function ExerciseVideoPlayer({ exercise }: { exercise: WorkoutExercise }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(!exercise.videoUrl)

  useEffect(() => {
    setFailed(!exercise.videoUrl)
    const v = videoRef.current
    if (!v || !exercise.videoUrl) return
    v.load()
    void v.play().catch(() => setFailed(true))
  }, [exercise.id, exercise.videoUrl])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--app-border)] bg-black/40">
      {!failed && exercise.videoUrl ? (
        <video
          ref={videoRef}
          key={exercise.id}
          className="h-full w-full object-cover"
          src={exercise.videoUrl}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setFailed(true)}
        />
      ) : (
        <FormDemoFallback exercise={exercise} />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
        <p className="text-sm font-semibold text-white">{exercise.name}</p>
        <p className="text-xs text-white/70">
          {exercise.sets} Sätze · {exercise.reps}
        </p>
      </div>
    </div>
  )
}

function FormDemoFallback({ exercise }: { exercise: WorkoutExercise }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-orange-500/10 via-transparent to-teal-500/10 p-6">
      <span
        className="animate-bounce text-5xl motion-reduce:animate-none"
        aria-hidden
      >
        {exercise.emoji}
      </span>
      <p className="max-w-xs text-center text-sm text-[var(--app-text-muted)]">
        Form-Demo: {exercise.tip}
      </p>
      <div className="mt-1 flex gap-1.5" aria-hidden>
        {Array.from({ length: 3 }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-8 rounded-full bg-orange-400/40"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

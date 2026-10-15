'use client'

import { useEffect, useRef, useState } from 'react'
import type { WorkoutExercise } from '@/lib/trainingsplan/types'

/**
 * Zeigt eine echte Person bei der Übungsausführung (looping Demo-GIF).
 * TrainAI-Demos sind quadratisch — daher aspect-square + object-contain.
 * Globale Regel `#app-main img { height: auto }` wird per absolute + !h-full
 * ausgehebelt, sonst wird die Figur unten abgeschnitten.
 */
export function ExerciseVideoPlayer({ exercise }: { exercise: WorkoutExercise }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [gifFailed, setGifFailed] = useState(!exercise.demoGifUrl)
  const [videoFailed, setVideoFailed] = useState(!exercise.videoUrl)

  useEffect(() => {
    setGifFailed(!exercise.demoGifUrl)
    setVideoFailed(!exercise.videoUrl)
  }, [exercise.id, exercise.demoGifUrl, exercise.videoUrl])

  useEffect(() => {
    if (!gifFailed || videoFailed || !exercise.videoUrl) return
    const v = videoRef.current
    if (!v) return
    v.load()
    void v.play().catch(() => setVideoFailed(true))
  }, [exercise.id, exercise.videoUrl, gifFailed, videoFailed])

  const showGif = Boolean(exercise.demoGifUrl) && !gifFailed
  const showVideo = !showGif && Boolean(exercise.videoUrl) && !videoFailed

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-zinc-950">
      <div className="flex justify-center bg-zinc-200 dark:bg-zinc-800">
        <div
          className={
            showGif
              ? 'relative aspect-square w-full max-w-[min(100%,380px)]'
              : 'relative aspect-video w-full'
          }
        >
          {showGif ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={exercise.id}
              src={exercise.demoGifUrl}
              alt={`Demo: ${exercise.name}`}
              className="absolute inset-0 !h-full !max-h-none w-full object-contain object-center"
              onError={() => setGifFailed(true)}
            />
          ) : showVideo ? (
            <video
              ref={videoRef}
              key={`vid-${exercise.id}`}
              className="absolute inset-0 !h-full !max-h-none w-full object-contain object-center"
              src={exercise.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setVideoFailed(true)}
            />
          ) : (
            <FormDemoFallback exercise={exercise} />
          )}
        </div>
      </div>

      <div className="border-t border-[var(--app-border)] bg-black/50 px-4 py-2.5">
        <p className="text-sm font-semibold text-white">{exercise.name}</p>
        <p className="text-xs text-white/70">
          {exercise.sets} Sätze · {exercise.reps}
          {showGif ? ' · Form-Demo' : ''}
        </p>
      </div>
    </div>
  )
}

function FormDemoFallback({ exercise }: { exercise: WorkoutExercise }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 p-6">
      <span className="text-5xl" aria-hidden>
        {exercise.emoji}
      </span>
      <p className="max-w-xs text-center text-sm text-[var(--app-text-muted)]">{exercise.tip}</p>
    </div>
  )
}

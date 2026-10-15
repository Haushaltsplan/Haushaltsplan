'use client'

import { useEffect, useRef, useState } from 'react'
import type { WorkoutExercise } from '@/lib/trainingsplan/types'

/**
 * Zeigt eine echte Person bei der Übungsausführung (looping Demo-GIF).
 * Optionaler MP4-Fallback — GIF hat Vorrang, weil zuverlässiger und formklar.
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
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--app-border)] bg-gradient-to-br from-zinc-900 to-black">
      {showGif ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={exercise.id}
          src={exercise.demoGifUrl}
          alt={`Demo: ${exercise.name}`}
          className="h-full w-full object-contain bg-black"
          onError={() => setGifFailed(true)}
        />
      ) : showVideo ? (
        <video
          ref={videoRef}
          key={`vid-${exercise.id}`}
          className="h-full w-full object-cover"
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 py-3">
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

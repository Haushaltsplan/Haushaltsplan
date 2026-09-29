'use client'

import {
  appModalScrollHiddenClassName,
  whoopModalBackdropClassName,
  whoopModalPanelClassName,
} from '@/lib/app-modal-overlay'
import { lockAppScroll } from '@/lib/app-scroll-lock'
import { useEffect } from 'react'

export type StravaInfoModalState = { title: string; body: string } | null

export function StravaInfoModal({
  state,
  onClose,
}: {
  state: StravaInfoModalState
  onClose: () => void
}) {
  useEffect(() => {
    if (!state) return
    const unlock = lockAppScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, [state, onClose])

  if (!state) return null

  return (
    <div
      className={whoopModalBackdropClassName}
      role="dialog"
      aria-modal
      aria-labelledby="strava-info-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[8px] transition-opacity"
        aria-label="Schließen"
        onClick={onClose}
      />

      <div
        className={`${whoopModalPanelClassName} animate-in fade-in slide-in-from-bottom-4 duration-300 sm:zoom-in-95 sm:slide-in-from-bottom-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="flex shrink-0 justify-center pt-3 sm:hidden" aria-hidden>
          <div className="h-1 w-9 rounded-full bg-white/20" />
        </div>

        <div className="flex shrink-0 items-start gap-3 border-b border-white/[0.06] px-5 pb-4 pt-3 sm:pt-5">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-sm text-[var(--app-text)] ring-1 ring-white/[0.08]">
            ⓘ
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">Erklärung</p>
            <h2 id="strava-info-title" className="mt-1 text-base font-semibold leading-snug text-white">
              {state.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-[var(--app-text-muted)] transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Schließen"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <div className={`${appModalScrollHiddenClassName} px-5 py-4`}>
            <p className="text-[15px] leading-[1.65] text-[var(--app-text)]">{state.body}</p>
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0a0b0d] via-[#0a0b0d]/80 to-transparent"
            aria-hidden
          />
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-[#0a0b0d]/90 px-5 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-white/[0.08] py-3 text-sm font-semibold text-white ring-1 ring-white/[0.08] transition hover:bg-white/[0.12] active:scale-[0.99]"
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  )
}

export function stravaInfo(title: string, body: string): StravaInfoModalState {
  return { title, body }
}

export function StravaChartHeader({
  title,
  onInfo,
}: {
  title: string
  onInfo?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onInfo}
      className={`mb-3 flex w-full items-center justify-between text-left ${onInfo ? 'cursor-pointer hover:opacity-90' : ''}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">{title}</p>
      <span className="text-[var(--app-text-muted)]">{onInfo ? 'ⓘ' : '›'}</span>
    </button>
  )
}

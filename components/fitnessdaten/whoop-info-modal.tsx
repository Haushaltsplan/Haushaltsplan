'use client'

import {
  appModalScrollHiddenClassName,
  whoopModalBackdropClassName,
  whoopModalPanelClassName,
} from '@/lib/app-modal-overlay'
import { lockAppScroll } from '@/lib/app-scroll-lock'
import type { MetricInfo } from '@/lib/fitnessdaten/metric-explanations'
import { useEffect } from 'react'

export function WhoopInfoModal({
  info,
  onClose,
}: {
  info: MetricInfo | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!info) return
    const unlock = lockAppScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, [info, onClose])

  if (!info) return null

  return (
    <div
      className={whoopModalBackdropClassName}
      role="dialog"
      aria-modal
      aria-labelledby="whoop-info-title"
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
            <h2 id="whoop-info-title" className="mt-1 text-base font-semibold leading-snug text-white">
              {info.title}
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
            <p className="text-[15px] leading-[1.65] text-[var(--app-text)]">{info.body}</p>
            {info.source ? (
              <p className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                <span className="font-semibold text-[var(--app-text-muted)]">Quelle in Omnia</span>
                <span className="mt-1 block text-[var(--app-text-muted)]">{info.source}</span>
              </p>
            ) : null}
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

export function WhoopChartHeader({
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

export function WhoopSyncBanner({
  status,
  message,
  lastSyncedAt,
  historicalCount,
  onInfo,
}: {
  status: string
  message: string | null
  lastSyncedAt: string | null
  historicalCount: number
  onInfo?: () => void
}) {
  if (status === 'idle' && !message) return null

  const tone =
    status === 'syncing'
      ? 'border-blue-500/30 bg-blue-950/30 text-blue-100'
      : status === 'offline'
        ? 'border-amber-500/30 bg-amber-950/25 text-amber-100'
        : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-100'

  return (
    <button
      type="button"
      onClick={onInfo}
      className={`mt-4 w-full rounded-xl border px-4 py-3 text-left text-xs leading-relaxed ${tone}`}
    >
      <p className="font-semibold">
        {status === 'syncing'
          ? 'Synchronisiere …'
          : status === 'offline'
            ? 'Offline'
            : 'Verbunden'}
      </p>
      {message ? <p className="mt-1 opacity-90">{message}</p> : null}
      {lastSyncedAt ? (
        <p className="mt-1 text-[10px] opacity-70">
          Letzte Sync: {new Date(lastSyncedAt).toLocaleString('de-DE')}
          {historicalCount > 0 ? ` · ${historicalCount} Historie-Pakete` : ''}
        </p>
      ) : null}
    </button>
  )
}

export function WhoopCoachBar({ text, onExpand }: { text: string; onExpand?: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="fixed bottom-24 left-4 right-4 z-20 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-violet-900/40 bg-[#0a0a0c]/95 px-4 py-3 text-left shadow-lg backdrop-blur-md sm:left-auto sm:right-6 sm:max-w-md"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-900/50 text-xs font-bold text-violet-200">
        O
      </span>
      <p className="line-clamp-2 flex-1 text-xs leading-snug text-[var(--app-text)]">{text}</p>
      <span className="text-[var(--app-text-muted)]">⌃</span>
    </button>
  )
}

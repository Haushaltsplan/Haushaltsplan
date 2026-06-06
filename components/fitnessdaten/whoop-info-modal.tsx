'use client'

import type { MetricInfo } from '@/lib/fitnessdaten/metric-explanations'

export function WhoopInfoModal({
  info,
  onClose,
}: {
  info: MetricInfo | null
  onClose: () => void
}) {
  if (!info) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="whoop-info-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141618] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="whoop-info-title" className="text-base font-bold text-white">
            {info.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-white/5 hover:text-white"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{info.body}</p>
        {info.source ? (
          <p className="mt-3 text-[11px] text-zinc-500">
            <span className="font-semibold text-zinc-400">Quelle in Omnia:</span> {info.source}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
        >
          Verstanden
        </button>
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
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">{title}</p>
      <span className="text-zinc-600">{onInfo ? 'ⓘ' : '›'}</span>
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
      <p className="line-clamp-2 flex-1 text-xs leading-snug text-zinc-300">{text}</p>
      <span className="text-zinc-500">⌃</span>
    </button>
  )
}

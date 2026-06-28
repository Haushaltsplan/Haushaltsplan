'use client'

import { useRef } from 'react'

type Props = {
  previewUrl: string | null
  busy?: boolean
  label?: string
  onPick: (file: File) => void
  onRemove: () => void
}

export function BesitzFotoUpload({ previewUrl, busy, label = 'Foto', onPick, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">{label}</label>
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] shadow-inner">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[11px] text-[var(--app-text-muted)]">
              <span className="text-2xl opacity-40">👕</span>
              <span>Kein Foto</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex w-fit items-center justify-center rounded-xl border border-dashed border-amber-700/55 px-4 py-2.5 text-sm font-semibold text-amber-200/95 transition hover:bg-amber-950/25 disabled:opacity-40"
          >
            {previewUrl ? 'Foto ersetzen …' : 'Foto hinzufügen …'}
          </button>
          {previewUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="inline-flex w-fit rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-semibold text-rose-300/95 transition hover:bg-rose-500/10 disabled:opacity-40"
            >
              Foto entfernen
            </button>
          ) : null}
          <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">JPEG, PNG oder WebP — wird automatisch verkleinert.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
    </div>
  )
}

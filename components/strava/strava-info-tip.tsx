'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { useId, useState } from 'react'

type Props = {
  text: string
  label?: string
  /** Inline unter der Überschrift statt Popover */
  variant?: 'inline' | 'compact'
}

export function StravaInfoTip({ text, label = 'Was bedeutet das?', variant = 'inline' }: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  if (variant === 'compact') {
    return (
      <div className="relative max-w-xs">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
          className={[
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
            'border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent',
            'text-[10px] font-medium italic text-zinc-500',
            'hover:border-orange-500/25 hover:text-orange-200/90',
            STRAVA_INTERACTIVE,
            open ? 'border-orange-500/30 bg-orange-500/10 text-orange-200/90' : '',
          ].join(' ')}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          i
        </button>
        {open ? (
          <div
            id={panelId}
            className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-white/[0.08] bg-[#0c0d0f]/95 px-3.5 py-3 text-[11px] leading-relaxed text-zinc-400 shadow-xl backdrop-blur-md"
            style={{ borderLeftColor: `${STRAVA_COLORS.orange}44`, borderLeftWidth: 2 }}
          >
            {text}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={[
          'group flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left',
          'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]',
          STRAVA_INTERACTIVE,
          open ? 'border-orange-500/20 bg-orange-500/[0.06]' : '',
        ].join(' ')}
      >
        <span
          className={[
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium italic',
            open ? 'bg-orange-500/20 text-orange-200' : 'bg-white/[0.06] text-zinc-500 group-hover:text-zinc-400',
          ].join(' ')}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          i
        </span>
        <span className="text-[11px] font-medium tracking-wide text-zinc-500 group-hover:text-zinc-400">
          {open ? 'Erklärung ausblenden' : label}
        </span>
        <span
          className="ml-auto text-[10px] text-zinc-600 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        >
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="mt-2 rounded-xl border border-l-2 border-white/[0.06] px-4 py-3 text-[12px] leading-relaxed text-zinc-400"
          style={{ borderLeftColor: `${STRAVA_COLORS.orange}66` }}
        >
          {text}
        </div>
      ) : null}
    </div>
  )
}

/** Erklärung direkt unter dem Panel-Titel (kompakter Toggle). */
export function StravaInfoBlock({ text, open, onToggle }: { text: string; open: boolean; onToggle: () => void }) {
  const panelId = useId()
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Erklärung"
        onClick={onToggle}
        className={[
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          'border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent',
          'text-[10px] font-medium italic text-zinc-500',
          'hover:border-orange-500/30 hover:text-orange-200/80',
          STRAVA_INTERACTIVE,
          open ? 'border-orange-500/35 text-orange-200/90' : '',
        ].join(' ')}
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        i
      </button>
      {open ? (
        <p
          id={panelId}
          className="col-span-full mt-2 border-l border-orange-500/25 pl-3 text-[12px] leading-relaxed text-zinc-400/95"
        >
          {text}
        </p>
      ) : null}
    </>
  )
}

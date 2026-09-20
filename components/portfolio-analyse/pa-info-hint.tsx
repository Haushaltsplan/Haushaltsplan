'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChartInfoUrteil } from '@/lib/portfolio-analyse/fundamental-chart-info-check'

export type PaInfoHintInhalt = {
  schauen: string
  gut: string
  schlecht: string
  /** Regelbasierte Ampel für die aktuelle Aktie (optional). */
  urteil?: ChartInfoUrteil | null
}

function urteilKlassen(status: ChartInfoUrteil['status']): string {
  switch (status) {
    case 'gut':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    case 'gemischt':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
    case 'achtung':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
    default:
      return 'border-white/10 bg-white/[0.04] text-[var(--app-text-muted)]'
  }
}

export function PaInfoHint({
  info,
  label = 'Was zeigt dieser Chart?',
}: {
  info: PaInfoHintInhalt
  label?: string
}) {
  const panelId = useId()
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null)
  const open = hover || pinned

  const clearHide = () => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  const scheduleHide = () => {
    clearHide()
    hideTimer.current = window.setTimeout(() => setHover(false), 120)
  }

  const updatePos = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = 320
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, r.left + r.width / 2 - width / 2))
    const flip = window.innerHeight - r.bottom < 280
    setPos({ top: flip ? r.top - 8 : r.bottom + 8, left, flip })
  }

  useEffect(() => {
    if (!open) return
    updatePos()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setHover(false)
      }
    }
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setPinned(false)
      setHover(false)
    }
    const onScroll = () => updatePos()
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  useEffect(() => () => clearHide(), [])

  const urteil = info.urteil

  return (
    <span className="relative inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onMouseEnter={() => {
          clearHide()
          setHover(true)
          updatePos()
        }}
        onMouseLeave={scheduleHide}
        onFocus={() => {
          setHover(true)
          updatePos()
        }}
        onBlur={() => {
          if (!pinned) setHover(false)
        }}
        onClick={() => {
          setPinned((v) => !v)
          updatePos()
        }}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold leading-none transition ${
          open
            ? 'border-sky-400/50 bg-sky-500/15 text-sky-200'
            : 'border-[var(--app-border-strong)] text-[var(--app-text-muted)] hover:border-sky-400/40 hover:text-sky-200'
        }`}
      >
        i
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="tooltip"
              onMouseEnter={clearHide}
              onMouseLeave={() => {
                setHover(false)
                if (!pinned) scheduleHide()
              }}
              className="fixed z-[80] w-[min(20rem,calc(100vw-16px))] rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]/95 p-3 text-left shadow-xl shadow-black/50 ring-1 ring-white/[0.06] backdrop-blur-md"
              style={{
                top: pos.top,
                left: pos.left,
                transform: pos.flip ? 'translateY(-100%)' : undefined,
              }}
            >
              {urteil ? (
                <div className={`mb-2 rounded-lg border px-2.5 py-2 ${urteilKlassen(urteil.status)}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                    Diese Aktie · {urteil.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed">{urteil.text}</p>
                </div>
              ) : null}
              <p className="text-[11px] leading-relaxed text-[var(--app-text)]">{info.schauen}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">Gut</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--app-text-muted)]">{info.gut}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-rose-400/90">Achtung</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--app-text-muted)]">{info.schlecht}</p>
            </div>,
            document.body,
          )
        : null}
    </span>
  )
}

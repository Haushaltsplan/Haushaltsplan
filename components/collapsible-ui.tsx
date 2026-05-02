import type { ReactNode } from 'react'

const cn = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

type Tone = 'neutral' | 'emerald' | 'sky' | 'violet' | 'amber' | 'teal' | 'orange'

const toneFocus: Record<Tone, string> = {
  neutral: 'focus-visible:ring-slate-400/35',
  emerald: 'focus-visible:ring-emerald-500/40',
  sky: 'focus-visible:ring-sky-500/40',
  violet: 'focus-visible:ring-violet-500/45',
  amber: 'focus-visible:ring-amber-500/40',
  teal: 'focus-visible:ring-teal-500/40',
  orange: 'focus-visible:ring-orange-500/40',
}

const toneChevron: Record<Tone, string> = {
  neutral: 'border-slate-500/25 text-slate-200',
  emerald: 'border-emerald-500/25 text-emerald-200/90',
  sky: 'border-sky-500/25 text-sky-200/90',
  violet: 'border-violet-500/30 text-violet-200/90',
  amber: 'border-amber-500/25 text-amber-100/90',
  teal: 'border-teal-500/30 text-teal-200/90',
  orange: 'border-orange-500/30 text-orange-200/90',
}

export function CollapsibleChevron({ open, tone = 'neutral', size = 'md' }: { open: boolean; tone?: Tone; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-7 w-7 rounded-lg' : 'h-8 w-8 rounded-[10px] sm:h-9 sm:w-9'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border bg-gradient-to-b from-white/[0.1] to-slate-950/55 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]',
        s,
        toneChevron[tone],
      )}
      aria-hidden
    >
      <svg
        className={cn('h-3.5 w-3.5 transition-transform duration-300 ease-out will-change-transform sm:h-4 sm:w-4', open && 'rotate-180')}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  )
}

type CollapsibleLabels = { open: string; closed: string }

/** Einheitliche Klapp-Pille (weiße Schrift) — z. B. Investments. */
export type DisclosureSurface = 'default' | 'glass'

const disclosureGlassShell =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[11px] font-medium tracking-wide text-white shadow-md shadow-black/25 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/[0.12]'

function DisclosureGlassChevron({ open }: { open?: boolean }) {
  return (
    <svg
      className={cn(
        'h-3 w-3 shrink-0 text-white transition-transform duration-300 ease-out motion-reduce:transition-none',
        open && 'rotate-180',
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function DisclosureGlassChevronDetails() {
  return (
    <svg
      className="h-3 w-3 shrink-0 text-white transition-transform duration-300 ease-out motion-reduce:transition-none group-open:rotate-180"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export const LABEL_EINKLAPPEN: CollapsibleLabels = { open: 'Einklappen', closed: 'Aufklappen' }
export const LABEL_ZUKLAPPEN: CollapsibleLabels = { open: 'Zuklappen', closed: 'Aufklappen' }

export function CollapsibleTriggerEnd({
  open,
  labels = LABEL_EINKLAPPEN,
  tone = 'neutral',
  size = 'md',
  surface = 'default',
  className,
}: {
  open: boolean
  labels?: CollapsibleLabels
  tone?: Tone
  size?: 'sm' | 'md'
  surface?: DisclosureSurface
  className?: string
}) {
  if (surface === 'glass') {
    return (
      <div className={cn(disclosureGlassShell, className)} title={open ? labels.open : labels.closed}>
        <span className="select-none whitespace-nowrap text-white">{open ? labels.open : labels.closed}</span>
        <DisclosureGlassChevron open={open} />
      </div>
    )
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-2 sm:gap-2.5', className)}>
      <span
        className="hidden min-[360px]:inline text-[10px] font-medium tracking-[0.12em] text-slate-500 transition-colors group-hover:text-slate-200 sm:text-[11px]"
        title={open ? labels.open : labels.closed}
      >
        {open ? labels.open : labels.closed}
      </span>
      <CollapsibleChevron open={open} tone={tone} size={size} />
    </div>
  )
}

/** Eleganter Vollbalken-Kopf: linke Inhalte + Klapp-Steuerung rechts. `group` am umschließenden <button> setzen. */
export function CollapsibleRowHeaderEnd(props: {
  open: boolean
  labels?: CollapsibleLabels
  tone?: Tone
  size?: 'sm' | 'md'
  surface?: DisclosureSurface
}) {
  return <CollapsibleTriggerEnd {...props} className="shrink-0" />
}

/**
 * Gleiche Optik wie CollapsibleTriggerEnd, für natives `<details class="group">`.
 * Text per CSS: zu / auf (labels.open / .closed); Chevron mit `group-open:rotate-180`.
 */
export function DetailsDisclosureChevron({ tone = 'neutral', size = 'md' }: { tone?: Tone; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-7 w-7 rounded-lg' : 'h-8 w-8 rounded-[10px] sm:h-9 sm:w-9'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border bg-gradient-to-b from-white/[0.1] to-slate-950/55 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]',
        s,
        toneChevron[tone],
      )}
      aria-hidden
    >
      <svg
        className="h-3.5 w-3.5 transition-transform duration-300 ease-out will-change-transform group-open:rotate-180 sm:h-4 sm:w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  )
}

export function DetailsDisclosureTriggerEnd({
  labels = LABEL_EINKLAPPEN,
  tone = 'neutral',
  size = 'md',
  surface = 'default',
}: {
  labels?: CollapsibleLabels
  tone?: Tone
  size?: 'sm' | 'md'
  surface?: DisclosureSurface
}) {
  if (surface === 'glass') {
    return (
      <div className={cn(disclosureGlassShell)}>
        <span className="group-open:hidden select-none whitespace-nowrap text-white">{labels.closed}</span>
        <span className="hidden select-none whitespace-nowrap text-white group-open:inline">{labels.open}</span>
        <DisclosureGlassChevronDetails />
      </div>
    )
  }

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
      <span className="hidden min-[360px]:inline text-[10px] font-medium tracking-[0.12em] text-slate-500 transition-colors group-hover:text-slate-200 sm:text-[11px]">
        <span className="group-open:hidden">{labels.closed}</span>
        <span className="hidden group-open:inline">{labels.open}</span>
      </span>
      <DetailsDisclosureChevron tone={tone} size={size} />
    </div>
  )
}

/** Kompakter Klapp-Button (z. B. neben Titel) — Pill mit Text + Chevron. */
export function CollapsiblePillButton({
  open,
  onClick,
  labels = LABEL_ZUKLAPPEN,
  tone = 'emerald',
  compact = false,
  surface = 'default',
  'aria-expanded': ariaExpanded,
}: {
  open: boolean
  onClick: () => void
  labels?: CollapsibleLabels
  tone?: Tone
  /** Schmalere Pille für enge Toolbars (z. B. Kassenzettel). */
  compact?: boolean
  surface?: DisclosureSurface
  'aria-expanded'?: boolean
}) {
  if (surface === 'glass') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={ariaExpanded}
        className={cn(
          disclosureGlassShell,
          'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        )}
      >
        <span className="select-none whitespace-nowrap text-white">{open ? labels.open : labels.closed}</span>
        <DisclosureGlassChevron open={open} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-b from-white/[0.09] to-slate-950/85 text-slate-200 shadow-lg shadow-black/25 ring-1 ring-white/[0.04] transition duration-200',
        'font-semibold',
        compact ? 'px-3 py-1.5 text-[11px]' : 'gap-2.5 px-4 py-2.5 text-xs',
        'hover:border-white/16 hover:from-white/[0.11] hover:text-white hover:shadow-xl hover:shadow-black/30',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
        toneFocus[tone],
      )}
    >
      <span className="tracking-wide">{open ? labels.open : labels.closed}</span>
      <CollapsibleChevron open={open} tone={tone} size="sm" />
    </button>
  )
}

/**
 * Inhalt mit sanftem Ein-/Ausblenden (Height per CSS Grid 0fr → 1fr).
 * Nicht in allen Bereichen sinnvoll (schwere Inhalte); optional nutzbar.
 */
export function CollapsibleAnimatedBody({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className={cn('min-h-0 overflow-hidden', !open && 'pointer-events-none', className)}>{children}</div>
    </div>
  )
}

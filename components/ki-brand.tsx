import { KI_CHIP } from '@/lib/ki-ui'

/** Einheitliches Sparkles-Symbol für alle KI-Flächen (Stroke, `currentColor`). */
export function KiSparklesIcon({
  size = 18,
  className,
}: {
  /** Kantenlänge in px */
  size?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  )
}

type KiBrandChipProps = {
  /** „KI“-Schriftzug zusätzlich zum Icon (Standard: ja). */
  showText?: boolean
  /** Icon-Größe in px (nur wenn sinnvoll neben Chip-Text). */
  iconSize?: number
  className?: string
  iconClassName?: string
  /**
   * Wenn true: `aria-hidden` auf dem Chip — neben einer sichtbaren Überschrift.
   * Wenn false: z. B. in Chat-Köpfen, wo das Label mitgelesen werden soll.
   */
  decorative?: boolean
}

/** Violetter KI-Badge: Sparkles + optional „KI“ — nutzt `KI_CHIP` aus `@/lib/ki-ui`. */
export function KiBrandChip({
  showText = true,
  iconSize = 13,
  className = '',
  iconClassName = 'shrink-0 text-violet-100 opacity-95',
  decorative = true,
}: KiBrandChipProps) {
  return (
    <span
      className={`${KI_CHIP} gap-1 ${className}`.trim()}
      {...(decorative ? { 'aria-hidden': true } : {})}
    >
      <KiSparklesIcon size={iconSize} className={iconClassName} />
      {showText ? <span>KI</span> : null}
    </span>
  )
}

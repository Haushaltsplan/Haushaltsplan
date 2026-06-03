/**
 * Maus → Datenindex für SVG-Charts mit preserveAspectRatio="meet" und Plot-Padding.
 */

export type ChartHoverLayout = {
  index: number
  /** Position der Tooltip-Mitte relativ zur Containerbreite (0–100). */
  tooltipLeftPct: number
  /** X-Mitte des Datenpunkts in ViewBox-Koordinaten. */
  dataCenterX: number
  /** Skalierung ViewBox → sichtbarer Container. */
  scale: number
  /** Horizontaler Einzug durch preserveAspectRatio. */
  offsetX: number
}

export type ChartHoverOptions = {
  /** xMinYMid → links; xMidYMid → zentriert (Standard). */
  align?: 'start' | 'mid'
  /** scrollLeft des overflow-Containers (breite SVG-Charts). */
  scrollLeft?: number
}

export function chartHoverFromClientX(
  clientX: number,
  containerRect: DOMRect,
  viewW: number,
  viewH: number,
  padLinks: number,
  padRechts: number,
  pointCount: number,
  options: ChartHoverOptions = {},
): ChartHoverLayout | null {
  if (pointCount <= 0 || containerRect.width <= 0 || containerRect.height <= 0) return null

  const align = options.align ?? 'mid'
  const scrollLeft = options.scrollLeft ?? 0

  const cw = containerRect.width
  const ch = containerRect.height
  const viewAspect = viewW / viewH
  const containerAspect = cw / ch

  let scale: number
  let offsetX: number

  if (containerAspect > viewAspect) {
    scale = ch / viewH
    const renderedW = viewW * scale
    offsetX = align === 'start' ? 0 : (cw - renderedW) / 2
  } else {
    scale = cw / viewW
    offsetX = 0
  }

  const localX = clientX - containerRect.left + scrollLeft
  const viewX = (localX - offsetX) / scale
  const plotW = viewW - padLinks - padRechts
  if (plotW <= 0) return null

  const rel = Math.min(1, Math.max(0, (viewX - padLinks) / plotW))
  const index = Math.round(rel * Math.max(0, pointCount - 1))

  const dataCenterX = padLinks + (index / Math.max(1, pointCount - 1)) * plotW
  const crosshairInContainer = offsetX + dataCenterX * scale - scrollLeft
  const tooltipLeftPct = Math.min(98, Math.max(2, (crosshairInContainer / cw) * 100))

  return { index, tooltipLeftPct, dataCenterX, scale, offsetX }
}

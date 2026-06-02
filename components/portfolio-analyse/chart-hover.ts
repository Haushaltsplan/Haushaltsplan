/**
 * Maus → Datenindex für SVG-Charts mit preserveAspectRatio="meet" und Plot-Padding.
 */

export type ChartHoverLayout = {
  index: number
  /** Position der Tooltip-Mitte relativ zur Containerbreite (0–100). */
  tooltipLeftPct: number
}

export function chartHoverFromClientX(
  clientX: number,
  containerRect: DOMRect,
  viewW: number,
  viewH: number,
  padLinks: number,
  padRechts: number,
  pointCount: number,
): ChartHoverLayout | null {
  if (pointCount <= 0 || containerRect.width <= 0 || containerRect.height <= 0) return null

  const cw = containerRect.width
  const ch = containerRect.height
  const viewAspect = viewW / viewH
  const containerAspect = cw / ch

  let scale: number
  let offsetX: number

  if (containerAspect > viewAspect) {
    scale = ch / viewH
    const renderedW = viewW * scale
    offsetX = (cw - renderedW) / 2
  } else {
    scale = cw / viewW
    offsetX = 0
  }

  const viewX = (clientX - containerRect.left - offsetX) / scale
  const plotW = viewW - padLinks - padRechts
  if (plotW <= 0) return null

  const rel = Math.min(1, Math.max(0, (viewX - padLinks) / plotW))
  const index = Math.round(rel * Math.max(0, pointCount - 1))

  const dataViewX = padLinks + (index / Math.max(1, pointCount - 1)) * plotW
  const crosshairInContainer = offsetX + dataViewX * scale
  const tooltipLeftPct = Math.min(98, Math.max(2, (crosshairInContainer / cw) * 100))

  return { index, tooltipLeftPct }
}

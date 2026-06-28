/** Theme-konforme Chart-Farben & Striche — nutzt CSS-Variablen aus globals.css. */

export const CHART_GRID = 'var(--app-chart-grid)'
export const CHART_AXIS = 'var(--app-chart-axis)'
export const CHART_TRACK = 'var(--app-chart-track)'

export const CHART = {
  positive: '#34d399',
  positiveSoft: 'rgb(52 211 153 / 0.18)',
  negative: '#fb7185',
  negativeSoft: 'rgb(251 113 133 / 0.18)',
  primary: '#5eead4',
  primarySoft: 'rgb(94 234 212 / 0.15)',
  sky: '#38bdf8',
  amber: '#fbbf24',
  violet: '#a78bfa',
  emerald: '#10b981',
  rose: '#f43f5e',
} as const

/** Dezente horizontale Hilfslinien (0–1 = von unten nach oben). */
export function chartGridLinesY(
  width: number,
  padX: number,
  padTop: number,
  padBottom: number,
  height: number,
  fractions: number[] = [0.25, 0.5, 0.75, 1],
) {
  const chartH = height - padTop - padBottom
  return fractions.map((f) => ({
    x1: padX,
    y1: padTop + (1 - f) * chartH,
    x2: width - padX,
    y2: padTop + (1 - f) * chartH,
  }))
}

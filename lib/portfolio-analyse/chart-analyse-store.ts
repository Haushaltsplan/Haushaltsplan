/**
 * Zeichnungen + Notizen je Chart (Ticker × Chart-Id).
 * Lokal sofort, Cloud über omnia_client_state.
 */

import { CLIENT_STATE_KEYS } from '@/lib/client-state/client-state-keys'

export const CHART_ANALYSE_STORAGE_KEY = 'pa-chart-analyse-v1'
export const CHART_ANALYSE_EVENT = 'pa-chart-analyse-geaendert'

export type ChartAnalyseArt =
  | 'trend'
  | 'ray'
  | 'hline'
  | 'vline'
  | 'rect'
  | 'fib'
  | 'text'
  | 'measure'

export type ChartAnalysePunkt = { nx: number; ny: number }

export type ChartAnalyseZeichnung = {
  id: string
  art: ChartAnalyseArt
  punkte: ChartAnalysePunkt[]
  farbe: string
  text?: string
}

export type ChartAnalyseEintrag = {
  zeichnungen: ChartAnalyseZeichnung[]
  notizen: string
}

export type ChartAnalyseKarte = Record<string, ChartAnalyseEintrag>

export type ChartAnalysePlot = {
  viewW: number
  viewH: number
  padL: number
  padR: number
  padT: number
  padB: number
}

export const CHART_ANALYSE_FARBEN = ['#fbbf24', '#38bdf8', '#34d399', '#fb7185', '#a78bfa', '#fafafa'] as const

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const

const LEER: ChartAnalyseEintrag = { zeichnungen: [], notizen: '' }

function istArt(v: unknown): v is ChartAnalyseArt {
  return (
    v === 'trend' ||
    v === 'ray' ||
    v === 'hline' ||
    v === 'vline' ||
    v === 'rect' ||
    v === 'fib' ||
    v === 'text' ||
    v === 'measure'
  )
}

function parsePunkt(raw: unknown): ChartAnalysePunkt | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const nx = Number(r.nx)
  const ny = Number(r.ny)
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null
  return { nx: Math.min(1, Math.max(0, nx)), ny: Math.min(1, Math.max(0, ny)) }
}

function parseZeichnung(raw: unknown): ChartAnalyseZeichnung | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!istArt(r.art) || typeof r.id !== 'string' || !r.id) return null
  const punkte = Array.isArray(r.punkte) ? r.punkte.map(parsePunkt).filter((p): p is ChartAnalysePunkt => p != null) : []
  if (punkte.length === 0) return null
  const farbe = typeof r.farbe === 'string' && r.farbe.startsWith('#') ? r.farbe : CHART_ANALYSE_FARBEN[0]
  return {
    id: r.id,
    art: r.art,
    punkte,
    farbe,
    text: typeof r.text === 'string' ? r.text : undefined,
  }
}

function parseEintrag(raw: unknown): ChartAnalyseEintrag {
  if (!raw || typeof raw !== 'object') return { ...LEER }
  const r = raw as Record<string, unknown>
  const zeichnungen = Array.isArray(r.zeichnungen)
    ? r.zeichnungen.map(parseZeichnung).filter((z): z is ChartAnalyseZeichnung => z != null)
    : []
  return {
    zeichnungen,
    notizen: typeof r.notizen === 'string' ? r.notizen : '',
  }
}

export function parseChartAnalyseKarte(raw: unknown): ChartAnalyseKarte {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: ChartAnalyseKarte = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k.trim()) continue
    const e = parseEintrag(v)
    if (e.zeichnungen.length === 0 && !e.notizen.trim()) continue
    out[k] = e
  }
  return out
}

export function leseChartAnalyseKarte(): ChartAnalyseKarte {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CHART_ANALYSE_STORAGE_KEY)
    if (!raw) return {}
    return parseChartAnalyseKarte(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

export function schreibeChartAnalyseKarte(karte: ChartAnalyseKarte): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHART_ANALYSE_STORAGE_KEY, JSON.stringify(karte))
    window.dispatchEvent(new CustomEvent(CHART_ANALYSE_EVENT))
  } catch {
    /* quota */
  }
}

export function ladeChartAnalyseEintrag(schluessel: string): ChartAnalyseEintrag {
  return parseEintrag(leseChartAnalyseKarte()[schluessel])
}

export function speichereChartAnalyseEintrag(schluessel: string, eintrag: ChartAnalyseEintrag): ChartAnalyseKarte {
  const karte = { ...leseChartAnalyseKarte() }
  const leer = eintrag.zeichnungen.length === 0 && !eintrag.notizen.trim()
  if (leer) delete karte[schluessel]
  else karte[schluessel] = eintrag
  schreibeChartAnalyseKarte(karte)
  void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
    pushClientState(CLIENT_STATE_KEYS.chartAnalyse, karte, { debounceMs: 800 })
  })
  return karte
}

export function chartAnalyseSchluessel(ticker: string, chartId: string): string {
  return `${ticker.trim().toUpperCase() || 'chart'}:${chartId.trim() || 'default'}`
}

export function neueZeichnungId(): string {
  return `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function plotZuNorm(plot: ChartAnalysePlot, viewX: number, viewY: number): ChartAnalysePunkt {
  const plotW = plot.viewW - plot.padL - plot.padR
  const plotH = plot.viewH - plot.padT - plot.padB
  const nx = plotW <= 0 ? 0 : (viewX - plot.padL) / plotW
  const ny = plotH <= 0 ? 0 : (viewY - plot.padT) / plotH
  return { nx: Math.min(1, Math.max(0, nx)), ny: Math.min(1, Math.max(0, ny)) }
}

export function normZuPlot(plot: ChartAnalysePlot, p: ChartAnalysePunkt): { x: number; y: number } {
  const plotW = plot.viewW - plot.padL - plot.padR
  const plotH = plot.viewH - plot.padT - plot.padB
  return { x: plot.padL + p.nx * plotW, y: plot.padT + p.ny * plotH }
}

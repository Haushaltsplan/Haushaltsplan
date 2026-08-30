'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { lockAppScroll } from '@/lib/app-scroll-lock'
import { CLIENT_STATE_APPLIED_EVENT, CLIENT_STATE_KEYS } from '@/lib/client-state/client-state-keys'
import {
  CHART_ANALYSE_EVENT,
  CHART_ANALYSE_FARBEN,
  FIB_LEVELS,
  ladeChartAnalyseEintrag,
  neueZeichnungId,
  normZuPlot,
  plotZuNorm,
  speichereChartAnalyseEintrag,
  type ChartAnalyseArt,
  type ChartAnalyseEintrag,
  type ChartAnalysePlot,
  type ChartAnalysePunkt,
  type ChartAnalyseZeichnung,
} from '@/lib/portfolio-analyse/chart-analyse-store'

export type ChartAnalyseWerkzeug = 'cursor' | ChartAnalyseArt

type AnalyseCtx = {
  vollbild: boolean
  setVollbild: (v: boolean) => void
  werkzeug: ChartAnalyseWerkzeug
  setWerkzeug: (w: ChartAnalyseWerkzeug) => void
  farbe: string
  setFarbe: (c: string) => void
  magnet: boolean
  setMagnet: (v: boolean) => void
  eintrag: ChartAnalyseEintrag
  setEintrag: (e: ChartAnalyseEintrag, opts?: { historisch?: boolean }) => void
  undo: () => void
  redo: () => void
  kannUndo: boolean
  kannRedo: boolean
  ausgewaehltId: string | null
  setAusgewaehltId: (id: string | null) => void
  loescheAuswahl: () => void
  titel: string
}

const Ctx = createContext<AnalyseCtx | null>(null)

export function useChartAnalyseVollbild(): boolean {
  return useContext(Ctx)?.vollbild ?? false
}

const PUNKTE_PRO_ART: Record<ChartAnalyseArt, number> = {
  trend: 2,
  ray: 2,
  hline: 1,
  vline: 1,
  rect: 2,
  fib: 2,
  text: 1,
  measure: 2,
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function distZuStrecke(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.min(1, Math.max(0, t))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

function trefferZeichnung(
  z: ChartAnalyseZeichnung,
  plot: ChartAnalysePlot,
  view: { x: number; y: number },
  tol: number,
): boolean {
  const pts = z.punkte.map((p) => normZuPlot(plot, p))
  if (pts.length === 0) return false
  if (z.art === 'hline' && pts[0]) return Math.abs(view.y - pts[0].y) <= tol
  if (z.art === 'vline' && pts[0]) return Math.abs(view.x - pts[0].x) <= tol
  if (z.art === 'text' && pts[0]) return dist(view, pts[0]) <= tol * 1.4
  if ((z.art === 'rect' || z.art === 'fib' || z.art === 'measure') && pts[0] && pts[1]) {
    const x0 = Math.min(pts[0].x, pts[1].x)
    const x1 = Math.max(pts[0].x, pts[1].x)
    const y0 = Math.min(pts[0].y, pts[1].y)
    const y1 = Math.max(pts[0].y, pts[1].y)
    if (z.art === 'rect') {
      return view.x >= x0 - tol && view.x <= x1 + tol && view.y >= y0 - tol && view.y <= y1 + tol
    }
    return distZuStrecke(view, pts[0], pts[1]) <= tol
  }
  if (pts[0] && pts[1]) return distZuStrecke(view, pts[0], pts[1]) <= tol
  return pts[0] ? dist(view, pts[0]) <= tol : false
}

function rayEnde(
  plot: ChartAnalysePlot,
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  const x0 = plot.padL
  const x1 = plot.viewW - plot.padR
  const y0 = plot.padT
  const y1 = plot.viewH - plot.padB
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return b
  let tMax = 8
  const ts: number[] = []
  if (dx > 0) ts.push((x1 - a.x) / dx)
  if (dx < 0) ts.push((x0 - a.x) / dx)
  if (dy > 0) ts.push((y1 - a.y) / dy)
  if (dy < 0) ts.push((y0 - a.y) / dy)
  for (const t of ts) {
    if (t > 1.02 && t < tMax) tMax = t
  }
  return { x: a.x + dx * tMax, y: a.y + dy * tMax }
}

function viewAusClient(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

const WERKZEUGE: { id: ChartAnalyseWerkzeug; label: string; hint: string }[] = [
  { id: 'cursor', label: 'Maus', hint: 'Auswählen · Entf löscht' },
  { id: 'trend', label: 'Trend', hint: 'Trendlinie · zwei Klicks' },
  { id: 'ray', label: 'Strahl', hint: 'Strahl · zwei Klicks' },
  { id: 'hline', label: 'H-Linie', hint: 'Waagrechte' },
  { id: 'vline', label: 'V-Linie', hint: 'Senkrechte' },
  { id: 'rect', label: 'Rechteck', hint: 'Bereich markieren' },
  { id: 'fib', label: 'Fib', hint: 'Fibonacci · zwei Klicks' },
  { id: 'measure', label: 'Maß', hint: 'Abstand messen' },
  { id: 'text', label: 'Text', hint: 'Beschriftung' },
]

function IconExpand({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  )
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

export function PaChartAnalyseProvider({
  schluessel,
  titel,
  children,
}: {
  schluessel: string
  titel: string
  children: ReactNode
}) {
  const [vollbild, setVollbild] = useState(false)
  const [werkzeug, setWerkzeug] = useState<ChartAnalyseWerkzeug>('cursor')
  const [farbe, setFarbe] = useState<string>(CHART_ANALYSE_FARBEN[0]!)
  const [magnet, setMagnet] = useState(true)
  const [eintrag, setEintragState] = useState<ChartAnalyseEintrag>(() => ladeChartAnalyseEintrag(schluessel))
  const [ausgewaehltId, setAusgewaehltId] = useState<string | null>(null)
  const [notizenOffen, setNotizenOffen] = useState(true)
  const undoStack = useRef<ChartAnalyseEintrag[]>([])
  const redoStack = useRef<ChartAnalyseEintrag[]>([])
  const [, tick] = useState(0)

  useEffect(() => {
    setEintragState(ladeChartAnalyseEintrag(schluessel))
    undoStack.current = []
    redoStack.current = []
    setAusgewaehltId(null)
  }, [schluessel])

  useEffect(() => {
    const reload = () => setEintragState(ladeChartAnalyseEintrag(schluessel))
    window.addEventListener(CHART_ANALYSE_EVENT, reload)
    const onApplied = (ev: Event) => {
      const key = (ev as CustomEvent<{ schluessel?: string }>).detail?.schluessel
      if (key === CLIENT_STATE_KEYS.chartAnalyse) reload()
    }
    window.addEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
    return () => {
      window.removeEventListener(CHART_ANALYSE_EVENT, reload)
      window.removeEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
    }
  }, [schluessel])

  useEffect(() => {
    if (!vollbild) return
    const unlock = lockAppScroll()
    return unlock
  }, [vollbild])

  const persist = useCallback(
    (next: ChartAnalyseEintrag, opts?: { historisch?: boolean }) => {
      if (opts?.historisch !== false) {
        undoStack.current = [...undoStack.current, eintrag].slice(-40)
        redoStack.current = []
      }
      setEintragState(next)
      speichereChartAnalyseEintrag(schluessel, next)
      tick((n) => n + 1)
    },
    [eintrag, schluessel],
  )

  const setEintrag = useCallback(
    (next: ChartAnalyseEintrag, opts?: { historisch?: boolean }) => persist(next, opts),
    [persist],
  )

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(eintrag)
    setEintragState(prev)
    speichereChartAnalyseEintrag(schluessel, prev)
    tick((n) => n + 1)
  }, [eintrag, schluessel])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(eintrag)
    setEintragState(next)
    speichereChartAnalyseEintrag(schluessel, next)
    tick((n) => n + 1)
  }, [eintrag, schluessel])

  const loescheAuswahl = useCallback(() => {
    if (!ausgewaehltId) return
    persist({
      ...eintrag,
      zeichnungen: eintrag.zeichnungen.filter((z) => z.id !== ausgewaehltId),
    })
    setAusgewaehltId(null)
  }, [ausgewaehltId, eintrag, persist])

  useEffect(() => {
    if (!vollbild) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (werkzeug !== 'cursor') {
          setWerkzeug('cursor')
          e.preventDefault()
          return
        }
        setVollbild(false)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && ausgewaehltId) {
        const t = e.target as HTMLElement | null
        if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
        e.preventDefault()
        loescheAuswahl()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [vollbild, werkzeug, ausgewaehltId, loescheAuswahl, undo, redo])

  const api = useMemo<AnalyseCtx>(
    () => ({
      vollbild,
      setVollbild,
      werkzeug,
      setWerkzeug,
      farbe,
      setFarbe,
      magnet,
      setMagnet,
      eintrag,
      setEintrag,
      undo,
      redo,
      kannUndo: undoStack.current.length > 0,
      kannRedo: redoStack.current.length > 0,
      ausgewaehltId,
      setAusgewaehltId,
      loescheAuswahl,
      titel,
    }),
    [
      vollbild,
      werkzeug,
      farbe,
      magnet,
      eintrag,
      setEintrag,
      undo,
      redo,
      ausgewaehltId,
      loescheAuswahl,
      titel,
    ],
  )

  return (
    <Ctx.Provider value={api}>
      <div className={vollbild ? 'fixed inset-0 z-[80] flex bg-[var(--app-bg)]' : 'contents'}>
        {vollbild ? <AnalyseWerkzeugLeiste /> : null}
        <div className={vollbild ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col' : 'contents'}>
          {vollbild ? (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--app-border)] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--app-text)]">{titel}</p>
                <p className="text-[10px] text-[var(--app-text-muted)]">
                  Chartanalyse · Esc schließt · Entf löscht Auswahl
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setNotizenOffen((v) => !v)}
                  className="rounded-md px-2 py-1 text-[11px] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
                >
                  {notizenOffen ? 'Notizen aus' : 'Notizen'}
                </button>
                <button
                  type="button"
                  onClick={() => setVollbild(false)}
                  className="rounded-lg p-1.5 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
                  aria-label="Vollbild schließen"
                >
                  <IconClose className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : null}
          <div className={vollbild ? 'min-h-0 flex-1 overflow-hidden' : 'contents'}>{children}</div>
        </div>
        {vollbild && notizenOffen ? <AnalyseNotizenPanel /> : null}
      </div>
    </Ctx.Provider>
  )
}

export function PaChartAnalyseExpandButton() {
  const ctx = useContext(Ctx)
  if (!ctx || ctx.vollbild) return null
  return (
    <button
      type="button"
      onClick={() => ctx.setVollbild(true)}
      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-medium text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
      aria-label="Chart im Vollbild analysieren"
      title="Vollbild mit Zeichenwerkzeugen und Notizen"
    >
      <IconExpand className="h-4 w-4" />
      <span>Analyse</span>
    </button>
  )
}

function AnalyseWerkzeugLeiste() {
  const ctx = useContext(Ctx)
  if (!ctx) return null
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-[var(--app-border)] bg-[var(--app-surface-muted)] py-2">
      {WERKZEUGE.map((w) => (
        <button
          key={w.id}
          type="button"
          title={w.hint}
          onClick={() => ctx.setWerkzeug(w.id)}
          className={`w-11 rounded-md px-1 py-1.5 text-[9px] font-medium leading-tight ${
            ctx.werkzeug === w.id
              ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/35'
              : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'
          }`}
        >
          {w.label}
        </button>
      ))}
      <div className="my-1 h-px w-8 bg-[var(--app-border)]" />
      {CHART_ANALYSE_FARBEN.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => ctx.setFarbe(c)}
          className="h-4 w-4 rounded-full ring-offset-1 ring-offset-[var(--app-surface-muted)]"
          style={{
            background: c,
            boxShadow: ctx.farbe === c ? `0 0 0 2px ${c}` : '0 0 0 1px #3f3f46',
          }}
          aria-label={`Farbe ${c}`}
        />
      ))}
      <button
        type="button"
        title="Magnet am Datenpunkt"
        onClick={() => ctx.setMagnet(!ctx.magnet)}
        className={`mt-1 w-11 rounded-md px-1 py-1 text-[9px] font-medium ${
          ctx.magnet ? 'bg-sky-500/20 text-sky-200' : 'text-[var(--app-text-muted)]'
        }`}
      >
        Magnet
      </button>
      <button
        type="button"
        disabled={!ctx.kannUndo}
        onClick={ctx.undo}
        className="w-11 rounded-md px-1 py-1 text-[9px] text-[var(--app-text-muted)] disabled:opacity-30"
      >
        Rückgängig
      </button>
      <button
        type="button"
        disabled={!ctx.kannRedo}
        onClick={ctx.redo}
        className="w-11 rounded-md px-1 py-1 text-[9px] text-[var(--app-text-muted)] disabled:opacity-30"
      >
        Wiederholen
      </button>
      <button
        type="button"
        disabled={!ctx.ausgewaehltId}
        onClick={ctx.loescheAuswahl}
        className="w-11 rounded-md px-1 py-1 text-[9px] text-rose-300/80 disabled:opacity-30"
      >
        Löschen
      </button>
    </div>
  )
}

function AnalyseNotizenPanel() {
  const ctx = useContext(Ctx)
  if (!ctx) return null
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[var(--app-border)] bg-[var(--app-surface-muted)]">
      <div className="border-b border-[var(--app-border)] px-3 py-2">
        <p className="text-xs font-semibold text-[var(--app-text)]">Notizen</p>
        <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">
          {ctx.eintrag.zeichnungen.length} Zeichnung{ctx.eintrag.zeichnungen.length === 1 ? '' : 'en'} · bleibt je
          Chart gespeichert
        </p>
      </div>
      <textarea
        value={ctx.eintrag.notizen}
        onChange={(e) => ctx.setEintrag({ ...ctx.eintrag, notizen: e.target.value }, { historisch: false })}
        placeholder="These, Levels, offene Fragen …"
        className="min-h-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-muted)]"
      />
      {ctx.eintrag.zeichnungen.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            if (!confirm('Alle Zeichnungen auf diesem Chart löschen?')) return
            ctx.setEintrag({ ...ctx.eintrag, zeichnungen: [] })
            ctx.setAusgewaehltId(null)
          }}
          className="border-t border-[var(--app-border)] px-3 py-2 text-left text-[11px] text-rose-300/80 hover:bg-[var(--app-surface-hover)]"
        >
          Alle Zeichnungen löschen
        </button>
      ) : null}
    </aside>
  )
}

export function PaChartAnalyseOverlay({
  svgRef,
  plot,
  snapPunkte = [],
}: {
  svgRef: { current: SVGSVGElement | null }
  plot: ChartAnalysePlot
  snapPunkte?: { x: number; y: number }[]
}) {
  const ctx = useContext(Ctx)
  const overlayRef = useRef<SVGSVGElement>(null)
  const [entwurf, setEntwurf] = useState<ChartAnalysePunkt[]>([])
  const [cursor, setCursor] = useState<ChartAnalysePunkt | null>(null)
  const [textPos, setTextPos] = useState<{ nx: number; ny: number } | null>(null)
  const [textWert, setTextWert] = useState('')

  if (!ctx?.vollbild) return null

  const snap = (view: { x: number; y: number }): { x: number; y: number } => {
    if (!ctx.magnet || snapPunkte.length === 0) return view
    let best = view
    let bestD = 14
    for (const p of snapPunkte) {
      const d = dist(view, p)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    return best
  }

  const commit = (punkte: ChartAnalysePunkt[], art: ChartAnalyseArt, text?: string) => {
    const z: ChartAnalyseZeichnung = {
      id: neueZeichnungId(),
      art,
      punkte,
      farbe: ctx.farbe,
      text,
    }
    ctx.setEintrag({ ...ctx.eintrag, zeichnungen: [...ctx.eintrag.zeichnungen, z] })
    ctx.setAusgewaehltId(z.id)
    setEntwurf([])
    setCursor(null)
    if (art !== 'text') ctx.setWerkzeug('cursor')
  }

  const onPointer = (e: ReactPointerEvent<SVGSVGElement>, kind: 'move' | 'down') => {
    const svg = overlayRef.current ?? svgRef.current
    if (!svg) return
    const raw = viewAusClient(svg, e.clientX, e.clientY)
    if (!raw) return
    const view = snap(raw)
    const norm = plotZuNorm(plot, view.x, view.y)
    if (kind === 'move') {
      setCursor(norm)
      return
    }
    if (ctx.werkzeug === 'cursor') {
      const hit = [...ctx.eintrag.zeichnungen].reverse().find((z) => trefferZeichnung(z, plot, view, 10))
      ctx.setAusgewaehltId(hit?.id ?? null)
      return
    }
    if (ctx.werkzeug === 'text') {
      setTextPos(norm)
      setTextWert('')
      return
    }
    const art = ctx.werkzeug
    const braucht = PUNKTE_PRO_ART[art]
    const next = [...entwurf, norm]
    if (next.length >= braucht) {
      commit(next.slice(0, braucht), art)
    } else {
      setEntwurf(next)
    }
  }

  const previewPts = cursor ? [...entwurf, cursor] : entwurf
  const previewArt = ctx.werkzeug === 'cursor' || ctx.werkzeug === 'text' ? null : ctx.werkzeug

  return (
    <>
      <svg
        ref={overlayRef}
        viewBox={`0 0 ${plot.viewW} ${plot.viewH}`}
        preserveAspectRatio="xMidYMid meet"
        className={`absolute inset-0 h-full w-full ${
          ctx.werkzeug === 'cursor' ? 'pointer-events-none' : 'cursor-crosshair'
        }`}
        onPointerMove={(e) => {
          if (ctx.werkzeug === 'cursor') return
          onPointer(e, 'move')
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || ctx.werkzeug === 'cursor') return
          onPointer(e, 'down')
        }}
        onPointerLeave={() => setCursor(null)}
      >
        <rect
          x={plot.padL}
          y={plot.padT}
          width={Math.max(0, plot.viewW - plot.padL - plot.padR)}
          height={Math.max(0, plot.viewH - plot.padT - plot.padB)}
          fill="transparent"
        />
        {ctx.eintrag.zeichnungen.map((z) => (
          <ZeichnungSvg
            key={z.id}
            z={z}
            plot={plot}
            aktiv={z.id === ctx.ausgewaehltId}
            onSelect={
              ctx.werkzeug === 'cursor'
                ? () => ctx.setAusgewaehltId(z.id)
                : undefined
            }
          />
        ))}
        {previewArt && previewPts.length > 0 ? (
          <ZeichnungSvg
            z={{
              id: 'preview',
              art: previewArt,
              punkte: previewPts,
              farbe: ctx.farbe,
            }}
            plot={plot}
            aktiv
            preview
          />
        ) : null}
      </svg>
      {textPos ? (
        <form
          className="absolute z-20 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] p-1.5 shadow-lg"
          style={{
            left: `${(plot.padL + textPos.nx * (plot.viewW - plot.padL - plot.padR)) / plot.viewW * 100}%`,
            top: `${(plot.padT + textPos.ny * (plot.viewH - plot.padT - plot.padB)) / plot.viewH * 100}%`,
          }}
          onSubmit={(e) => {
            e.preventDefault()
            const t = textWert.trim()
            if (t) commit([textPos], 'text', t)
            setTextPos(null)
            setTextWert('')
            ctx.setWerkzeug('cursor')
          }}
        >
          <input
            autoFocus
            value={textWert}
            onChange={(e) => setTextWert(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setTextPos(null)
              }
            }}
            placeholder="Text …"
            className="w-40 bg-transparent px-1.5 py-1 text-xs text-[var(--app-text)] outline-none"
          />
        </form>
      ) : null}
    </>
  )
}

function ZeichnungSvg({
  z,
  plot,
  aktiv,
  preview = false,
  onSelect,
}: {
  z: ChartAnalyseZeichnung
  plot: ChartAnalysePlot
  aktiv: boolean
  preview?: boolean
  onSelect?: () => void
}) {
  const pts = z.punkte.map((p) => normZuPlot(plot, p))
  const a = pts[0]
  const b = pts[1]
  const op = preview ? 0.7 : 1
  const stroke = z.farbe
  const sw = aktiv ? 2.2 : 1.5
  const pick = onSelect
    ? {
        pointerEvents: 'auto' as const,
        onPointerDown: (e: ReactPointerEvent) => {
          e.stopPropagation()
          onSelect()
        },
      }
    : {}
  if (!a) return null

  const wrap = (node: ReactNode) => (
    <g opacity={op} {...pick}>
      {node}
    </g>
  )

  if (z.art === 'hline') {
    return wrap(
      <line
        x1={plot.padL}
        y1={a.y}
        x2={plot.viewW - plot.padR}
        y2={a.y}
        stroke={stroke}
        strokeWidth={sw}
      />,
    )
  }
  if (z.art === 'vline') {
    return wrap(
      <line
        x1={a.x}
        y1={plot.padT}
        x2={a.x}
        y2={plot.viewH - plot.padB}
        stroke={stroke}
        strokeWidth={sw}
      />,
    )
  }
  if (z.art === 'text') {
    return wrap(
      <>
        <circle cx={a.x} cy={a.y} r={3.5} fill={stroke} />
        <text x={a.x + 7} y={a.y + 4} fill={stroke} style={{ fontSize: 12, fontWeight: 600 }}>
          {z.text || '…'}
        </text>
      </>,
    )
  }
  if (!b) {
    return wrap(<circle cx={a.x} cy={a.y} r={3} fill={stroke} />)
  }
  if (z.art === 'rect') {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    return wrap(
      <rect
        x={x}
        y={y}
        width={Math.abs(b.x - a.x)}
        height={Math.abs(b.y - a.y)}
        fill={stroke}
        fillOpacity={0.12}
        stroke={stroke}
        strokeWidth={sw}
      />,
    )
  }
  if (z.art === 'fib') {
    return wrap(
      <>
        {FIB_LEVELS.map((lvl) => {
          const y = a.y + (b.y - a.y) * lvl
          const x0 = Math.min(a.x, b.x)
          const x1 = Math.max(a.x, b.x)
          return (
            <g key={lvl}>
              <line x1={x0} y1={y} x2={x1} y2={y} stroke={stroke} strokeWidth={lvl === 0 || lvl === 1 ? sw : 1} />
              <text x={x1 + 4} y={y + 3} fill={stroke} style={{ fontSize: 10 }}>
                {(lvl * 100).toFixed(lvl === 0.5 ? 0 : 1)}%
              </text>
            </g>
          )
        })}
      </>,
    )
  }
  if (z.art === 'measure') {
    const dx = z.punkte[1]!.nx - z.punkte[0]!.nx
    const dy = z.punkte[0]!.ny - z.punkte[1]!.ny
    const pct = `${dy >= 0 ? '+' : ''}${(dy * 100).toFixed(1)} % der Skala`
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    return wrap(
      <>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} strokeDasharray="5 4" />
        <circle cx={a.x} cy={a.y} r={3} fill={stroke} />
        <circle cx={b.x} cy={b.y} r={3} fill={stroke} />
        <text x={mid.x} y={mid.y - 6} textAnchor="middle" fill={stroke} style={{ fontSize: 11, fontWeight: 600 }}>
          {pct}
          {Math.abs(dx) > 0.01 ? ` · Δx ${(dx * 100).toFixed(0)}%` : ''}
        </text>
      </>,
    )
  }
  const ende = z.art === 'ray' ? rayEnde(plot, a, b) : b
  return wrap(
    <>
      <line x1={a.x} y1={a.y} x2={ende.x} y2={ende.y} stroke={stroke} strokeWidth={sw} />
      <circle cx={a.x} cy={a.y} r={2.5} fill={stroke} />
      <circle cx={b.x} cy={b.y} r={2.5} fill={stroke} />
    </>,
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaFundamentalMetrikChart } from '@/components/portfolio-analyse/pa-fundamental-metrik-chart'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  generiereAktienanalyse,
  ladeAktienanalyseHistorie,
  ladeAktienanalysePrompt,
  resetAktienanalysePrompt,
  speichereAktienanalysePrompt,
} from '@/lib/portfolio-analyse/aktienanalyse-client'
import {
  AKTIENANALYSE_PROMPT_MARKER,
  type AktienanalyseBlock,
  type AktienanalyseEintrag,
} from '@/lib/portfolio-analyse/aktienanalyse-prompt'
import { thumbnailSvgAlsDataUrl } from '@/lib/portfolio-analyse/aktienanalyse-thumbnail'
import { chartAnalyseSchluessel } from '@/lib/portfolio-analyse/chart-analyse-store'
import {
  bewertungForwardChartPerioden,
  finanzdatenChartPerioden,
  letzteJahreChartPerioden,
} from '@/lib/portfolio-analyse/fundamentaldaten-chart-hilfen'
import { baueFundamentaldatenExportVollstaendig } from '@/lib/portfolio-analyse/fundamentaldaten-export-client'
import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
  FundamentalMetrikZeile,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

function thumbSrc(eintrag: AktienanalyseEintrag): string {
  if (!eintrag.thumbnailSvg) return ''
  if (eintrag.thumbnailSvg.startsWith('data:')) return eintrag.thumbnailSvg
  return thumbnailSvgAlsDataUrl(eintrag.thumbnailSvg)
}

function KiMdText({ text, serif }: { text: string; serif?: boolean }) {
  function renderInline(line: string, key: number) {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**'))
            return (
              <strong key={i} className="font-semibold text-teal-100/95">
                {part.slice(2, -2)}
              </strong>
            )
          if (part.startsWith('*') && part.endsWith('*'))
            return (
              <em key={i} className="text-[var(--app-text-muted)]">
                {part.slice(1, -1)}
              </em>
            )
          return <span key={i}>{part}</span>
        })}
      </span>
    )
  }

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.startsWith('### ')) {
      elements.push(
        <h4
          key={i}
          className="mt-6 mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-teal-400/85"
        >
          {line.slice(4)}
        </h4>,
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h3
          key={i}
          className="mt-8 mb-3 border-l-2 border-teal-400/50 pl-3 text-[1.05rem] font-semibold tracking-tight text-[var(--app-text)]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {line.slice(3)}
        </h3>,
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <h2
          key={i}
          className="mt-8 mb-3 text-xl font-semibold tracking-tight text-[var(--app-text)]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {line.slice(2)}
        </h2>,
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2.5 py-1">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/80" />
          <span className="leading-relaxed">{renderInline(line.slice(2), i)}</span>
        </div>,
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-3" />)
    } else {
      elements.push(
        <p key={i} className="py-1 leading-[1.75]">
          {renderInline(line, i)}
        </p>,
      )
    }
  }
  return (
    <div
      className={`text-[14.5px] text-[var(--app-text)]/92 ${serif ? '' : ''}`}
      style={serif ? { fontFamily: 'Georgia, "Times New Roman", serif' } : undefined}
    >
      {elements}
    </div>
  )
}

function ChartBlock({
  block,
  paket,
  ticker,
}: {
  block: Extract<AktienanalyseBlock, { type: 'chart' }>
  paket: FundamentaldatenPaket
  ticker: string
}) {
  const variant = block.variant === 'bewertung' ? 'bewertung' : 'standard'
  const zeilenGefiltert: FundamentalMetrikZeile[] =
    variant === 'bewertung'
      ? paket.zeilen.filter((z) =>
          /bewertung|kgv|ev_|ps_|pe_|forward|trailing|yield/i.test(`${z.gruppe} ${z.id}`),
        )
      : paket.zeilen
  const zeilen =
    variant === 'bewertung' && zeilenGefiltert.length === 0 ? paket.zeilen : zeilenGefiltert

  const basisPerioden =
    variant === 'bewertung'
      ? bewertungForwardChartPerioden(paket.perioden)
      : finanzdatenChartPerioden(paket.perioden)
  const perioden = letzteJahreChartPerioden(basisPerioden, block.jahre ?? 5)

  const ids = block.metrikIds.filter((id) =>
    zeilen.some((z) => z.id === id && Object.values(z.werte).some((v) => v != null && Number.isFinite(v))),
  )

  if (ids.length === 0) {
    return (
      <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
        Chart nicht verfügbar (Metriken: {block.metrikIds.join(', ')}).
      </p>
    )
  }

  const titel = block.titel || ids.join(' · ')

  return (
    <figure className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent shadow-[0_0_0_1px_rgba(45,212,191,0.06)]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <figcaption
          className="text-[12px] font-semibold tracking-wide text-teal-100/90"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {titel}
        </figcaption>
        <span className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">
          {block.jahre ?? 5} Jahre
        </span>
      </div>
      <PaFundamentalMetrikChart
        chartId={`aktienanalyse-${ticker}-${ids.join('-')}`}
        titel={titel}
        kompakt
        eingebettet
        variant={variant}
        perioden={perioden}
        zeilen={zeilen}
        aktivIds={new Set(ids)}
        labelsAnzeigen={false}
        onClear={() => undefined}
        onToggleSerie={() => undefined}
        onToggleLabels={() => undefined}
        analyseSchluessel={chartAnalyseSchluessel(ticker, `analyse-${ids.join('-')}`)}
        analyseTitel={`${ticker} · ${titel}`}
      />
    </figure>
  )
}

function KennzahlGruppe({ bloecke }: { bloecke: Extract<AktienanalyseBlock, { type: 'kennzahl' }>[] }) {
  if (bloecke.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {bloecke.map((k, i) => (
        <div
          key={`${k.label}-${i}`}
          className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3.5"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
            {k.label}
          </p>
          <p
            className="mt-1.5 text-2xl font-semibold tracking-tight text-teal-100 tabular-nums"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {k.wert}
          </p>
          {k.kontext ? (
            <p className="mt-1 text-[11px] leading-snug text-[var(--app-text-muted)]">{k.kontext}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function ZitatBlock({ block }: { block: Extract<AktienanalyseBlock, { type: 'zitat' }> }) {
  return (
    <blockquote className="relative overflow-hidden rounded-2xl border border-teal-500/15 bg-teal-500/[0.06] px-5 py-5 sm:px-7">
      <span
        className="pointer-events-none absolute -left-1 top-2 text-6xl leading-none text-teal-400/25"
        aria-hidden
        style={{ fontFamily: 'Georgia, serif' }}
      >
        “
      </span>
      <p
        className="relative text-[15px] leading-relaxed text-[var(--app-text)]/95"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {block.text}
      </p>
      {block.quelle ? (
        <footer className="relative mt-3 text-[11px] font-medium uppercase tracking-wider text-teal-300/70">
          — {block.quelle}
        </footer>
      ) : null}
    </blockquote>
  )
}

function CalloutBlock({ block }: { block: Extract<AktienanalyseBlock, { type: 'callout' }> }) {
  const v = block.variant ?? 'thesis'
  const styles =
    v === 'risiko'
      ? 'border-amber-500/25 bg-amber-500/[0.07] text-amber-50/95'
      : v === 'chance'
        ? 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-50/95'
        : 'border-teal-500/25 bg-teal-500/[0.08] text-teal-50/95'
  const label = v === 'risiko' ? 'Risiko' : v === 'chance' ? 'Chance' : 'Thesis'
  return (
    <aside className={`rounded-2xl border px-4 py-3.5 sm:px-5 ${styles}`}>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <KiMdText text={block.markdown} />
    </aside>
  )
}

function BerichtRenderer({
  bloecke,
  paket,
  ticker,
}: {
  bloecke: AktienanalyseBlock[]
  paket: FundamentaldatenPaket
  ticker: string
}) {
  const nodes: React.ReactNode[] = []
  let i = 0
  while (i < bloecke.length) {
    const b = bloecke[i]!
    if (b.type === 'kennzahl') {
      const gruppe: Extract<AktienanalyseBlock, { type: 'kennzahl' }>[] = []
      while (i < bloecke.length && bloecke[i]!.type === 'kennzahl') {
        gruppe.push(bloecke[i] as Extract<AktienanalyseBlock, { type: 'kennzahl' }>)
        i++
      }
      nodes.push(<KennzahlGruppe key={`kpi-${i}`} bloecke={gruppe} />)
      continue
    }
    if (b.type === 'text') {
      nodes.push(
        <div key={i} className="px-0.5">
          <KiMdText text={b.markdown} serif />
        </div>,
      )
    } else if (b.type === 'chart') {
      nodes.push(<ChartBlock key={i} block={b} paket={paket} ticker={ticker} />)
    } else if (b.type === 'zitat') {
      nodes.push(<ZitatBlock key={i} block={b} />)
    } else if (b.type === 'callout') {
      nodes.push(<CalloutBlock key={i} block={b} />)
    }
    i++
  }
  return <div className="space-y-6 sm:space-y-7">{nodes}</div>
}

function formatErstelltAm(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatKiModell(modell: string | null | undefined): string {
  const m = (modell || '').trim()
  if (!m || m === 'gemini' || m === 'openai') return m === 'openai' ? 'OpenAI' : 'Gemini'
  // gemini-3.5-flash → Gemini 3.5 Flash
  const kurz = m.replace(/^models\//, '').replace(/^gemini-/i, '')
  if (!kurz || kurz === m) return `Gemini (${m})`
  const pretty = kurz
    .split('-')
    .map((p) => (p === 'flash' || p === 'pro' || p === 'preview' ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ')
  return `Gemini ${pretty}`
}

function metaZeile(e: AktienanalyseEintrag): string {
  return `Erstellt am ${formatErstelltAm(e.createdAt)} von ${formatKiModell(e.kiModell)}`
}

export function PaFundamentalAktienanalyse({
  paket,
  anfrage,
}: {
  paket: FundamentaldatenPaket
  anfrage: FundamentaldatenAnfrage
}) {
  const ticker = (paket.ticker || '').toUpperCase()
  const [prompt, setPrompt] = useState('')
  const [promptOffen, setPromptOffen] = useState(false)
  const [historie, setHistorie] = useState<AktienanalyseEintrag[]>([])
  /** null = Zeitungsliste; gesetzt = geöffneter Artikel */
  const [aktivId, setAktivId] = useState<string | null>(null)
  const [ladenHist, setLadenHist] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [fortschritt, setFortschritt] = useState<string | null>(null)

  useEffect(() => {
    setPrompt(ladeAktienanalysePrompt())
  }, [])

  useEffect(() => {
    if (!prompt) return
    if (
      prompt.includes(AKTIENANALYSE_PROMPT_MARKER) &&
      prompt.includes('Quality-Compounder') &&
      prompt.includes('"type": "callout"')
    ) {
      return
    }
    setPrompt(resetAktienanalysePrompt())
  }, [prompt])

  const ladeHist = useCallback(async () => {
    if (!ticker) return
    setLadenHist(true)
    try {
      const list = await ladeAktienanalyseHistorie(ticker)
      setHistorie(list)
      setAktivId((prev) => (prev && list.some((e) => e.id === prev) ? prev : null))
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Historie fehlgeschlagen')
    } finally {
      setLadenHist(false)
    }
  }, [ticker])

  useEffect(() => {
    setAktivId(null)
    void ladeHist()
  }, [ladeHist])

  const aktiv = useMemo(
    () => (aktivId ? historie.find((e) => e.id === aktivId) ?? null : null),
    [historie, aktivId],
  )

  async function starteAnalyse() {
    if (!ticker || busy) return
    setBusy(true)
    setFehler(null)
    setFortschritt('Export-Daten werden vorbereitet …')
    try {
      const promptFuerKi =
        prompt.includes(AKTIENANALYSE_PROMPT_MARKER) &&
        prompt.includes('Quality-Compounder') &&
        prompt.includes('"type": "callout"')
          ? prompt
          : resetAktienanalysePrompt()
      if (promptFuerKi !== prompt) setPrompt(promptFuerKi)
      speichereAktienanalysePrompt(promptFuerKi)
      const exportPayload = await baueFundamentaldatenExportVollstaendig(paket, anfrage)
      setFortschritt('KI analysiert (kann 1–3 Min. dauern) …')
      const eintrag = await generiereAktienanalyse({
        ticker,
        prompt: promptFuerKi,
        exportPayload,
      })
      setHistorie((prev) => [eintrag, ...prev.filter((e) => e.id !== eintrag.id)])
      setAktivId(eintrag.id)
      setFortschritt(null)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Analyse fehlgeschlagen')
      setFortschritt(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PaCard variant="glass" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--app-text)]">Aktienanalyse</h3>
            <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
              Zeitungsartikel mit Thumbnail · Klick öffnet die volle Analyse
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {aktiv ? (
              <button
                type="button"
                onClick={() => setAktivId(null)}
                className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
              >
                ← Zur Übersicht
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPromptOffen((v) => !v)}
              className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            >
              {promptOffen ? 'Prompt schließen' : 'Prompt bearbeiten'}
            </button>
            <button
              type="button"
              disabled={busy || !ticker}
              onClick={() => void starteAnalyse()}
              className="rounded-lg border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-xs font-semibold text-teal-100 hover:bg-teal-500/25 disabled:opacity-50"
            >
              {busy ? 'Generiere …' : historie.length ? 'Neue Analyse generieren' : 'Analyse generieren'}
            </button>
          </div>
        </div>

        {promptOffen ? (
          <div className="space-y-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--app-text)]"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  speichereAktienanalysePrompt(prompt)
                }}
                className="rounded-md border border-[var(--app-border)] px-2.5 py-1 text-[11px] text-[var(--app-text-muted)]"
              >
                Prompt speichern
              </button>
              <button
                type="button"
                onClick={() => setPrompt(resetAktienanalysePrompt())}
                className="rounded-md border border-[var(--app-border)] px-2.5 py-1 text-[11px] text-[var(--app-text-muted)]"
              >
                Auf Standard zurücksetzen
              </button>
            </div>
          </div>
        ) : null}

        {fortschritt ? <p className="text-xs text-teal-300/90">{fortschritt}</p> : null}
        {fehler ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {fehler}
          </p>
        ) : null}
      </PaCard>

      {aktiv ? (
        <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--app-bg)] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.55)]">
          <div className="relative aspect-[16/7] min-h-[11rem] overflow-hidden sm:aspect-[16/6]">
            {thumbSrc(aktiv) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbSrc(aktiv)}
                alt=""
                className="h-full w-full object-cover object-left"
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--app-bg)] via-transparent to-transparent" />
          </div>

          <div className="relative -mt-8 space-y-6 px-4 pb-8 pt-2 sm:px-7 sm:pb-10">
            <header className="space-y-2 border-b border-white/[0.06] pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-teal-400/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
                  {aktiv.bericht.cover?.stichwort || 'Research'}
                </span>
              </div>
              <h2
                className="text-xl font-semibold tracking-tight text-[var(--app-text)] sm:text-2xl"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {aktiv.titel}
              </h2>
              {aktiv.bericht.cover?.untertitel ? (
                <p className="max-w-2xl text-sm leading-relaxed text-[var(--app-text-muted)]">
                  {aktiv.bericht.cover.untertitel}
                </p>
              ) : null}
              <p className="pt-1 text-[11px] text-[var(--app-text-muted)]">{metaZeile(aktiv)}</p>
            </header>

            <BerichtRenderer bloecke={aktiv.bericht.bloecke} paket={paket} ticker={ticker} />
          </div>
        </article>
      ) : historie.length > 0 ? (
        <div className="space-y-3">
          {historie.map((e) => {
            const src = thumbSrc(e)
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setAktivId(e.id)}
                className="group flex w-full gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5 text-left transition hover:border-teal-500/35 hover:bg-teal-500/[0.05] sm:gap-4 sm:p-3"
              >
                <div className="h-[4.75rem] w-[8.5rem] shrink-0 overflow-hidden rounded-xl bg-[#0b1220] sm:h-[5.5rem] sm:w-[10rem]">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      {e.ticker}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 self-center py-0.5">
                  {e.bericht.cover?.stichwort ? (
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-teal-400/80">
                      {e.bericht.cover.stichwort}
                    </p>
                  ) : null}
                  <h4
                    className="text-[15px] font-semibold leading-snug tracking-tight text-[var(--app-text)] group-hover:text-teal-50 sm:text-base"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    {e.titel}
                  </h4>
                  {e.bericht.cover?.untertitel ? (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
                      {e.bericht.cover.untertitel}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-[var(--app-text-muted)]/90">{metaZeile(e)}</p>
                </div>
              </button>
            )
          })}
          {ladenHist ? (
            <p className="px-1 text-[11px] text-[var(--app-text-muted)]">Lädt …</p>
          ) : null}
        </div>
      ) : (
        <PaCard className="p-8 text-center text-sm text-[var(--app-text-muted)]">
          {ladenHist
            ? 'Lädt …'
            : 'Noch keine Analyse. Prompt prüfen und „Analyse generieren“ starten.'}
        </PaCard>
      )}
    </div>
  )
}

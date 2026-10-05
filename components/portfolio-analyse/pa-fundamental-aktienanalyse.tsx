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
import type {
  AktienanalyseBlock,
  AktienanalyseEintrag,
} from '@/lib/portfolio-analyse/aktienanalyse-prompt'
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

function KiMdText({ text }: { text: string }) {
  function renderInline(line: string, key: number) {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**'))
            return (
              <strong key={i} className="font-semibold text-[var(--app-text)]">
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
        <h4 key={i} className="mt-4 mb-1 text-[11px] font-bold uppercase tracking-wider text-teal-400/90">
          {line.slice(4)}
        </h4>,
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="mt-5 mb-1.5 text-sm font-semibold text-teal-200/95">
          {line.slice(3)}
        </h3>,
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <h2 key={i} className="mt-5 mb-2 text-base font-semibold text-[var(--app-text)]">
          {line.slice(2)}
        </h2>,
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2 py-0.5">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-500/80" />
          <span>{renderInline(line.slice(2), i)}</span>
        </div>,
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(
        <p key={i} className="py-0.5 leading-relaxed">
          {renderInline(line, i)}
        </p>,
      )
    }
  }
  return <div className="text-[13px] text-[var(--app-text)]">{elements}</div>
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
      <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
        Chart nicht verfügbar (Metriken: {block.metrikIds.join(', ')}).
      </p>
    )
  }

  const titel = block.titel || ids.join(' · ')

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
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
    </div>
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
  return (
    <div className="space-y-5">
      {bloecke.map((b, i) =>
        b.type === 'text' ? (
          <div key={i} className="px-0.5">
            <KiMdText text={b.markdown} />
          </div>
        ) : (
          <ChartBlock key={i} block={b} paket={paket} ticker={ticker} />
        ),
      )}
    </div>
  )
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
  const [aktivId, setAktivId] = useState<string | null>(null)
  const [ladenHist, setLadenHist] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [fortschritt, setFortschritt] = useState<string | null>(null)

  useEffect(() => {
    setPrompt(ladeAktienanalysePrompt())
  }, [])

  const ladeHist = useCallback(async () => {
    if (!ticker) return
    setLadenHist(true)
    try {
      const list = await ladeAktienanalyseHistorie(ticker)
      setHistorie(list)
      setAktivId((prev) => {
        if (prev && list.some((e) => e.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Historie fehlgeschlagen')
    } finally {
      setLadenHist(false)
    }
  }, [ticker])

  useEffect(() => {
    void ladeHist()
  }, [ladeHist])

  const aktiv = useMemo(
    () => historie.find((e) => e.id === aktivId) ?? historie[0] ?? null,
    [historie, aktivId],
  )

  async function starteAnalyse() {
    if (!ticker || busy) return
    setBusy(true)
    setFehler(null)
    setFortschritt('Export-Daten werden vorbereitet …')
    try {
      speichereAktienanalysePrompt(prompt)
      const exportPayload = await baueFundamentaldatenExportVollstaendig(paket, anfrage)
      setFortschritt('KI analysiert (kann 1–3 Min. dauern) …')
      const eintrag = await generiereAktienanalyse({
        ticker,
        prompt,
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
    <div className="space-y-4">
      <PaCard variant="glass" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--app-text)]">Aktienanalyse</h3>
            <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
              Globaler Prompt · KI mit Export-JSON-Kontext · Charts aus Fundamentaldaten · Historie bleibt erhalten
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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

        {fortschritt ? (
          <p className="text-xs text-teal-300/90">{fortschritt}</p>
        ) : null}
        {fehler ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {fehler}
          </p>
        ) : null}
      </PaCard>

      {historie.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {historie.map((e) => {
            const aktivBtn = e.id === (aktiv?.id ?? '')
            const datum = e.createdAt
              ? new Date(e.createdAt).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setAktivId(e.id)}
                className={`rounded-lg px-2.5 py-1.5 text-left text-[11px] transition ${
                  aktivBtn
                    ? 'bg-teal-700 text-white'
                    : 'border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
                title={e.titel}
              >
                <span className="font-medium">{datum || '—'}</span>
                <span className="mt-0.5 block max-w-[14rem] truncate opacity-80">{e.titel}</span>
              </button>
            )
          })}
          {ladenHist ? (
            <span className="px-2 py-1.5 text-[11px] text-[var(--app-text-muted)]">Lädt …</span>
          ) : null}
        </div>
      ) : null}

      {aktiv ? (
        <PaCard variant="glass" className="space-y-4 p-4 sm:p-5">
          <div className="border-b border-white/[0.06] pb-3">
            <h2 className="text-base font-semibold text-[var(--app-text)]">{aktiv.titel}</h2>
            <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">
              {new Date(aktiv.createdAt).toLocaleString('de-DE')} · Gemini Free · gespeicherte Version
            </p>
          </div>
          <BerichtRenderer bloecke={aktiv.bericht.bloecke} paket={paket} ticker={ticker} />
        </PaCard>
      ) : (
        <PaCard className="p-8 text-center text-sm text-[var(--app-text-muted)]">
          Noch keine Analyse. Prompt prüfen und „Analyse generieren“ starten.
        </PaCard>
      )}
    </div>
  )
}

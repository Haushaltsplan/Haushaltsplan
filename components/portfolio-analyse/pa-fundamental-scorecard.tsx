'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  baueScorecard,
  type ScorecardBalken,
  type ScorecardFirma,
  type ScorecardStrategie,
  type ScorecardStrategieId,
} from '@/lib/portfolio-analyse/fundamentaldaten-scorecard'
import type { FundamentaldatenPaket, MantraAmpel } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const AMPEL_CLASS: Record<MantraAmpel, string> = {
  gruen: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40',
  gelb: 'bg-amber-500/20 text-amber-200 ring-amber-500/40',
  rot: 'bg-red-500/20 text-red-300 ring-red-500/40',
  grau: 'bg-white/10 text-[var(--app-text-muted)] ring-white/15',
}

const AMPEL_LABEL: Record<MantraAmpel, string> = {
  gruen: 'Grün',
  gelb: 'Gelb',
  rot: 'Rot',
  grau: 'Grau',
}

const STRATEGIE_TINT: Record<ScorecardStrategieId, { head: string; bar: string; score: string }> = {
  dividendenertrag: {
    head: 'bg-sky-500/15 text-sky-200',
    bar: 'text-sky-400',
    score: 'text-sky-300',
  },
  dividendenwachstum: {
    head: 'bg-amber-500/15 text-amber-200',
    bar: 'text-amber-400',
    score: 'text-amber-300',
  },
  gewinnwachstum: {
    head: 'bg-emerald-500/15 text-emerald-200',
    bar: 'text-emerald-400',
    score: 'text-emerald-300',
  },
}

const BALKEN_SEGMENTE = 12

function ScoreBalken({ balken, tint }: { balken: ScorecardBalken; tint: string }) {
  const filled = balken.position == null ? 0 : Math.round(balken.position * BALKEN_SEGMENTE)
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-[var(--app-text-muted)]">{balken.label}</span>
        <span className="truncate text-[11px] tabular-nums text-[var(--app-text)]">{balken.wertText}</span>
      </div>
      <div className={`flex gap-0.5 ${tint}`} aria-hidden>
        {Array.from({ length: BALKEN_SEGMENTE }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-[1px] ${
              i < filled ? 'bg-current' : 'bg-white/[0.08]'
            } ${balken.position == null ? 'opacity-40' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

function FirmenLogo({ ticker, website }: { ticker: string; website: string | null }) {
  const initialen = ticker.slice(0, 2).toUpperCase()
  let host: string | null = null
  if (website) {
    try {
      const url = website.startsWith('http') ? website : `https://${website}`
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      host = null
    }
  }
  const hue =
    ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold tracking-wide text-white"
      style={{ background: `hsl(${hue} 45% 32%)` }}
      title={host ?? ticker}
    >
      {initialen}
    </div>
  )
}

function FirmaSpalte({
  firma,
  renditen,
}: {
  firma: ScorecardFirma
  renditen: { j1: number | null; j5: number | null; j10: number | null }
}) {
  const metaZeilen: { label: string; wert: string }[] = [
    { label: 'Branche', wert: firma.branche ?? '–' },
    { label: 'Sektor', wert: firma.sektor ?? '–' },
    { label: 'ISIN', wert: firma.isin ?? '–' },
    { label: 'Börsenwert', wert: firma.boersenwertText ?? '–' },
    { label: 'Kurs', wert: firma.kursText ?? '–' },
  ]

  const renditeZeilen: { label: string; pct: number | null }[] = [
    { label: '1 Jahr', pct: renditen.j1 },
    { label: '5 Jahre', pct: renditen.j5 },
    { label: '10 Jahre', pct: renditen.j10 },
  ]

  return (
    <div className="flex flex-col gap-4 bg-[var(--app-bg)]/40 p-4">
      <div className="flex items-center gap-3">
        <FirmenLogo ticker={firma.ticker} website={firma.website} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--app-text)]">{firma.name}</p>
          <p className="text-xs tabular-nums text-[var(--app-text-muted)]">{firma.ticker}</p>
        </div>
      </div>
      <dl className="space-y-1.5 text-[12px]">
        {metaZeilen.map((z) => (
          <div key={z.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[var(--app-text-muted)]">{z.label}</dt>
            <dd className="truncate text-right tabular-nums text-[var(--app-text)]">{z.wert}</dd>
          </div>
        ))}
        {renditeZeilen.map((z) => {
          const text =
            z.pct == null
              ? '–'
              : `${z.pct > 0 ? '+' : ''}${z.pct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
          const ton = z.pct == null ? '' : z.pct >= 0 ? 'text-emerald-400' : 'text-red-300'
          return (
            <div key={z.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--app-text-muted)]">{z.label}</dt>
              <dd className={`tabular-nums ${ton || 'text-[var(--app-text)]'}`}>{text}</dd>
            </div>
          )
        })}
      </dl>
      {firma.mantraAmpel ? (
        <div className="mt-auto">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${AMPEL_CLASS[firma.mantraAmpel]}`}
          >
            Mantra {AMPEL_LABEL[firma.mantraAmpel]}
            {firma.mantraScorePct != null ? ` · ${firma.mantraScorePct} %` : ''}
          </span>
        </div>
      ) : null}
    </div>
  )
}

function StrategieSpalte({ strategie }: { strategie: ScorecardStrategie }) {
  const tint = STRATEGIE_TINT[strategie.id]
  return (
    <div className="flex flex-col">
      <div className={`px-4 py-2.5 text-center text-sm font-semibold ${tint.head}`}>{strategie.titel}</div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        {strategie.balken.map((b) => (
          <ScoreBalken key={b.id} balken={b} tint={tint.bar} />
        ))}
        <div className="mt-auto border-t border-[var(--app-border)] pt-3 text-center">
          <p className={`text-3xl font-bold tabular-nums ${tint.score}`}>
            {strategie.score != null ? strategie.score : '–'}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">Qualität 1–10</p>
          {strategie.hinweis ? (
            <p className="mt-1 text-[10px] text-[var(--app-text-muted)]">{strategie.hinweis}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function preisNahe(serie: Record<string, number>, zielIso: string, maxTage = 45): number | null {
  const keys = Object.keys(serie)
  if (keys.length === 0) return null
  const t = Date.parse(`${zielIso}T12:00:00Z`)
  let best: string | null = null
  let bestDist = Infinity
  for (const k of keys) {
    const d = Math.abs(Date.parse(`${k}T12:00:00Z`) - t)
    if (d < bestDist) {
      bestDist = d
      best = k
    }
  }
  if (!best || bestDist > maxTage * 86_400_000) return null
  const v = serie[best]
  return v != null && Number.isFinite(v) && v > 0 ? v : null
}

function renditePct(start: number | null, ende: number | null): number | null {
  if (start == null || ende == null || start <= 0) return null
  return ((ende - start) / start) * 100
}

export function PaFundamentalScorecard({
  paket,
  isin,
}: {
  paket: FundamentaldatenPaket
  isin?: string | null
}) {
  const modell = useMemo(() => baueScorecard(paket, isin), [paket, isin])
  const [renditen, setRenditen] = useState<{ j1: number | null; j5: number | null; j10: number | null }>({
    j1: null,
    j5: null,
    j10: null,
  })

  useEffect(() => {
    const sym = paket.symbolYahoo
    if (!sym) {
      setRenditen({ j1: null, j5: null, j10: null })
      return
    }
    let cancelled = false
    setRenditen({ j1: null, j5: null, j10: null })
    const bis = new Date()
    const von = new Date(bis)
    von.setFullYear(von.getFullYear() - 10)
    void (async () => {
      try {
        const res = await fetch('/api/portfolio-analyse/kurse/historie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbols: [sym],
            vonDatum: von.toISOString().slice(0, 10),
            bisDatum: bis.toISOString().slice(0, 10),
          }),
        })
        const j = (await res.json()) as { ok?: boolean; serien?: Record<string, Record<string, number>> }
        const serie = j.ok ? j.serien?.[sym] ?? j.serien?.[sym.toUpperCase()] : undefined
        if (!serie || cancelled) return
        const keys = Object.keys(serie).sort()
        const lastKey = keys[keys.length - 1]
        const ende = lastKey ? serie[lastKey]! : null
        const iso = (jahre: number) => {
          const d = new Date(bis)
          d.setFullYear(d.getFullYear() - jahre)
          return d.toISOString().slice(0, 10)
        }
        setRenditen({
          j1: renditePct(preisNahe(serie, iso(1), 21), ende),
          j5: renditePct(preisNahe(serie, iso(5), 60), ende),
          j10: renditePct(preisNahe(serie, iso(10), 90), ende),
        })
      } catch {
        if (!cancelled) setRenditen({ j1: null, j5: null, j10: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paket.symbolYahoo])

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] ring-1 ring-white/[0.03]">
      <div className="grid divide-y divide-[var(--app-border)] lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <FirmaSpalte firma={modell.firma} renditen={renditen} />
        {modell.strategien.map((s) => (
          <StrategieSpalte key={s.id} strategie={s} />
        ))}
      </div>
      <p className="border-t border-[var(--app-border)] px-4 py-2 text-[10px] text-[var(--app-text-muted)]">
        Jede Spalte hat eigene Punkte zur Strategie. Qualität 1–10 nur aus diesen Balken — nicht die
        proprietären Aktienfinder-Scores.
      </p>
    </div>
  )
}

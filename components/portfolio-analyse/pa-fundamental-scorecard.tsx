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
import { generiereMoatKiClient, ladeMoatKiClient } from '@/lib/portfolio-analyse/moat-ki-client'
import {
  MOAT_KAUF_MIN_SCORE,
  MOAT_TIEF_SCORE,
  type MoatKiBewertung,
} from '@/lib/portfolio-analyse/moat-ki-types'

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
  burggraben: {
    head: 'bg-violet-500/15 text-violet-200',
    bar: 'text-violet-400',
    score: 'text-violet-300',
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
      {balken.leergrund ? (
        <p className="text-[9px] leading-tight text-[var(--app-text-muted)]/80">{balken.leergrund}</p>
      ) : null}
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
  historieBadge,
}: {
  firma: ScorecardFirma
  renditen: { label: string; pct: number }[]
  historieBadge: string
}) {
  const metaZeilen: { label: string; wert: string }[] = [
    { label: 'Branche', wert: firma.branche ?? '–' },
    { label: 'Sektor', wert: firma.sektor ?? '–' },
    { label: 'ISIN', wert: firma.isin ?? '–' },
    { label: 'Börsenwert', wert: firma.boersenwertText ?? '–' },
    { label: 'Kurs', wert: firma.kursText ?? '–' },
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
        {renditen.map((z) => {
          const text = `${z.pct > 0 ? '+' : ''}${z.pct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
          const ton = z.pct >= 0 ? 'text-emerald-400' : 'text-red-300'
          return (
            <div key={z.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--app-text-muted)]">{z.label}</dt>
              <dd className={`tabular-nums ${ton}`}>{text}</dd>
            </div>
          )
        })}
      </dl>
      <p className="text-[10px] text-[var(--app-text-muted)]">{historieBadge}</p>
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
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
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

function baueRenditeZeilen(
  serie: Record<string, number>,
  bis: Date,
): { label: string; pct: number }[] {
  const keys = Object.keys(serie).sort()
  const lastKey = keys[keys.length - 1]
  const firstKey = keys[0]
  if (!lastKey || !firstKey) return []
  const ende = serie[lastKey] ?? null
  const iso = (jahre: number) => {
    const d = new Date(bis)
    d.setFullYear(d.getFullYear() - jahre)
    return d.toISOString().slice(0, 10)
  }
  const spanJahre =
    (Date.parse(`${lastKey}T12:00:00Z`) - Date.parse(`${firstKey}T12:00:00Z`)) / (365.25 * 86_400_000)

  const out: { label: string; pct: number }[] = []
  const add = (jahre: number, label: string, maxTage: number) => {
    const pct = renditePct(preisNahe(serie, iso(jahre), maxTage), ende)
    if (pct != null) out.push({ label, pct })
  }
  add(1, '1 Jahr', 21)
  if (spanJahre >= 2.6) add(3, '3 Jahre', 45)
  if (spanJahre >= 4.5) add(5, '5 Jahre', 60)
  if (spanJahre >= 9.0) add(10, '10 Jahre', 90)
  if (spanJahre < 9.0) {
    const seit = renditePct(serie[firstKey] ?? null, ende)
    if (seit != null) {
      const n = Math.max(1, Math.round(spanJahre))
      out.push({ label: n <= 1 ? 'seit Listing' : `seit Listing (~${n}J)`, pct: seit })
    }
  }
  return out
}

const PFEILER_LABEL: Record<string, string> = {
  preissetzungsmacht: 'Preissetzung',
  replikationsbarriere: 'Replikation',
  wechselkosten: 'Wechselkosten',
  marktdichte: 'Marktdichte',
}

function MoatKiPanel({
  paket,
  isin,
  regelBurggrabenScore,
}: {
  paket: FundamentaldatenPaket
  isin?: string | null
  regelBurggrabenScore: number | null
}) {
  const ticker = (paket.symbolYahoo?.split('.')[0] || paket.ticker).trim().toUpperCase()
  const [moat, setMoat] = useState<MoatKiBewertung | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setMoat(null)
    setFehler(null)
    void ladeMoatKiClient(ticker).then((b) => {
      if (!cancelled) setMoat(b)
    })
    return () => {
      cancelled = true
    }
  }, [ticker])

  async function starte(erzwingen: boolean) {
    setLaden(true)
    setFehler(null)
    const res = await generiereMoatKiClient({ ticker, paket, isin, erzwingen })
    setLaden(false)
    if (!res.ok) {
      setFehler(res.fehler)
      return
    }
    setMoat(res.bewertung)
  }

  const regelOk = regelBurggrabenScore != null && regelBurggrabenScore >= 7
  const kiOk = moat?.kaufwuerdig === true && (moat.score ?? 0) >= MOAT_KAUF_MIN_SCORE
  const sellWarnung = (paket.mantra?.sellTriggerWatch ?? []).some((w) => w.status === 'warnung')
  const disziplinOk = Boolean(moat && kiOk && regelOk && !sellWarnung)

  return (
    <div className="space-y-3 border-t border-[var(--app-border)] bg-violet-500/[0.04] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-200">KI-Moat · Geschäftsmodell & Unzerstörbarkeit</p>
          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
            Free-Tier Gemini, skeptisch kalibriert. Quality-Kauf ab Moat-Score ≥ {MOAT_KAUF_MIN_SCORE}
            (ab {MOAT_TIEF_SCORE} = „tief“), Regel-Burggraben ≥ 7, kein Sell-Trigger-Warnung.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={laden}
            onClick={() => void starte(!moat)}
            className="rounded-lg bg-violet-500/25 px-3 py-1.5 text-[11px] font-semibold text-violet-100 ring-1 ring-violet-400/30 disabled:opacity-50"
          >
            {laden ? 'KI prüft …' : moat ? 'Moat neu bewerten' : 'KI-Moat prüfen'}
          </button>
        </div>
      </div>

      {fehler ? <p className="text-[11px] text-rose-300">{fehler}</p> : null}

      {!moat && !laden ? (
        <p className="text-[12px] text-[var(--app-text-muted)]">
          Noch keine KI-Bewertung. Ein Klick bewertet Wechselkosten, Replikation, Preissetzung und
          Marktdichte — und sagt klar, ob der Titel für einen strengen Moat-Kauf taugt.
        </p>
      ) : null}

      {moat ? (
        <>
          <div
            className={`rounded-lg px-3 py-2.5 ring-1 ${
              disziplinOk
                ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-500/35'
                : 'bg-rose-500/10 text-rose-100 ring-rose-500/30'
            }`}
          >
            <p className="text-sm font-semibold">
              {disziplinOk
                ? (moat.score ?? 0) >= MOAT_TIEF_SCORE
                  ? 'Tiefes Moat — Quality-Kauf möglich'
                  : 'Solides Moat — Quality-Kauf möglich'
                : 'Kein Kauf — Moat zu schwach / unsicher'}
            </p>
            <p className="mt-1 text-[11px] opacity-90">
              KI {moat.score}/10 ({moat.urteil}) · Regel-Burggraben{' '}
              {regelBurggrabenScore != null ? `${regelBurggrabenScore}/10` : '–'}
              {sellWarnung ? ' · Sell-Trigger Warnung' : ''}
            </p>
            <p className="mt-1 text-[11px] opacity-90">{moat.kaufHinweis}</p>
          </div>

          <p className="text-[12px] text-[var(--app-text)]">
            <span className="text-[var(--app-text-muted)]">Modell: </span>
            {moat.geschaeftsmodell}
          </p>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {moat.pfeiler.map((p) => (
              <div
                key={p.id}
                className="rounded-lg bg-[var(--app-bg)]/50 px-3 py-2 ring-1 ring-white/[0.04]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-[var(--app-text-muted)]">
                    {PFEILER_LABEL[p.id] ?? p.id}
                  </span>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      p.score >= 8 ? 'text-emerald-300' : p.score >= 6 ? 'text-amber-200' : 'text-rose-300'
                    }`}
                  >
                    {p.score}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-[var(--app-text)]">{p.begruendung}</p>
                <p className="mt-1 text-[10px] leading-snug text-rose-200/80">Risiko: {p.risiko}</p>
              </div>
            ))}
          </div>

          {moat.zerstoerungsszenarien.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                Was den Burggraben zerstören könnte
              </p>
              <ul className="mt-1 list-inside list-disc text-[11px] text-[var(--app-text)]">
                {moat.zerstoerungsszenarien.map((z) => (
                  <li key={z}>{z}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function PaFundamentalScorecard({
  paket,
  isin,
}: {
  paket: FundamentaldatenPaket
  isin?: string | null
}) {
  const modell = useMemo(() => baueScorecard(paket, isin), [paket, isin])
  const [renditen, setRenditen] = useState<{ label: string; pct: number }[]>([])
  const burggrabenScore =
    modell.strategien.find((s) => s.id === 'burggraben')?.score ?? null

  useEffect(() => {
    const sym = paket.symbolYahoo
    if (!sym) {
      setRenditen([])
      return
    }
    let cancelled = false
    setRenditen([])
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
        setRenditen(baueRenditeZeilen(serie, bis))
      } catch {
        if (!cancelled) setRenditen([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paket.symbolYahoo])

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] ring-1 ring-white/[0.03]">
      <div className="grid divide-y divide-[var(--app-border)] xl:grid-cols-5 xl:divide-x xl:divide-y-0">
        <FirmaSpalte firma={modell.firma} renditen={renditen} historieBadge={modell.historie.badge} />
        {modell.strategien.map((s) => (
          <StrategieSpalte key={s.id} strategie={s} />
        ))}
      </div>
      <MoatKiPanel paket={paket} isin={isin} regelBurggrabenScore={burggrabenScore} />
      <p className="border-t border-[var(--app-border)] px-4 py-2 text-[10px] text-[var(--app-text-muted)]">
        {modell.historie.fussnote} Regel-Scores aus Kennzahlen; KI-Moat bewertet Geschäftsmodell und
        qualitative Burggräben (gecacht). Disziplin: nur „Tiefes Moat“ + starke Regel-Spalte.
        Fehlende Regelwerte zählen nicht als 0.
      </p>
    </div>
  )
}

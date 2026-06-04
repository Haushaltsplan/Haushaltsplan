'use client'

import { useEffect, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import type { AnkuendigtesEarningsEintrag } from '@/lib/portfolio-analyse/ankuendigte-earnings'
import { berichtszeitKurz } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'
import { ladeEarningsSchaetzungenFuerEintrag } from '@/lib/portfolio-analyse/earnings-schaetzungen-client'
import type { JahresEarningsSchaetzung } from '@/lib/portfolio-analyse/jahres-earnings-schaetzung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import type { QuartalsPrognoseZeile } from '@/lib/portfolio-analyse/earnings-quartals-prognose'

const MONATE_KURZ = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const

function formatEventDatum(iso: string): string {
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  return `${d}. ${MONATE_KURZ[m - 1] ?? iso}`
}

function liveBadge(eintrag: AnkuendigtesEarningsEintrag, daten: EarningsSchaetzungen | null): string {
  const kurz = berichtszeitKurz(eintrag.berichtszeit)
  if (kurz === 'Vor Börse') return 'Before open'
  if (kurz === 'Nach Schluss') return 'After close'
  if (daten?.quartalsPrognose?.berichtszeitLabel) return daten.quartalsPrognose.berichtszeitLabel
  return 'Earnings'
}

function Pill({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums ring-1 ${className}`}
    >
      {children}
    </span>
  )
}

function MetrikTabelle({
  zeilen,
  vorjahrLabel,
  waehrung,
  mitIst,
}: {
  zeilen: QuartalsPrognoseZeile[]
  vorjahrLabel: string
  waehrung: string
  mitIst: boolean
}) {
  const cols = mitIst
    ? 'grid-cols-[minmax(5.5rem,1.1fr)_repeat(4,minmax(3.75rem,1fr))_minmax(4.5rem,1fr)]'
    : 'grid-cols-[minmax(5.5rem,1.1fr)_repeat(3,minmax(4rem,1fr))]'

  return (
    <div className="overflow-x-auto">
      <div className={`grid min-w-[20rem] gap-x-2 gap-y-0 ${cols}`}>
        <div className="border-b border-[#eef0f1]/10 pb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
          {waehrung}
        </div>
        <div className="border-b border-[#eef0f1]/10 pb-2 text-right text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
          Estimate
        </div>
        <div className="border-b border-[#eef0f1]/10 pb-2 text-right text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
          {vorjahrLabel}
        </div>
        {mitIst ? (
          <>
            <div className="border-b border-[#eef0f1]/10 pb-2 text-right text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
              Actual
            </div>
            <div className="border-b border-[#eef0f1]/10 pb-2 text-right text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
              vs. Est.
            </div>
          </>
        ) : null}
        <div className="border-b border-[#eef0f1]/10 pb-2 text-right text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
          Change
        </div>

        {zeilen.map((z) => (
          <div key={z.metrik} className="contents">
            <div className="flex items-center border-b border-[#eef0f1]/[0.05] py-2.5 text-sm text-zinc-300">
              {z.label}
            </div>
            <div className="flex items-center justify-end border-b border-[#eef0f1]/[0.05] py-2.5 text-sm font-semibold tabular-nums text-[#eef0f1]">
              {z.schaetzungAnzeige ?? '—'}
            </div>
            <div className="flex items-center justify-end border-b border-[#eef0f1]/[0.05] py-2.5 text-sm tabular-nums text-zinc-500">
              {z.vorjahrAnzeige ?? '—'}
            </div>
            {mitIst ? (
              <>
                <div className="flex items-center justify-end border-b border-[#eef0f1]/[0.05] py-2.5 text-sm font-medium tabular-nums text-zinc-200">
                  {z.istAnzeige ?? '—'}
                </div>
                <div className="flex items-center justify-end border-b border-[#eef0f1]/[0.05] py-2.5">
                  <BeatMissPill anzeige={z.beatMissAnzeige ?? null} />
                </div>
              </>
            ) : null}
            <div className="flex items-center justify-end border-b border-[#eef0f1]/[0.05] py-2.5">
              <ChangePill wachstumAnzeige={z.wachstumAnzeige} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChangePill({ wachstumAnzeige }: { wachstumAnzeige: string | null }) {
  if (!wachstumAnzeige) return <span className="text-[11px] text-zinc-600">—</span>
  return (
    <Pill className="bg-zinc-800/90 text-zinc-200 ring-white/[0.06]">{wachstumAnzeige}</Pill>
  )
}

function BeatMissPill({ anzeige }: { anzeige: string | null }) {
  if (!anzeige) return <span className="text-[11px] text-zinc-600">—</span>
  const beat = anzeige.startsWith('Beat')
  const miss = anzeige.startsWith('Miss')
  return (
    <Pill
      className={
        beat
          ? 'bg-emerald-950/50 text-emerald-300 ring-emerald-500/25'
          : miss
            ? 'bg-rose-950/40 text-rose-300 ring-rose-500/25'
            : 'bg-zinc-800/90 text-zinc-300 ring-white/[0.06]'
      }
    >
      {anzeige}
    </Pill>
  )
}

function JahresBlock({ j }: { j: JahresEarningsSchaetzung }) {
  const vorjahr = j.vorjahrLabel ?? 'Vorjahr'
  const zeilen = [
    j.umsatz.schaetzung != null && j.umsatz.schaetzung >= 1e8
      ? { label: 'Umsatz', ...j.umsatz }
      : null,
    j.eps.schaetzung != null ? { label: 'EPS', ...j.eps } : null,
  ].filter(Boolean) as { label: string; schaetzungAnzeige: string | null; vorjahrAnzeige: string | null; wachstumAnzeige: string | null }[]

  if (zeilen.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-[#eef0f1]/[0.06] bg-zinc-900/35 px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        Jahres-Schätzung · {j.jahrLabel}
      </p>
      <div className="mt-2 grid grid-cols-[minmax(4.5rem,1fr)_repeat(3,minmax(3.5rem,1fr))] gap-x-2 gap-y-0 min-w-[16rem]">
        <div className="pb-1 text-[10px] uppercase tracking-[0.1em] text-zinc-600">{j.waehrung}</div>
        <div className="pb-1 text-right text-[10px] uppercase tracking-[0.1em] text-zinc-600">FY Est.</div>
        <div className="pb-1 text-right text-[10px] uppercase tracking-[0.1em] text-zinc-600">{vorjahr}</div>
        <div className="pb-1 text-right text-[10px] uppercase tracking-[0.1em] text-zinc-600">Δ</div>
        {zeilen.map((z) => (
          <div key={z.label} className="contents">
            <div className="py-1.5 text-sm text-zinc-400">{z.label}</div>
            <div className="py-1.5 text-right text-sm font-medium tabular-nums text-zinc-200">
              {z.schaetzungAnzeige ?? '—'}
            </div>
            <div className="py-1.5 text-right text-sm tabular-nums text-zinc-500">
              {z.vorjahrAnzeige ?? '—'}
            </div>
            <div className="py-1.5 text-right">
              <ChangePill wachstumAnzeige={z.wachstumAnzeige} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-zinc-600">Umsatz: Marketscreener · EPS: Wallstreet</p>
    </div>
  )
}

export function PaEarningsPrognosePanel({
  eintrag,
  meta,
}: {
  eintrag: AnkuendigtesEarningsEintrag | null
  meta: Map<string, IsinMetadata>
}) {
  const [daten, setDaten] = useState<EarningsSchaetzungen | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const key = eintrag ? `${eintrag.isin}:${eintrag.terminDatumIso}` : ''

  useEffect(() => {
    if (!eintrag) {
      setDaten(null)
      setFehler(null)
      return
    }
    const eintragFix = eintrag
    let cancelled = false
    async function run() {
      setLaden(true)
      setFehler(null)
      setDaten(null)
      try {
        const res = await ladeEarningsSchaetzungenFuerEintrag(eintragFix, meta)
        if (!cancelled) setDaten(res)
      } catch (e) {
        if (!cancelled) {
          setDaten(null)
          setFehler(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
        }
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [key, eintrag, meta])

  if (!eintrag) {
    return (
      <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-2xl border border-dashed border-[#eef0f1]/10 bg-[#0c0c0d] px-6 text-center">
        <p className="text-sm text-zinc-400">Klicke auf einen Termin.</p>
        <p className="mt-2 text-[11px] text-zinc-600">±1 Jahr · Konsens & veröffentlichte Zahlen</p>
      </div>
    )
  }

  const q = daten?.quartalsPrognose
  const waehrung = q?.zeilen[0]?.waehrung ?? 'USD'
  const zeilen = q?.zeilen ?? []
  const hatIst = Boolean(daten?.berichtVeroeffentlicht && zeilen.some((z) => z.istAnzeige != null))
  const istVergangen = Boolean(daten?.berichtVeroeffentlicht)
  const jahresOk =
    daten?.jahresSchaetzung &&
    ((daten.jahresSchaetzung.umsatz.schaetzung != null && daten.jahresSchaetzung.umsatz.schaetzung >= 1e8) ||
      daten.jahresSchaetzung.eps.schaetzung != null)

  return (
    <div className="flex h-full min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-[#eef0f1]/[0.08] bg-[#0c0c0d]">
      <div className="shrink-0 border-b border-[#eef0f1]/[0.06] px-4 py-4">
        <div className="flex items-start gap-3">
          <PortfolioIsinLogo isin={eintrag.isin} fallbackName={eintrag.name} meta={meta} groesse="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              {istVergangen ? 'Quartalsbericht' : 'Nächster Termin'}
            </p>
            <p className="mt-1 text-lg font-semibold leading-tight tracking-tight text-[#eef0f1]">
              {q?.quartalLabel ?? daten?.prognosePeriode ?? 'Quartalszahlen'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill className="bg-zinc-800/90 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 ring-white/[0.06]">
                {liveBadge(eintrag, daten)}
              </Pill>
              <span className="text-[12px] tabular-nums text-zinc-400">
                {formatEventDatum(eintrag.terminDatumIso)}
              </span>
              {!eintrag.bestaetigt ? <PaDividendEstimateBadge title="Geschätzter Termin" /> : null}
              {hatIst ? (
                <Pill className="bg-emerald-950/40 text-[10px] text-emerald-300/90 ring-emerald-500/20">
                  Veröffentlicht
                </Pill>
              ) : null}
            </div>
            {daten?.investorRelationsUrl ? (
              <a
                href={daten.investorRelationsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-950/40 px-3 py-1.5 text-[12px] font-medium text-sky-300 ring-1 ring-sky-500/25 transition hover:bg-sky-950/60"
              >
                Investor Relations
                <span className="text-[10px] opacity-70" aria-hidden>
                  ↗
                </span>
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {laden ? (
          <p className="py-10 text-center text-sm text-zinc-500">Prognosen werden geladen …</p>
        ) : fehler ? (
          <p className="py-8 text-sm text-amber-400/90">{fehler}</p>
        ) : zeilen.length === 0 ? (
          <p className="py-8 text-sm text-zinc-500">Keine Konsens-Schätzungen für diese Aktie verfügbar.</p>
        ) : (
          <>
            {jahresOk && daten?.jahresSchaetzung ? <JahresBlock j={daten.jahresSchaetzung} /> : null}
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
              Quartals-Konsens
            </p>
            <MetrikTabelle
              zeilen={zeilen}
              vorjahrLabel={q?.vorjahrQuartalLabel ?? 'Vorjahr'}
              waehrung={waehrung}
              mitIst={hatIst}
            />
          </>
        )}
      </div>

      <p className="shrink-0 border-t border-[#eef0f1]/[0.06] px-4 py-2.5 text-[10px] leading-relaxed text-zinc-600">
        {daten
          ? `Quellen (${daten.quelle}): Yahoo, Marketscreener, Finnhub, Wallstreet (nur EPS jährlich).`
          : 'Daten werden beim Klick nachgeladen.'}
      </p>
    </div>
  )
}

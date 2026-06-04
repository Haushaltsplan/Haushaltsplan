'use client'

import { useEffect, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import type { AnkuendigtesEarningsEintrag } from '@/lib/portfolio-analyse/ankuendigte-earnings'
import { berichtszeitKurz } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'
import { ladeEarningsSchaetzungenFuerEintrag } from '@/lib/portfolio-analyse/earnings-schaetzungen-client'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

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

function ChangePill({ wachstumAnzeige }: { wachstumAnzeige: string | null }) {
  if (!wachstumAnzeige) {
    return <span className="text-[11px] text-zinc-600">—</span>
  }
  return (
    <span className="inline-block rounded-md bg-zinc-800/90 px-2 py-1 text-[11px] font-medium tabular-nums text-zinc-200 ring-1 ring-white/[0.06]">
      {wachstumAnzeige}
    </span>
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
        <p className="text-sm text-zinc-400">Klicke auf einen Quartalstermin.</p>
        <p className="mt-2 text-[11px] text-zinc-600">Konsens vs. Vorjahresquartal — wie bei Quartr.</p>
      </div>
    )
  }

  const q = daten?.quartalsPrognose
  const waehrung = q?.zeilen[0]?.waehrung ?? 'USD'

  return (
    <div className="flex h-full min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-[#eef0f1]/[0.08] bg-[#0c0c0d]">
      <div className="border-b border-[#eef0f1]/[0.06] px-4 py-4">
        <div className="flex items-start gap-3">
          <PortfolioIsinLogo isin={eintrag.isin} fallbackName={eintrag.name} meta={meta} groesse="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Next event</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-[#eef0f1]">
              {q?.quartalLabel ?? daten?.prognosePeriode ?? 'Quartalszahlen'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-zinc-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 ring-1 ring-white/[0.06]">
                {liveBadge(eintrag, daten)}
              </span>
              <span className="text-[12px] text-zinc-400">{formatEventDatum(eintrag.terminDatumIso)}</span>
              {!eintrag.bestaetigt ? <PaDividendEstimateBadge title="Geschätzter Termin" /> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {laden ? (
          <p className="py-10 text-center text-sm text-zinc-500">Quartalsprognosen werden geladen …</p>
        ) : fehler ? (
          <p className="py-8 text-sm text-amber-400/90">{fehler}</p>
        ) : !q || q.zeilen.length === 0 ? (
          <p className="py-8 text-sm text-zinc-500">
            Keine Quartals-Konsensdaten für diese Aktie (Yahoo earningsTrend).
          </p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                <th className="pb-2 pr-2 font-medium">{waehrung}</th>
                <th className="pb-2 pr-2 text-right font-medium">Estimate</th>
                <th className="pb-2 pr-2 text-right font-medium">{q.vorjahrQuartalLabel}</th>
                <th className="pb-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef0f1]/[0.06]">
              {q.zeilen.map((z) => (
                <tr key={z.metrik}>
                  <td className="py-3 pr-2 text-sm text-zinc-300">{z.label}</td>
                  <td className="py-3 pr-2 text-right text-sm font-semibold tabular-nums text-[#eef0f1]">
                    {z.schaetzungAnzeige ?? '—'}
                  </td>
                  <td className="py-3 pr-2 text-right text-sm tabular-nums text-zinc-500">
                    {z.vorjahrAnzeige ?? '—'}
                  </td>
                  <td className="py-3 text-right">
                    <ChangePill wachstumAnzeige={z.wachstumAnzeige} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="border-t border-[#eef0f1]/[0.06] px-4 py-2.5 text-[10px] leading-relaxed text-zinc-600">
        {daten
          ? `Quartals-Konsens: Yahoo Finance (yearAgoRevenue/EPS). Termin: ${eintrag.quelle}. EBITDA/EBIT folgen, sobald eine Quelle verfügbar ist.`
          : 'Daten werden beim Klick nachgeladen.'}
      </p>
    </div>
  )
}

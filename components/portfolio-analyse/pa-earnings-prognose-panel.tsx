'use client'

import { useEffect, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import { formatDatumDe } from '@/lib/portfolio-analyse/berechnung'
import type { AnkuendigtesEarningsEintrag } from '@/lib/portfolio-analyse/ankuendigte-earnings'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'
import { ladeEarningsSchaetzungenFuerEintrag } from '@/lib/portfolio-analyse/earnings-schaetzungen-client'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

function zeile(label: string, wert: string, spanne?: string | null) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums text-zinc-100">{wert}</p>
        {spanne ? <p className="text-[10px] tabular-nums text-zinc-500">{spanne}</p> : null}
      </div>
    </div>
  )
}

function formatSpanne(low: number | null, high: number | null, anzeige: string | null): string | null {
  if (low == null && high == null) return null
  const a = anzeige ?? (low != null && high != null ? `${low} – ${high}` : null)
  return a ? `Spanne ${a}` : null
}

function formatEps(s: EarningsSchaetzungen): { haupt: string; spanne: string | null } {
  const { eps } = s
  const haupt = eps.averageAnzeige ?? (eps.average != null ? eps.average.toLocaleString('de-DE', { maximumFractionDigits: 4 }) : '—')
  return { haupt, spanne: formatSpanne(eps.low, eps.high, null) }
}

function formatUmsatz(s: EarningsSchaetzungen): { haupt: string; spanne: string | null } {
  const { umsatz } = s
  const haupt = umsatz.averageAnzeige ?? (umsatz.average != null ? umsatz.average.toLocaleString('de-DE') : '—')
  const spanne =
    umsatz.low != null && umsatz.high != null
      ? formatSpanne(
          umsatz.low >= 1e9 ? umsatz.low / 1e9 : umsatz.low,
          umsatz.high >= 1e9 ? umsatz.high / 1e9 : umsatz.high,
          null,
        )
      : null
  return { haupt, spanne }
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
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-zinc-950/40 px-6 text-center">
        <p className="text-sm text-zinc-500">Klicke auf einen Termin oder eine Aktie, um Konsens-Prognosen zu sehen.</p>
        <p className="mt-2 text-[11px] text-zinc-600">EPS & Umsatz (Yahoo Finance, ggf. Finnhub)</p>
      </div>
    )
  }

  const eps = daten ? formatEps(daten) : null
  const umsatz = daten ? formatUmsatz(daten) : null

  return (
    <div className="flex h-full min-h-[16rem] flex-col rounded-xl border border-white/[0.08] bg-zinc-950/60">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <PortfolioIsinLogo isin={eintrag.isin} fallbackName={eintrag.name} meta={meta} groesse="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">{eintrag.name}</p>
            <p className="text-[11px] text-zinc-500">
              Termin {formatDatumDe(eintrag.terminDatumIso)}
              {!eintrag.bestaetigt ? (
                <span className="ml-1.5 inline-flex align-middle">
                  <PaDividendEstimateBadge title="Geschätzter Termin" />
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-2">
        {laden ? (
          <p className="py-8 text-center text-sm text-zinc-500">Prognosen werden geladen …</p>
        ) : fehler ? (
          <p className="py-6 text-sm text-amber-400/90">{fehler}</p>
        ) : !daten ? (
          <p className="py-6 text-sm text-zinc-500">
            Für diese Aktie sind keine Konsens-Schätzungen verfügbar (häufig bei kleinen EU-Titeln).
          </p>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {zeile('EPS (Konsens)', eps!.haupt, eps!.spanne)}
            {zeile('Umsatz (Konsens)', umsatz!.haupt, umsatz!.spanne)}
            {daten.berichtszeit ? zeile('Veröffentlichung', daten.berichtszeit) : null}
            {daten.quartal != null && daten.jahr != null
              ? zeile('Quartal', `Q${daten.quartal} ${daten.jahr}`)
              : null}
            {daten.earningsCallDateIso
              ? zeile('Earnings Call', formatDatumDe(daten.earningsCallDateIso))
              : null}
            {daten.terminDatumIso && daten.terminDatumIso !== eintrag.terminDatumIso
              ? zeile('Yahoo-Termin', formatDatumDe(daten.terminDatumIso))
              : null}
          </div>
        )}
      </div>

      <p className="border-t border-white/[0.04] px-4 py-2.5 text-[10px] leading-relaxed text-zinc-600">
        {daten
          ? `Quelle: ${daten.quelle === 'yahoo' ? 'Yahoo Finance' : 'Finnhub'} (Analystenkonsens). DivvyDiary liefert hier keine EPS/Umsatz-Prognosen.`
          : 'Daten werden beim Klick nachgeladen.'}
      </p>
    </div>
  )
}

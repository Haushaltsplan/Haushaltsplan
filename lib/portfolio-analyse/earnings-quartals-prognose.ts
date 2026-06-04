import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { formatWachstumProzent, wachstumProzent } from '@/lib/portfolio-analyse/earnings-kennzahlen'

export type QuartalsPrognoseMetrik = 'umsatz' | 'ebitda' | 'ebit' | 'eps' | 'capex'

export type QuartalsPrognoseZeile = {
  metrik: QuartalsPrognoseMetrik
  label: string
  waehrung: string
  schaetzung: number | null
  schaetzungAnzeige: string | null
  vorjahr: number | null
  vorjahrAnzeige: string | null
  wachstumProzent: number | null
  wachstumAnzeige: string | null
  /** Veröffentlichtes Ergebnis (nach Earnings). */
  istWert?: number | null
  istAnzeige?: string | null
  /** Abweichung Ist vs. Schätzung in %. */
  beatMissProzent?: number | null
  beatMissAnzeige?: string | null
}

export type EarningsQuartalsPrognose = {
  quartalLabel: string
  vorjahrQuartalLabel: string
  periodEndIso: string | null
  terminDatumIso: string | null
  berichtszeit: Berichtszeit | null
  berichtszeitLabel: string | null
  zeilen: QuartalsPrognoseZeile[]
}

export function formatKompaktUsd(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 })}M`
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function formatEpsUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function kalenderQuartalAusPeriodEnd(iso: string): { quartal: number; jahr: number; label: string } {
  const m = Number(iso.slice(5, 7))
  const jahr = Number(iso.slice(0, 4))
  const q = Math.ceil(m / 3)
  return { quartal: q, jahr, label: `Q${q} ${jahr}` }
}

export function vorjahrQuartalLabel(quartal: number, jahr: number): string {
  return `Q${quartal} ${jahr - 1}`
}

export function bauePrognoseZeile(
  metrik: QuartalsPrognoseMetrik,
  label: string,
  waehrung: string,
  schaetzung: number | null,
  vorjahr: number | null,
  wachstumOverride?: number | null,
): QuartalsPrognoseZeile | null {
  if (schaetzung == null && vorjahr == null) return null
  const w = wachstumOverride ?? wachstumProzent(schaetzung, vorjahr)
  const schaetzungAnzeige =
    schaetzung == null
      ? null
      : metrik === 'eps'
        ? formatEpsUsd(schaetzung)
        : formatKompaktUsd(schaetzung)
  const vorjahrAnzeige =
    vorjahr == null
      ? null
      : metrik === 'eps'
        ? formatEpsUsd(vorjahr)
        : formatKompaktUsd(vorjahr)

  return {
    metrik,
    label,
    waehrung,
    schaetzung,
    schaetzungAnzeige,
    vorjahr,
    vorjahrAnzeige,
    wachstumProzent: w,
    wachstumAnzeige: formatWachstumProzent(w),
  }
}

export const QUARTALS_METRIK_REIHENFOLGE: QuartalsPrognoseMetrik[] = [
  'umsatz',
  'ebitda',
  'ebit',
  'eps',
  'capex',
]

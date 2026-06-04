import type { EarningsSchaetzungSpanne } from '@/lib/portfolio-analyse/earnings-schaetzungen'

export type EarningsKennzahlSchluessel =
  | 'eps'
  | 'umsatz'
  | 'umsatz_je_aktie'
  | 'kgv'
  | 'dividende'
  | 'ebit'
  | 'ebitda'
  | 'free_cashflow'
  | 'nettogewinn'
  | 'sonstiges'

export type EarningsVergleichArt = 'vorjahr_quartal' | 'vorjahr_geschaeftsjahr' | 'vorperiode'

export type EarningsKennzahlPrognose = {
  schluessel: EarningsKennzahlSchluessel
  label: string
  spanne: EarningsSchaetzungSpanne
  vorjahrWert: number | null
  vorjahrAnzeige: string | null
  wachstumProzent: number | null
  wachstumAnzeige: string | null
  vergleichArt: EarningsVergleichArt | null
  vergleichLabel: string | null
  hinweis?: string | null
}

export function wachstumProzent(konsens: number | null, vorjahr: number | null): number | null {
  if (konsens == null || vorjahr == null || vorjahr === 0) return null
  return ((konsens - vorjahr) / Math.abs(vorjahr)) * 100
}

export function formatWachstumProzent(p: number | null): string | null {
  if (p == null || !Number.isFinite(p)) return null
  const vorzeichen = p > 0 ? '+' : ''
  return `${vorzeichen}${p.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

export function formatGrosserBetrag(n: number, waehrung = '€'): string {
  if (n >= 1e12) return `${(n / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Bio. ${waehrung}`
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd. ${waehrung}`
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio. ${waehrung}`
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${waehrung}`
}

export function kennzahlAusSpanne(
  schluessel: EarningsKennzahlSchluessel,
  label: string,
  spanne: EarningsSchaetzungSpanne,
  opts?: {
    vorjahrWert?: number | null
    vorjahrAnzeige?: string | null
    wachstumProzent?: number | null
    vergleichArt?: EarningsVergleichArt | null
    vergleichLabel?: string | null
    hinweis?: string | null
  },
): EarningsKennzahlPrognose | null {
  if (spanne.average == null && spanne.averageAnzeige == null) return null
  const w =
    opts?.wachstumProzent ??
    wachstumProzent(spanne.average, opts?.vorjahrWert ?? null)
  return {
    schluessel,
    label,
    spanne,
    vorjahrWert: opts?.vorjahrWert ?? null,
    vorjahrAnzeige: opts?.vorjahrAnzeige ?? null,
    wachstumProzent: w,
    wachstumAnzeige: formatWachstumProzent(w),
    vergleichArt: opts?.vergleichArt ?? null,
    vergleichLabel: opts?.vergleichLabel ?? null,
    hinweis: opts?.hinweis ?? null,
  }
}

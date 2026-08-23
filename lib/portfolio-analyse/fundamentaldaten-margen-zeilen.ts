/**
 * Abgeleitete Margen-Zeilen: wenn GuV da ist, aber Macrotrends financial-ratios hinkt
 * (typisch EU/URD FY), fehlende ebit_marge/bruttomarge/… aus Quotienten füllen.
 */
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  const v = zeilen.find((z) => z.id === id)?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

function upsert(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  label: string,
  gruppe: FundamentalMetrikZeile['gruppe'],
  einheit: FundamentalMetrikZeile['einheit'],
  werte: Record<string, number | null>,
): void {
  const existing = zeilen.find((z) => z.id === id)
  if (existing) {
    for (const [k, v] of Object.entries(werte)) {
      if (v == null) continue
      if (existing.werte[k] == null) existing.werte[k] = v
    }
    return
  }
  zeilen.push({ id, label, gruppe, einheit, werte })
}

function margePct(zaehler: number | null, umsatz: number | null): number | null {
  if (zaehler == null || umsatz == null || !(umsatz > 0)) return null
  return Math.round((zaehler / umsatz) * 1000) / 10
}

/** Füllt nur null-Zellen — Macrotrends-Ratios bleiben unangetastet. */
export function ergaenzeMargenZeilen(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): void {
  if (perioden.length === 0) return

  const brutto: Record<string, number | null> = {}
  const ebit: Record<string, number | null> = {}
  const ebitda: Record<string, number | null> = {}
  const netto: Record<string, number | null> = {}
  let hat = false

  for (const p of perioden) {
    const u = wert(zeilen, 'umsatz', p.iso)
    const bg = margePct(wert(zeilen, 'bruttogewinn', p.iso), u)
    const em = margePct(wert(zeilen, 'ebit', p.iso), u)
    const edm = margePct(wert(zeilen, 'ebitda', p.iso), u)
    const nm = margePct(wert(zeilen, 'nettogewinn', p.iso), u)
    brutto[p.iso] = bg
    ebit[p.iso] = em
    ebitda[p.iso] = edm
    netto[p.iso] = nm
    if (bg != null || em != null || edm != null || nm != null) hat = true
  }

  if (!hat) return

  upsert(zeilen, 'bruttomarge', 'Bruttomarge', 'rentabilitaet', 'prozent', brutto)
  upsert(zeilen, 'ebit_marge', 'EBIT-Marge', 'rentabilitaet', 'prozent', ebit)
  upsert(zeilen, 'ebitda_marge', 'EBITDA-Marge', 'rentabilitaet', 'prozent', ebitda)
  upsert(zeilen, 'nettomarge', 'Nettomarge', 'rentabilitaet', 'prozent', netto)
}

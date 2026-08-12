/**
 * Historische EV/Umsatz & EV/EBITDA aus Marktkapitalisierung + Nettoverschuldung.
 *
 * EV = Marktkap + Schulden − Cash
 * Primär: Macrotrends market-cap Chart (v3 in Mrd. → Mio.)
 * Fallback: P/S × Umsatz, dann KGV × EPS × Aktien
 *
 * Werte werden periodennahe gematcht (±45 Tage / gleiches Jahr), weil nach dem
 * Yahoo/SA-GuV-Merge Umsatz auf neuen FY-ISOs liegt, Marktkap/P/S oft noch auf
 * Macrotrends-Daten — exakter Key-Match ließ die Historie leer.
 */
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  return wertAusMapFuerIso(zeilen.find((z) => z.id === id)?.werte, key)
}

function safeDiv(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !(b > 0)) return null
  const r = a / b
  return Number.isFinite(r) ? r : null
}

function marktKapMio(zeilen: FundamentalMetrikZeile[], key: string): number | null {
  const direkt = wert(zeilen, 'marktkapitalisierung', key)
  if (direkt != null && direkt > 0) return direkt

  const umsatz = wert(zeilen, 'umsatz', key)
  const ps = wert(zeilen, 'ps', key)
  if (ps != null && ps > 0 && umsatz != null && umsatz > 0) return ps * umsatz

  const pe = wert(zeilen, 'kgv', key)
  const eps = wert(zeilen, 'eps', key)
  const aktien = wert(zeilen, 'aktien', key)
  if (pe != null && pe > 0 && eps != null && eps > 0 && aktien != null && aktien > 0) {
    return pe * eps * aktien
  }
  return null
}

function nettoVerschuldungMio(zeilen: FundamentalMetrikZeile[], key: string): number | null {
  const netto = wert(zeilen, 'nettoverschuldung', key)
  if (netto != null && Number.isFinite(netto)) return netto
  const debt = wert(zeilen, 'gesamtverschuldung', key)
  const cash = wert(zeilen, 'bargeld', key)
  if (debt == null && cash == null) return null
  return (debt ?? 0) - (cash ?? 0)
}

/** Enterprise Value in Mio. USD für eine Perioden-Spalte. */
export function enterpriseValueMioFuerKey(
  zeilen: FundamentalMetrikZeile[],
  key: string,
): number | null {
  const mc = marktKapMio(zeilen, key)
  if (mc == null) return null
  const nd = nettoVerschuldungMio(zeilen, key)
  return nd != null ? mc + nd : mc
}

function upsertZeile(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  label: string,
  werte: Record<string, number | null>,
  /** true = historische Keys immer überschreiben (auch null) */
  overwriteKeys: boolean,
): void {
  const existing = zeilen.find((z) => z.id === id)
  if (!existing) {
    zeilen.push({
      id,
      label,
      gruppe: 'bewertung_trailing',
      einheit: 'multiple',
      werte: { ...werte },
    })
    return
  }
  for (const [k, v] of Object.entries(werte)) {
    if (overwriteKeys || v != null) existing.werte[k] = v
    else if (!(k in existing.werte)) existing.werte[k] = null
  }
}

/**
 * Füllt historische (und optional TTM-) EV-Multiples in-place.
 * Schätz-Spalten bleiben unberührt, sofern bereits gesetzt.
 */
export function ergaenzeEvMultiplesZeilen(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): void {
  if (perioden.length === 0) return

  const histKeys = perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)

  const keys = [...histKeys]
  if (perioden.some((p) => p.iso === FUNDAMENTAL_TTM_KEY || p.istLtm)) {
    keys.push(FUNDAMENTAL_TTM_KEY)
  }

  const evRev: Record<string, number | null> = {}
  const evEbitda: Record<string, number | null> = {}
  let hat = false

  for (const key of keys) {
    const ev = enterpriseValueMioFuerKey(zeilen, key)
    const rev = wert(zeilen, 'umsatz', key)
    const ebitda = wert(zeilen, 'ebitda', key) ?? wert(zeilen, 'ebit', key)
    evRev[key] = safeDiv(ev, rev)
    evEbitda[key] = safeDiv(ev, ebitda != null && ebitda > 0 ? ebitda : null)
    if (evRev[key] != null || evEbitda[key] != null) hat = true
  }

  if (!hat) return
  upsertZeile(zeilen, 'ev_rev', 'EV / Umsatz', evRev, true)
  upsertZeile(zeilen, 'ev_ebitda', 'EV / EBITDA', evEbitda, true)
}

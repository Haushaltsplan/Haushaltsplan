/**
 * Berechnet historische ROIC-Zeitreihe aus GuV/Bilanz.
 * Zusätzlich: ROIC ex Goodwill (NOPAT / (IC − Goodwill)).
 *
 * IC = Eigenkapital + verzinsliche Schulden — **ohne Cash-Abzug**.
 * Bargeld rauszurechnen lässt den Nenner bei cash-starken Qualitätsfirmen
 * (ASML, MA, …) kollabieren und erzeugt 80–130 %-Artefakte. Dieselbe
 * Brutto-Definition steht in `kapitalbasis-ableitung.ts`.
 */

import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'

const DEFAULT_TAX = 0.21
/** Ex-Goodwill > 100 % ist fast immer ein Nenner-Artefakt. */
const MAX_ROIC_EX_GW = 100
const MAX_ROIC = 80

function wert(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  return wertAusMapFuerIso(zeilen.find((z) => z.id === id)?.werte, key)
}

function upsertZeile(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  label: string,
  werte: Record<string, number | null>,
  nurFehlende = true,
): void {
  const existing = zeilen.find((z) => z.id === id)
  if (!existing) {
    zeilen.push({
      id,
      label,
      gruppe: 'rentabilitaet',
      einheit: 'prozent',
      werte: { ...werte },
    })
    return
  }
  for (const [k, v] of Object.entries(werte)) {
    if (v == null) continue
    if (!nurFehlende || existing.werte[k] == null || !Number.isFinite(existing.werte[k]!)) {
      existing.werte[k] = v
    }
  }
}

function histKeysAusPerioden(perioden: FundamentalPeriode[]): string[] {
  const histKeys = perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
  const keys = [...histKeys]
  if (perioden.some((p) => p.iso === FUNDAMENTAL_TTM_KEY || p.istLtm)) {
    keys.push(FUNDAMENTAL_TTM_KEY)
  }
  return keys
}

function anzahlNonNull(zeilen: FundamentalMetrikZeile[], id: string, keys: string[]): number {
  const z = zeilen.find((r) => r.id === id)
  if (!z) return 0
  return keys.filter((k) => z.werte[k] != null && Number.isFinite(z.werte[k]!)).length
}

function investedBrutto(zeilen: FundamentalMetrikZeile[], key: string): number | null {
  const equity = wert(zeilen, 'eigenkapital', key)
  if (equity == null) return null
  const debt = wert(zeilen, 'gesamtverschuldung', key)
  const ic = equity + (debt ?? 0)
  return ic > 0 ? ic : null
}

function investedDurchschnitt(
  zeilen: FundamentalMetrikZeile[],
  key: string,
  histOnly: string[],
): number | null {
  const cur = investedBrutto(zeilen, key)
  if (key === FUNDAMENTAL_TTM_KEY) {
    const a = histOnly.length >= 1 ? investedBrutto(zeilen, histOnly[histOnly.length - 1]!) : null
    const b = histOnly.length >= 2 ? investedBrutto(zeilen, histOnly[histOnly.length - 2]!) : null
    if (a != null && b != null) return (a + b) / 2
    return a ?? cur
  }
  const idx = histOnly.indexOf(key)
  const prev = idx > 0 ? investedBrutto(zeilen, histOnly[idx - 1]!) : null
  if (prev != null && cur != null) return (prev + cur) / 2
  return cur
}

/**
 * Füllt ROIC-Jahre in-place (Brutto-IC, Durchschnitt aus t und t−1).
 * Schreibt immer auch `roi_ex_goodwill`, wenn Goodwill + IC verfügbar.
 */
export function ergaenzeRoicAusBilanz(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): void {
  if (perioden.length === 0) return

  const keys = histKeysAusPerioden(perioden)
  const histOnly = keys.filter((k) => k !== FUNDAMENTAL_TTM_KEY)

  const roiWerte: Record<string, number | null> = {}
  const roiExGw: Record<string, number | null> = {}
  let hatRoi = false
  let hatExGw = false

  for (const key of keys) {
    const ebit = wert(zeilen, 'ebit', key)
    const goodwill = wert(zeilen, 'goodwill', key)
    const invested = investedDurchschnitt(zeilen, key, histOnly)

    if (ebit == null || invested == null || invested <= 0) {
      roiWerte[key] = null
      roiExGw[key] = null
      continue
    }

    const nopat = ebit * (1 - DEFAULT_TAX)
    const roic = (nopat / invested) * 100
    // Auch negative ROIC ausweisen (Verlustjahre); Extremwerte weiter kappen
    if (Number.isFinite(roic) && Math.abs(roic) <= MAX_ROIC) {
      roiWerte[key] = Math.round(roic * 10) / 10
      hatRoi = true
    } else {
      roiWerte[key] = null
    }

    const hatGoodwill = goodwill != null && goodwill > 0
    const investedExGw = hatGoodwill ? invested - goodwill : invested
    const gwDominiert = hatGoodwill && invested > 0 && goodwill! >= invested * 0.85
    if (hatGoodwill && investedExGw > 0 && !gwDominiert) {
      const roicX = (nopat / investedExGw) * 100
      if (Number.isFinite(roicX) && Math.abs(roicX) <= MAX_ROIC_EX_GW) {
        roiExGw[key] = Math.round(roicX * 10) / 10
        hatExGw = true
      } else {
        roiExGw[key] = null
      }
    } else if (invested > 0 && !hatGoodwill) {
      roiExGw[key] = roiWerte[key]
      if (roiExGw[key] != null) hatExGw = true
    } else {
      roiExGw[key] = null
    }
  }

  if (hatRoi) {
    upsertZeile(zeilen, 'roi', 'Return on Invested Capital (ROIC %)', roiWerte, false)
  }
  if (hatExGw) {
    upsertZeile(zeilen, 'roi_ex_goodwill', 'ROIC ex Goodwill %', roiExGw, false)
  } else {
    const gwN = anzahlNonNull(zeilen, 'goodwill', histOnly)
    const existing = zeilen.find((r) => r.id === 'roi_ex_goodwill')
    if (gwN > 0 && existing) {
      for (const key of keys) {
        existing.werte[key] = null
      }
    } else if (gwN === 0) {
      const roiZ = zeilen.find((r) => r.id === 'roi')
      if (roiZ) {
        const spiegel: Record<string, number | null> = {}
        for (const key of keys) {
          const v = roiZ.werte[key]
          if (v != null && Number.isFinite(v)) spiegel[key] = v
        }
        if (Object.keys(spiegel).length > 0) {
          upsertZeile(zeilen, 'roi_ex_goodwill', 'ROIC ex Goodwill %', spiegel, true)
        }
      }
    }
  }
}

/** Letzter verfügbarer ROIC ex Goodwill (für Key Metrics / Mantra). */
export function letzterRoicExGoodwill(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): number | null {
  const keys = histKeysAusPerioden(perioden).filter((k) => k !== FUNDAMENTAL_TTM_KEY)
  const z = zeilen.find((r) => r.id === 'roi_ex_goodwill')
  if (!z) return null
  for (let i = keys.length - 1; i >= 0; i--) {
    const v = z.werte[keys[i]!]
    if (v != null && Number.isFinite(v)) return v
  }
  const ttm = z.werte[FUNDAMENTAL_TTM_KEY]
  return ttm != null && Number.isFinite(ttm) ? ttm : null
}

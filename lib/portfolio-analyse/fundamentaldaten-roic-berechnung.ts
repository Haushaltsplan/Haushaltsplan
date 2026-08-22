/**
 * Berechnet historische ROIC-Zeitreihe aus GuV/Bilanz, wenn Macrotrends ROI fehlt.
 * Zusätzlich: ROIC ex Goodwill (NOPAT / (IC − Goodwill)).
 */

import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'

const DEFAULT_TAX = 0.21

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

/**
 * Füllt fehlende ROIC-Jahre in-place. Bestehende Macrotrends-Werte bleiben.
 * Schreibt immer auch `roi_ex_goodwill`, wenn Goodwill + IC verfügbar.
 */
export function ergaenzeRoicAusBilanz(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): void {
  if (perioden.length === 0) return

  const keys = histKeysAusPerioden(perioden)
  const histOnly = keys.filter((k) => k !== FUNDAMENTAL_TTM_KEY)
  const brauchtRoiFill = anzahlNonNull(zeilen, 'roi', histOnly) < 3

  const roiWerte: Record<string, number | null> = {}
  const roiExGw: Record<string, number | null> = {}
  let hatRoi = false
  let hatExGw = false

  for (const key of keys) {
    const ebit = wert(zeilen, 'ebit', key)
    const equity = wert(zeilen, 'eigenkapital', key)
    const debt = wert(zeilen, 'gesamtverschuldung', key)
    const cash = wert(zeilen, 'bargeld', key)
    const goodwill = wert(zeilen, 'goodwill', key)

    if (ebit == null || equity == null) {
      roiWerte[key] = null
      roiExGw[key] = null
      continue
    }

    const invested = equity + (debt ?? 0) - (cash ?? 0)
    const nopat = ebit * (1 - DEFAULT_TAX)

    if (invested > 0) {
      const roic = (nopat / invested) * 100
      if (Number.isFinite(roic) && Math.abs(roic) <= 200) {
        roiWerte[key] = Math.round(roic * 10) / 10
        hatRoi = true
      } else {
        roiWerte[key] = null
      }
    } else {
      roiWerte[key] = null
    }

    const investedExGw =
      goodwill != null && goodwill > 0 ? invested - goodwill : invested
    if (investedExGw > 0 && goodwill != null && goodwill > 0) {
      const roicX = (nopat / investedExGw) * 100
      if (Number.isFinite(roicX) && Math.abs(roicX) <= 400) {
        roiExGw[key] = Math.round(roicX * 10) / 10
        hatExGw = true
      } else {
        roiExGw[key] = null
      }
    } else if (invested > 0 && (goodwill == null || goodwill <= 0)) {
      roiExGw[key] = roiWerte[key]
      if (roiExGw[key] != null) hatExGw = true
    } else {
      roiExGw[key] = null
    }
  }

  if (brauchtRoiFill && hatRoi) {
    upsertZeile(zeilen, 'roi', 'Return on Invested Capital (ROIC %)', roiWerte, true)
  }
  if (hatExGw) {
    upsertZeile(zeilen, 'roi_ex_goodwill', 'ROIC ex Goodwill %', roiExGw, false)
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

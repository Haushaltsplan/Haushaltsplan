import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { baueRoiicWerteAusMacrotrendsZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { StockanalysisRoicDaten, StockanalysisRoiicDaten } from '@/lib/portfolio-analyse/stockanalysis-roic-server'

function findePeriodenIso(
  perioden: FundamentalPeriode[],
  asOfDate: string,
): string | null {
  const fy = perioden.filter((p) => !p.istLtm && !p.istSchaetzung)
  const exact = fy.find((p) => p.iso === asOfDate)
  if (exact) return exact.iso

  const jahr = asOfDate.slice(0, 4)
  const kandidaten = fy.filter((p) => p.iso.startsWith(jahr))
  if (kandidaten.length === 0) return null
  if (kandidaten.length === 1) return kandidaten[0]!.iso

  const ziel = new Date(asOfDate).getTime()
  let best = kandidaten[0]!
  let bestDiff = Math.abs(new Date(best.iso).getTime() - ziel)
  for (const k of kandidaten.slice(1)) {
    const diff = Math.abs(new Date(k.iso).getTime() - ziel)
    if (diff < bestDiff) {
      best = k
      bestDiff = diff
    }
  }
  return best.iso
}

function mappeAufMacrotrendsPerioden(
  werte: Record<string, number>,
  perioden: FundamentalPeriode[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, v] of Object.entries(werte)) {
    if (key === FUNDAMENTAL_TTM_KEY) {
      out[key] = v
      continue
    }
    const iso = findePeriodenIso(perioden, key)
    if (iso) out[iso] = v
  }
  return out
}

/** Füllt fehlende ROIC-Werte in der `roi`-Zeile aus StockAnalysis. */
export function ergaenzeRoicZeile(
  zeilen: FundamentalMetrikZeile[],
  perioden: FundamentalPeriode[],
  roicDaten: StockanalysisRoicDaten | null,
): boolean {
  if (!roicDaten || Object.keys(roicDaten.werte).length === 0) return false

  const gemappt = mappeAufMacrotrendsPerioden(roicDaten.werte, perioden)
  if (Object.keys(gemappt).length === 0) return false

  let roiZeile = zeilen.find((z) => z.id === 'roi')
  if (!roiZeile) {
    roiZeile = {
      id: 'roi',
      label: 'Kapitalrendite (ROIC %)',
      gruppe: 'rentabilitaet',
      einheit: 'prozent',
      werte: {},
    }
    zeilen.push(roiZeile)
  }

  let ergaenzt = false
  for (const [iso, v] of Object.entries(gemappt)) {
    if (roiZeile.werte[iso] == null) {
      roiZeile.werte[iso] = v
      ergaenzt = true
    }
  }
  return ergaenzt
}

/** Baut die ROIIC-Zeile (YoY ΔNOPAT / ΔIC) für die Rentabilitätstabelle. */
export function ergaenzeRoiicZeile(
  zeilen: FundamentalMetrikZeile[],
  perioden: FundamentalPeriode[],
  ebitZeile: FundamentalMetrikZeile | undefined,
  roiZeile: FundamentalMetrikZeile | undefined,
  roiicDaten: StockanalysisRoiicDaten | null,
): boolean {
  const werte: Record<string, number> = {
    ...baueRoiicWerteAusMacrotrendsZeilen(perioden, ebitZeile, roiZeile),
  }

  if (roiicDaten?.werte && Object.keys(roiicDaten.werte).length > 0) {
    const gemappt = mappeAufMacrotrendsPerioden(roiicDaten.werte, perioden)
    for (const [iso, v] of Object.entries(gemappt)) {
      werte[iso] = v
    }
  }

  if (Object.keys(werte).length === 0) return false

  const roiicZeile: FundamentalMetrikZeile = {
    id: 'roiic',
    label: 'Inkrementelle Kapitalrendite (ROIIC %)',
    gruppe: 'rentabilitaet',
    einheit: 'prozent',
    werte,
  }

  const existingIdx = zeilen.findIndex((z) => z.id === 'roiic')
  if (existingIdx >= 0) zeilen.splice(existingIdx, 1)

  const roiIdx = zeilen.findIndex((z) => z.id === 'roi')
  if (roiIdx >= 0) zeilen.splice(roiIdx + 1, 0, roiicZeile)
  else zeilen.push(roiicZeile)

  return true
}

export function roiZeileBrauchtFallback(
  zeilen: FundamentalMetrikZeile[],
  perioden: FundamentalPeriode[],
): boolean {
  const roiZeile = zeilen.find((z) => z.id === 'roi')
  if (!roiZeile) return true
  const keys = perioden.filter((p) => !p.istSchaetzung).map((p) => p.iso)
  return keys.some((k) => roiZeile.werte[k] == null)
}

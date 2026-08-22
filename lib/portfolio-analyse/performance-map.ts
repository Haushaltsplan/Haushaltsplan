import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { AssetKlasse } from '@/lib/portfolio-analyse/types'
import { sektorFuerPosition } from '@/lib/portfolio-analyse/isin-sektoren'
import type { FundamentalSektorLookup } from '@/lib/portfolio-analyse/sektor-fundamental-client'

export type PerformanceMapTile = {
  id: string
  label: string
  isin: string | null
  assetKlasse: AssetKlasse
  wertEur: number
  gewichtProzent: number
  performanceProzent: number | null
}

export type PerformanceMapSektor = {
  name: string
  wertEur: number
  gewichtProzent: number
  tiles: PerformanceMapTile[]
}

export type PerformanceGroesse = 'markt' | 'kauf'

export function performanceFarbe(prozent: number | null): { background: string; color: string } {
  if (prozent == null || !Number.isFinite(prozent)) {
    return { background: '#3f3f46', color: '#d4d4d8' }
  }
  if (Math.abs(prozent) < 0.05) {
    return { background: '#52525b', color: '#e4e4e7' }
  }
  if (prozent > 0) {
    const t = Math.min(1, prozent / 12)
    const r = Math.round(34 + (1 - t) * 40)
    const g = Math.round(120 + t * 77)
    const b = Math.round(80 + t * 20)
    return { background: `rgb(${r},${g},${b})`, color: t > 0.35 ? '#fff' : '#ecfdf5' }
  }
  const t = Math.min(1, Math.abs(prozent) / 12)
  const r = Math.round(180 + t * 75)
  const g = Math.round(90 - t * 40)
  const b = Math.round(80 - t * 30)
  return { background: `rgb(${r},${g},${b})`, color: t > 0.35 ? '#fff' : '#fef2f2' }
}

export function bauePerformanceMap(
  positionen: LivePosition[],
  groesse: PerformanceGroesse = 'markt',
  sektorLookup?: FundamentalSektorLookup,
): PerformanceMapSektor[] {
  const summe = positionen.reduce((s, p) => s + (groesse === 'markt' ? p.wertLiveEur : p.einstandEur), 0) || 1
  const bySektor = new Map<string, PerformanceMapTile[]>()

  for (const p of positionen) {
    const wert = groesse === 'markt' ? p.wertLiveEur : p.einstandEur
    if (wert <= 0) continue
    const sektor = sektorFuerPosition(p, sektorLookup)
    const perf =
      p.aenderungTagProzent != null && p.hatLiveKurs
        ? p.aenderungTagProzent
        : p.gewinnVerlustProzent
    const tile: PerformanceMapTile = {
      id: p.isin ?? p.anzeigeName,
      label: p.anzeigeName,
      isin: p.isin,
      assetKlasse: p.assetKlasse,
      wertEur: Math.round(wert * 100) / 100,
      gewichtProzent: Math.round((wert / summe) * 10000) / 100,
      performanceProzent: perf,
    }
    const list = bySektor.get(sektor) ?? []
    list.push(tile)
    bySektor.set(sektor, list)
  }

  return [...bySektor.entries()]
    .map(([name, tiles]) => {
      const wertEur = tiles.reduce((s, t) => s + t.wertEur, 0)
      return {
        name,
        wertEur: Math.round(wertEur * 100) / 100,
        gewichtProzent: Math.round((wertEur / summe) * 10000) / 100,
        tiles: tiles.sort((a, b) => b.wertEur - a.wertEur),
      }
    })
    .sort((a, b) => b.wertEur - a.wertEur)
}

export function hatXrayLookthrough(
  report: {
    xRay: { topHoldings: { key: string; label: string; weightPercent: number }[] }
    holdings: { assetId: string; assetType?: string }[]
  } | null,
  etfBreakdowns?: Map<string, unknown>,
): boolean {
  if (!report) return false
  if (etfBreakdowns && etfBreakdowns.size > 0) return true
  const direkt = report.holdings.filter((h) => h.assetType !== 'ETF').length
  return report.xRay.topHoldings.length > direkt
}

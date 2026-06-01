import type { DonutSegment } from '@/components/finanzen/donut-chart'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { AllocationSlice } from '@/lib/portfolio-analyse/parqet-core/types'
import type { AssetKlasse } from '@/lib/portfolio-analyse/types'
import { ASSET_KLASSE_FARBE, ASSET_KLASSE_LABEL } from '@/lib/portfolio-analyse/types'

const PALETTE = [
  '#6366f1',
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#a78bfa',
  '#fb7185',
  '#60a5fa',
  '#4ade80',
  '#f97316',
  '#e879f9',
  '#2dd4bf',
]

export type GewichtungEintrag = {
  key: string
  label: string
  wertEur: number
  gewichtProzent: number
  anzahl: number
  farbe: string
}

export type GewichtungDimension = 'asset' | 'assetklasse' | 'sektor' | 'region' | 'typ'

export function gewichtungNachAsset(positionen: LivePosition[]): GewichtungEintrag[] {
  const summe = positionen.reduce((s, p) => s + p.wertLiveEur, 0) || 1
  return positionen
    .filter((p) => p.wertLiveEur > 0)
    .sort((a, b) => b.wertLiveEur - a.wertLiveEur)
    .map((p, i) => ({
      key: p.isin ?? p.anzeigeName,
      label: p.anzeigeName,
      wertEur: Math.round(p.wertLiveEur * 100) / 100,
      gewichtProzent: Math.round((p.wertLiveEur / summe) * 10000) / 100,
      anzahl: 1,
      farbe: PALETTE[i % PALETTE.length],
    }))
}

export function gewichtungNachAssetklasse(positionen: LivePosition[]): GewichtungEintrag[] {
  const summe = positionen.reduce((s, p) => s + p.wertLiveEur, 0) || 1
  const map = new Map<AssetKlasse, { wert: number; count: number }>()
  for (const p of positionen) {
    if (p.wertLiveEur <= 0) continue
    const cur = map.get(p.assetKlasse) ?? { wert: 0, count: 0 }
    cur.wert += p.wertLiveEur
    cur.count += 1
    map.set(p.assetKlasse, cur)
  }
  return [...map.entries()]
    .sort((a, b) => b[1].wert - a[1].wert)
    .map(([klasse, { wert, count }], i) => ({
      key: klasse,
      label: ASSET_KLASSE_LABEL[klasse],
      wertEur: Math.round(wert * 100) / 100,
      gewichtProzent: Math.round((wert / summe) * 10000) / 100,
      anzahl: count,
      farbe: ASSET_KLASSE_FARBE[klasse] ?? PALETTE[i % PALETTE.length],
    }))
}

export function gewichtungAusSlices(slices: AllocationSlice[]): GewichtungEintrag[] {
  return slices
    .filter((s) => s.valueEUR > 0)
    .sort((a, b) => b.valueEUR - a.valueEUR)
    .map((s, i) => ({
      key: s.key,
      label: s.label,
      wertEur: s.valueEUR,
      gewichtProzent: s.weightPercent,
      anzahl: 1,
      farbe: s.colorHint ?? PALETTE[i % PALETTE.length],
    }))
}

export function eintraegeZuDonut(eintraege: GewichtungEintrag[], max = 12): DonutSegment[] {
  const top = eintraege.slice(0, max)
  const rest = eintraege.slice(max).reduce((s, e) => s + e.wertEur, 0)
  const seg: DonutSegment[] = top.map((e) => ({
    key: e.key,
    label: e.label.length > 24 ? `${e.label.slice(0, 22)}…` : e.label,
    farbe: e.farbe,
    betrag: e.wertEur,
  }))
  if (rest > 0.01) {
    seg.push({ key: 'rest', label: 'Weitere', farbe: '#64748b', betrag: Math.round(rest * 100) / 100 })
  }
  return seg
}

export function gewichtungStatistik(eintraege: GewichtungEintrag[], dimension: GewichtungDimension): string {
  const n = eintraege.length
  if (dimension === 'asset') return `${n} Assets`
  if (dimension === 'assetklasse' || dimension === 'typ') {
    const pos = eintraege.reduce((s, e) => s + e.anzahl, 0)
    return `${n} Assetklassen · ${pos} Assets`
  }
  const pos = eintraege.reduce((s, e) => s + e.anzahl, 0)
  return `${n} Gruppen · ${pos} gewichtete Anteile`
}

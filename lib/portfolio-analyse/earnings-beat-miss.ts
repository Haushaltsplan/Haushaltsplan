import { formatWachstumProzent, wachstumProzent } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import { formatEpsUsd, formatKompaktUsd } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import type { QuartalsPrognoseMetrik } from '@/lib/portfolio-analyse/earnings-quartals-prognose'

export function beatMissProzent(ist: number | null, schaetzung: number | null): number | null {
  if (ist == null || schaetzung == null || schaetzung === 0) return null
  return ((ist - schaetzung) / Math.abs(schaetzung)) * 100
}

export function formatBeatMissProzent(p: number | null): string | null {
  if (p == null || !Number.isFinite(p)) return null
  const w = formatWachstumProzent(p)
  if (!w) return null
  if (p > 0.05) return `Beat ${w}`
  if (p < -0.05) return `Miss ${w}`
  return `Inline ${w}`
}

export function formatIstWert(metrik: QuartalsPrognoseMetrik, n: number): string {
  return metrik === 'eps' ? formatEpsUsd(n) : formatKompaktUsd(n)
}

export function beatMissAusSurprisePercent(surprisePercent: number | null | undefined): number | null {
  if (surprisePercent == null || !Number.isFinite(surprisePercent)) return null
  return surprisePercent
}

export function vorjahrWachstumAnzeige(schaetzung: number | null, vorjahr: number | null): string | null {
  return formatWachstumProzent(wachstumProzent(schaetzung, vorjahr))
}

import type {
  AssetKlasse,
  PortfolioAnalyseKennzahlen,
  PortfolioBuchung,
  PortfolioDbSnapshot,
  PortfolioPositionSnapshot,
} from '@/lib/portfolio-analyse/types'
import { ASSET_KLASSE_FARBE, ASSET_KLASSE_LABEL } from '@/lib/portfolio-analyse/types'
import type { DonutSegment } from '@/components/finanzen/donut-chart'

export function berechneKennzahlen(
  buchungen: PortfolioBuchung[],
  snapshot: PortfolioDbSnapshot | null,
): PortfolioAnalyseKennzahlen {
  let investiertEur = 0
  let dividendenEur = 0
  let zinsenEur = 0
  let einzahlungenEur = 0
  let auszahlungenEur = 0

  for (const b of buchungen) {
    switch (b.typ) {
      case 'kauf':
        investiertEur += b.betragEur
        break
      case 'verkauf':
        investiertEur -= b.betragEur
        break
      case 'dividende':
        dividendenEur += b.betragEur
        break
      case 'zins':
        zinsenEur += b.betragEur
        break
      case 'einzahlung':
        einzahlungenEur += b.betragEur
        break
      case 'auszahlung':
        auszahlungenEur += b.betragEur
        break
      default:
        break
    }
  }

  const positionen = snapshot?.positionen ?? []
  const depotwertEur =
    snapshot?.depotwert_eur ??
    (positionen.length > 0 ? positionen.reduce((s, p) => s + p.wertEur, 0) : 0)

  const nettoInvestiert = Math.max(0, Math.round(investiertEur * 100) / 100)
  const gewinnVerlustEur = Math.round((depotwertEur - nettoInvestiert + dividendenEur + zinsenEur) * 100) / 100
  const gewinnVerlustProzent =
    nettoInvestiert > 0 ? Math.round((gewinnVerlustEur / nettoInvestiert) * 10000) / 100 : null

  return {
    depotwertEur: Math.round(depotwertEur * 100) / 100,
    investiertEur: nettoInvestiert,
    gewinnVerlustEur,
    gewinnVerlustProzent,
    dividendenEur: Math.round(dividendenEur * 100) / 100,
    zinsenEur: Math.round(zinsenEur * 100) / 100,
    einzahlungenEur: Math.round(einzahlungenEur * 100) / 100,
    auszahlungenEur: Math.round(auszahlungenEur * 100) / 100,
    anzahlPositionen: positionen.length,
    anzahlBuchungen: buchungen.length,
  }
}

export function allokationDonutSegmente(positionen: PortfolioPositionSnapshot[]): DonutSegment[] {
  const summen = new Map<AssetKlasse, number>()
  for (const p of positionen) {
    summen.set(p.assetKlasse, (summen.get(p.assetKlasse) ?? 0) + p.wertEur)
  }
  return [...summen.entries()]
    .filter(([, betrag]) => betrag > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([klasse, betrag]) => ({
      key: klasse,
      label: ASSET_KLASSE_LABEL[klasse],
      farbe: ASSET_KLASSE_FARBE[klasse],
      betrag: Math.round(betrag * 100) / 100,
    }))
}

/** Stückzahlen offener Positionen — einheitlich 2 Nachkommastellen. */
export const POSITION_STUECK_DEZIMALEN = 2

export function rundePositionStueck(n: number): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** POSITION_STUECK_DEZIMALEN
  return Math.round(n * f) / f
}

export function formatStueck(n: number): string {
  return n.toLocaleString('de-DE', {
    minimumFractionDigits: POSITION_STUECK_DEZIMALEN,
    maximumFractionDigits: POSITION_STUECK_DEZIMALEN,
  })
}

export function formatEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function formatProzent(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const vorzeichen = n > 0 ? '+' : ''
  return `${vorzeichen}${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
}

export function formatDatumDe(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

export function sortierePositionenNachWert(positionen: PortfolioPositionSnapshot[]): PortfolioPositionSnapshot[] {
  return [...positionen].sort((a, b) => b.wertEur - a.wertEur)
}

export function sortiereBuchungenNeuesteZuerst<T extends PortfolioBuchung>(buchungen: T[]): T[] {
  return [...buchungen].sort((a, b) => b.datum.localeCompare(a.datum))
}

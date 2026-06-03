import type { DonutSegment } from '@/components/finanzen/donut-chart'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import type {
  AssetKlasse,
  BuchungsTyp,
  PortfolioBuchung,
  PortfolioDbSnapshot,
  PortfolioPositionSnapshot,
} from '@/lib/portfolio-analyse/types'
import { ASSET_KLASSE_FARBE, ASSET_KLASSE_LABEL, BUCHUNGS_TYP_LABEL } from '@/lib/portfolio-analyse/types'

const PALETTE_TOP = [
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
]

export type AngereichertePosition = PortfolioPositionSnapshot & {
  anzeigeName: string
  symbolYahoo: string | null
  gewichtProzent: number
  investiertEur: number
  gewinnVerlustEur: number | null
  gewinnVerlustProzent: number | null
}

export type MonatsWert = { monat: string; label: string; wert: number }
export type MonatsCashflow = { monat: string; label: string; eingang: number; ausgang: number }
export type VermoegensPunkt = {
  datum: string
  label: string
  cash: number
  wertpapiereKosten: number
  ertraegeKumuliert: number
  geschaetztGesamt: number
}
export type TopHalten = { key: string; label: string; wert: number; farbe: string; symbolYahoo: string | null }

function monatsKey(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : ''
}

export function monatsLabel(key: string): string {
  const [y, mo] = key.split('-')
  const d = new Date(Number(y), Number(mo) - 1, 1)
  return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

function letzteMonateKeys(anzahl: number, bisIso?: string): string[] {
  const ref = bisIso ? new Date(bisIso) : new Date()
  if (!Number.isFinite(ref.getTime())) return []
  ref.setDate(1)
  const out: string[] = []
  for (let i = anzahl - 1; i >= 0; i--) {
    const x = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function sammleIsins(
  buchungen: PortfolioBuchung[],
  snapshot: PortfolioDbSnapshot | null,
): string[] {
  const set = new Set<string>()
  for (const b of buchungen) {
    if (b.isin) set.add(b.isin.toUpperCase())
  }
  for (const p of snapshot?.positionen ?? []) {
    if (p.isin) set.add(p.isin.toUpperCase())
  }
  return [...set]
}

/** Einstand je ISIN aus Buchungen (Durchschnittskosten). */
export function einstandJeIsin(buchungen: PortfolioBuchung[]): Map<string, { stueck: number; kosten: number }> {
  const map = new Map<string, { stueck: number; kosten: number }>()
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))

  for (const b of sortiert) {
    if (!b.isin) continue
    const isin = b.isin.toUpperCase()
    const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }

    if (b.typ === 'kauf') {
      const stk = b.stueck != null ? Math.abs(b.stueck) : 0
      cur.stueck += stk > 0 ? stk : 0
      cur.kosten += b.betragEur
    } else if (b.typ === 'verkauf') {
      const stk = b.stueck != null ? Math.abs(b.stueck) : 0
      if (cur.stueck > 0 && stk > 0) {
        const anteil = Math.min(1, stk / cur.stueck)
        cur.kosten = Math.round(cur.kosten * (1 - anteil) * 100) / 100
        cur.stueck = Math.max(0, cur.stueck - stk)
      } else {
        cur.kosten = Math.max(0, cur.kosten - b.betragEur)
      }
    }
    map.set(isin, cur)
  }
  return map
}

export function positionenAngereichern(
  positionen: PortfolioPositionSnapshot[],
  buchungen: PortfolioBuchung[],
  meta: Map<string, IsinMetadata>,
  depotwertEur: number,
): AngereichertePosition[] {
  const einstand = einstandJeIsin(buchungen)
  const summeWert = positionen.reduce((s, p) => s + p.wertEur, 0) || depotwertEur || 1

  return [...positionen]
    .sort((a, b) => b.wertEur - a.wertEur)
    .map((p) => {
      const isin = p.isin?.toUpperCase() ?? null
      const m = isin ? meta.get(isin) : undefined
      const anzeigeName = anzeigeNameFuerIsin(isin, p.name, meta)
      const investiert = isin ? (einstand.get(isin)?.kosten ?? 0) : 0
      const gv = investiert > 0 ? Math.round((p.wertEur - investiert) * 100) / 100 : null
      const gvPct = gv != null && investiert > 0 ? Math.round((gv / investiert) * 10000) / 100 : null
      return {
        ...p,
        name: anzeigeName,
        anzeigeName,
        symbolYahoo: m?.symbolYahoo ?? null,
        gewichtProzent: Math.round((p.wertEur / summeWert) * 10000) / 100,
        investiertEur: Math.round(investiert * 100) / 100,
        gewinnVerlustEur: gv,
        gewinnVerlustProzent: gvPct,
      }
    })
}

export function positionenDonutTop10(positionen: AngereichertePosition[]): DonutSegment[] {
  const top = positionen.filter((p) => p.wertEur > 0).slice(0, 10)
  const rest = positionen.slice(10).reduce((s, p) => s + p.wertEur, 0)
  const seg: DonutSegment[] = top.map((p, i) => ({
    key: p.isin ?? p.anzeigeName,
    label: p.anzeigeName.length > 22 ? `${p.anzeigeName.slice(0, 20)}…` : p.anzeigeName,
    farbe: PALETTE_TOP[i % PALETTE_TOP.length],
    betrag: Math.round(p.wertEur * 100) / 100,
  }))
  if (rest > 0.01) {
    seg.push({ key: 'rest', label: 'Weitere', farbe: '#64748b', betrag: Math.round(rest * 100) / 100 })
  }
  return seg
}

export function buchungsTypDonut(buchungen: PortfolioBuchung[]): DonutSegment[] {
  const summen = new Map<BuchungsTyp, number>()
  for (const b of buchungen) {
    summen.set(b.typ, (summen.get(b.typ) ?? 0) + b.betragEur)
  }
  const farben: Record<BuchungsTyp, string> = {
    kauf: '#f43f5e',
    verkauf: '#22c55e',
    dividende: '#34d399',
    zins: '#38bdf8',
    einzahlung: '#6366f1',
    auszahlung: '#fb923c',
    steuer: '#94a3b8',
    gebuehr: '#78716c',
    sonstiges: '#64748b',
  }
  return [...summen.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([typ, betrag]) => ({
      key: typ,
      label: BUCHUNGS_TYP_LABEL[typ],
      farbe: farben[typ],
      betrag: Math.round(betrag * 100) / 100,
    }))
}

/** Kumulierte Dividenden/Zinsen je ISIN (für Wertpapiere-Tabelle). */
export function dividendenJeIsin(buchungen: PortfolioBuchung[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of buchungen) {
    if (b.typ !== 'dividende' && b.typ !== 'zins') continue
    if (!b.isin) continue
    const key = b.isin.toUpperCase()
    map.set(key, Math.round(((map.get(key) ?? 0) + b.betragEur) * 100) / 100)
  }
  return map
}

export function dividendenProMonat(buchungen: PortfolioBuchung[], monate = 18): MonatsWert[] {
  const keys = letzteMonateKeys(monate)
  const summen = new Map<string, number>()
  for (const b of buchungen) {
    if (b.typ !== 'dividende' && b.typ !== 'zins') continue
    const k = monatsKey(b.datum)
    if (!k) continue
    summen.set(k, (summen.get(k) ?? 0) + b.betragEur)
  }
  return keys.map((monat) => ({
    monat,
    label: monatsLabel(monat),
    wert: Math.round((summen.get(monat) ?? 0) * 100) / 100,
  }))
}

export function cashflowProMonat(buchungen: PortfolioBuchung[], monate = 12): MonatsCashflow[] {
  const keys = letzteMonateKeys(monate)
  const ein = new Map<string, number>()
  const aus = new Map<string, number>()

  for (const b of buchungen) {
    const k = monatsKey(b.datum)
    if (!k) continue
    const eingangTypen: BuchungsTyp[] = ['einzahlung', 'verkauf', 'dividende', 'zins']
    const ausgangTypen: BuchungsTyp[] = ['auszahlung', 'kauf', 'steuer', 'gebuehr']
    if (eingangTypen.includes(b.typ)) {
      ein.set(k, (ein.get(k) ?? 0) + b.betragEur)
    } else if (ausgangTypen.includes(b.typ)) {
      aus.set(k, (aus.get(k) ?? 0) + b.betragEur)
    }
  }

  return keys.map((monat) => ({
    monat,
    label: monatsLabel(monat),
    eingang: Math.round((ein.get(monat) ?? 0) * 100) / 100,
    ausgang: Math.round((aus.get(monat) ?? 0) * 100) / 100,
  }))
}

export function kaeufeVerkaeufeProMonat(buchungen: PortfolioBuchung[], monate = 12): {
  monat: string
  label: string
  kaeufe: number
  verkaeufe: number
}[] {
  const keys = letzteMonateKeys(monate)
  const kauf = new Map<string, number>()
  const verkauf = new Map<string, number>()
  for (const b of buchungen) {
    const k = monatsKey(b.datum)
    if (!k) continue
    if (b.typ === 'kauf') kauf.set(k, (kauf.get(k) ?? 0) + b.betragEur)
    if (b.typ === 'verkauf') verkauf.set(k, (verkauf.get(k) ?? 0) + b.betragEur)
  }
  return keys.map((monat) => ({
    monat,
    label: monatsLabel(monat),
    kaeufe: Math.round((kauf.get(monat) ?? 0) * 100) / 100,
    verkaeufe: Math.round((verkauf.get(monat) ?? 0) * 100) / 100,
  }))
}

/** Vermögensverlauf (Kostenbasis + Cash; letzter Punkt mit Marktwert aus Snapshot). */
export function vermoegensverlauf(
  buchungen: PortfolioBuchung[],
  snapshot: PortfolioDbSnapshot | null,
  maxPunkte = 48,
): VermoegensPunkt[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  if (sortiert.length === 0) return []

  const byDate = new Map<string, PortfolioBuchung[]>()
  for (const b of sortiert) {
    const list = byDate.get(b.datum) ?? []
    list.push(b)
    byDate.set(b.datum, list)
  }

  const dates = [...byDate.keys()].sort()
  let cash = 0
  let wertpapiereKosten = 0
  let ertraege = 0
  const punkte: VermoegensPunkt[] = []

  for (const datum of dates) {
    for (const b of byDate.get(datum) ?? []) {
      switch (b.typ) {
        case 'einzahlung':
          cash += b.betragEur
          break
        case 'auszahlung':
          cash -= b.betragEur
          break
        case 'kauf':
          cash -= b.betragEur
          wertpapiereKosten += b.betragEur
          break
        case 'verkauf':
          cash += b.betragEur
          wertpapiereKosten = Math.max(0, wertpapiereKosten - b.betragEur)
          break
        case 'dividende':
        case 'zins':
          cash += b.betragEur
          ertraege += b.betragEur
          break
        case 'steuer':
        case 'gebuehr':
          cash -= b.betragEur
          break
        default:
          break
      }
    }
    punkte.push({
      datum,
      label: monatsLabel(monatsKey(datum)),
      cash: Math.round(cash * 100) / 100,
      wertpapiereKosten: Math.round(wertpapiereKosten * 100) / 100,
      ertraegeKumuliert: Math.round(ertraege * 100) / 100,
      geschaetztGesamt: Math.round((cash + wertpapiereKosten) * 100) / 100,
    })
  }

  const depotMarkt =
    snapshot?.depotwert_eur ?? (snapshot?.positionen?.reduce((s, p) => s + p.wertEur, 0) || null)

  if (depotMarkt != null && depotMarkt > 0 && punkte.length > 0) {
    const last = punkte[punkte.length - 1]
    last.geschaetztGesamt = Math.round(depotMarkt * 100) / 100
  }

  if (punkte.length <= maxPunkte) return punkte
  const step = Math.ceil(punkte.length / maxPunkte)
  const reduced: VermoegensPunkt[] = []
  for (let i = 0; i < punkte.length; i += step) reduced.push(punkte[i])
  if (reduced[reduced.length - 1]?.datum !== punkte[punkte.length - 1]?.datum) {
    reduced.push(punkte[punkte.length - 1])
  }
  return reduced
}

export function einzahlungenKumuliert(buchungen: PortfolioBuchung[]): MonatsWert[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const byMonat = new Map<string, number>()
  let sum = 0
  for (const b of sortiert) {
    if (b.typ === 'einzahlung') sum += b.betragEur
    if (b.typ === 'auszahlung') sum -= b.betragEur
    const k = monatsKey(b.datum)
    if (k) byMonat.set(k, Math.round(sum * 100) / 100)
  }
  const keys = [...new Set([...letzteMonateKeys(18), ...byMonat.keys()])].sort()
  let last = 0
  return keys.map((monat) => {
    if (byMonat.has(monat)) last = byMonat.get(monat)!
    return { monat, label: monatsLabel(monat), wert: last }
  })
}

export function dividendenKalender(buchungen: PortfolioBuchung[]): Array<{
  datum: string
  name: string
  isin: string | null
  betrag: number
}> {
  return buchungen
    .filter((b) => b.typ === 'dividende')
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, 24)
    .map((b) => ({
      datum: b.datum,
      name: b.wertpapierName ?? b.isin ?? 'Dividende',
      isin: b.isin,
      betrag: b.betragEur,
    }))
}

export function personalDividendenRendite(
  dividendenGesamt: number,
  depotwert: number,
  jahre: number,
): number | null {
  if (depotwert <= 0 || jahre <= 0) return null
  const jaehrlich = dividendenGesamt / jahre
  return Math.round((jaehrlich / depotwert) * 10000) / 100
}

export function assetKlassenDonut(positionen: PortfolioPositionSnapshot[]): DonutSegment[] {
  const summen = new Map<AssetKlasse, number>()
  for (const p of positionen) {
    summen.set(p.assetKlasse, (summen.get(p.assetKlasse) ?? 0) + p.wertEur)
  }
  return [...summen.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([klasse, betrag]) => ({
      key: klasse,
      label: ASSET_KLASSE_LABEL[klasse],
      farbe: ASSET_KLASSE_FARBE[klasse],
      betrag: Math.round(betrag * 100) / 100,
    }))
}

export function konzentrationTop5(positionen: AngereichertePosition[]): TopHalten[] {
  return positionen.slice(0, 5).map((p, i) => ({
    key: p.isin ?? String(i),
    label: p.anzeigeName,
    wert: p.gewichtProzent,
    farbe: PALETTE_TOP[i % PALETTE_TOP.length],
    symbolYahoo: p.symbolYahoo,
  }))
}

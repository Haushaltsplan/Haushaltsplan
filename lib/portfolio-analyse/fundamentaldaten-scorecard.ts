import { cagrProzent } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { berechneHistorischeBewertung } from '@/lib/portfolio-analyse/fundamentaldaten-historische-bewertung'
import {
  historischeWerteAusZeile,
  letzterVerfuegbarerWert,
} from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { FundamentaldatenPaket, MantraAmpel } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type ScorecardBalkenId =
  | 'gewinnstabilitaet'
  | 'gewinnwachstum'
  | 'tilgungsjahre'
  | 'momentum'
  | 'discount'
  | 'dividendenrendite'
  | 'dividendenstabilitaet'
  | 'dividendenwachstum'

export type ScorecardStrategieId = 'dividendenertrag' | 'dividendenwachstum' | 'gewinnwachstum'

export type ScorecardBalken = {
  id: ScorecardBalkenId
  label: string
  wertText: string
  /** 0 = schwach, 1 = stark. `null` = keine Daten. */
  position: number | null
}

export type ScorecardStrategie = {
  id: ScorecardStrategieId
  titel: string
  score: number | null
  balken: ScorecardBalken[]
}

export type ScorecardFirma = {
  ticker: string
  name: string
  branche: string | null
  sektor: string | null
  isin: string | null
  website: string | null
  boersenwertText: string | null
  kursText: string | null
  mantraAmpel: MantraAmpel | null
  mantraScorePct: number | null
}

export type ScorecardModell = {
  firma: ScorecardFirma
  strategien: ScorecardStrategie[]
}

const BALKEN_REIHENFOLGE: ScorecardBalkenId[] = [
  'gewinnstabilitaet',
  'gewinnwachstum',
  'tilgungsjahre',
  'momentum',
  'discount',
  'dividendenrendite',
  'dividendenstabilitaet',
  'dividendenwachstum',
]

/** Gewicht je Strategie — gleiche Balken, andere Betonung. Summe je Strategie = 1. */
const GEWICHTE: Record<ScorecardStrategieId, Record<ScorecardBalkenId, number>> = {
  dividendenertrag: {
    gewinnstabilitaet: 0.12,
    gewinnwachstum: 0.08,
    tilgungsjahre: 0.15,
    momentum: 0.05,
    discount: 0.1,
    dividendenrendite: 0.25,
    dividendenstabilitaet: 0.15,
    dividendenwachstum: 0.1,
  },
  dividendenwachstum: {
    gewinnstabilitaet: 0.12,
    gewinnwachstum: 0.18,
    tilgungsjahre: 0.08,
    momentum: 0.08,
    discount: 0.1,
    dividendenrendite: 0.08,
    dividendenstabilitaet: 0.14,
    dividendenwachstum: 0.22,
  },
  gewinnwachstum: {
    gewinnstabilitaet: 0.2,
    gewinnwachstum: 0.28,
    tilgungsjahre: 0.1,
    momentum: 0.14,
    discount: 0.14,
    dividendenrendite: 0.04,
    dividendenstabilitaet: 0.04,
    dividendenwachstum: 0.06,
  },
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function linear(wert: number, min: number, max: number): number {
  if (max === min) return 0.5
  return clamp01((wert - min) / (max - min))
}

function kmText(paket: FundamentaldatenPaket, id: string): string | null {
  const w = paket.keyMetrics.find((m) => m.id === id)?.wert?.trim()
  return w && w !== '–' && w !== '-' ? w : null
}

function parseMetricZahl(wert: string): number | null {
  const negativ = /^\(.*\)$/.test(wert.trim())
  const s = wert
    .replace(/[x×%$€()]/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const v = parseFloat(s)
  if (!Number.isFinite(v)) return null
  return negativ ? -Math.abs(v) : v
}

function kmZahl(paket: FundamentaldatenPaket, id: string): number | null {
  const km = paket.keyMetrics.find((m) => m.id === id)
  if (!km) return null
  if (km.zahl != null && Number.isFinite(km.zahl)) return km.zahl
  return km.wert ? parseMetricZahl(km.wert) : null
}

function zeile(paket: FundamentaldatenPaket, id: string) {
  return paket.zeilen.find((z) => z.id === id)
}

function cagrAusZeile(
  paket: FundamentaldatenPaket,
  id: string,
  maxJahre = 10,
): { pct: number; jahre: number } | null {
  const hist = historischeWerteAusZeile(zeile(paket, id), paket.perioden)
  const slice = hist.slice(-(maxJahre + 1))
  if (slice.length < 3) return null
  const jahre = slice.length - 1
  const pct = cagrProzent(slice, jahre)
  return pct != null ? { pct, jahre } : null
}

/** Anteil positiver Jahre + Jahre ohne Rückgang. */
function gewinnStabilitaetPct(werte: number[]): number | null {
  if (werte.length < 3) return null
  const positiv = werte.filter((v) => v > 0).length / werte.length
  let ohneRueckgang = 0
  for (let i = 1; i < werte.length; i++) {
    if (werte[i]! >= werte[i - 1]!) ohneRueckgang++
  }
  return (positiv * 0.4 + (ohneRueckgang / (werte.length - 1)) * 0.6) * 100
}

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '–'
  const vz = v > 0 ? '+' : ''
  return `${vz}${v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`
}

function score1bis10(balken: ScorecardBalken[], gewichte: Record<ScorecardBalkenId, number>): number | null {
  let acc = 0
  let wSum = 0
  let n = 0
  for (const b of balken) {
    if (b.position == null) continue
    const w = gewichte[b.id]
    acc += b.position * w
    wSum += w
    n++
  }
  if (n < 3 || wSum < 0.25) return null
  return Math.max(1, Math.min(10, Math.round(1 + (acc / wSum) * 9)))
}

function baueBalken(paket: FundamentaldatenPaket): ScorecardBalken[] {
  const epsHist = historischeWerteAusZeile(zeile(paket, 'eps'), paket.perioden)
  const niHist = historischeWerteAusZeile(zeile(paket, 'nettogewinn'), paket.perioden)
  const gewinnHist = (epsHist.length >= niHist.length ? epsHist : niHist).slice(-11)
  const stabPct = gewinnStabilitaetPct(gewinnHist)

  const epsCagr = cagrAusZeile(paket, 'eps', 10)
  const niCagr = cagrAusZeile(paket, 'nettogewinn', 10)
  const wachstum = epsCagr ?? niCagr

  const nd = letzterVerfuegbarerWert(zeile(paket, 'nettoverschuldung'), paket.perioden)
  const fcf = letzterVerfuegbarerWert(zeile(paket, 'fcf'), paket.perioden)
  let tilgungText = '–'
  let tilgungPos: number | null = null
  if (nd != null && nd <= 0) {
    tilgungText = 'Netto-Cash'
    tilgungPos = 1
  } else if (nd != null && fcf != null && fcf > 0) {
    const jahre = nd / fcf
    tilgungText = `${jahre.toLocaleString('de-DE', { maximumFractionDigits: 1 })} J.`
    tilgungPos = clamp01(1 - jahre / 15)
  } else if (nd != null && (fcf == null || fcf <= 0)) {
    tilgungText = 'kein FCF'
    tilgungPos = 0
  }

  const rsi = paket.erweitert?.finviz?.rsi14 ?? null
  const kurs = kmZahl(paket, 'kurs_aktuell')
  const hoch = kmZahl(paket, '52w_hoch')
  const tief = kmZahl(paket, '52w_tief')
  let momentumPos: number | null = null
  let momentumText = '–'
  if (rsi != null && rsi > 0) {
    momentumPos = linear(rsi, 30, 70)
    momentumText = `RSI ${rsi.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
  } else if (kurs != null && hoch != null && tief != null && hoch > tief) {
    const pos52 = (kurs - tief) / (hoch - tief)
    momentumPos = clamp01(pos52)
    momentumText = `${(pos52 * 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })} % d. 52W-Spanne`
  }

  const histBew = berechneHistorischeBewertung(paket)
  const peP = histBew.pePerzentil10y ?? histBew.pePerzentil5y
  const discountPos = peP != null ? clamp01(1 - peP / 100) : null
  const peAktuell = kmText(paket, 'ltm_pe')
  const discountText =
    peP != null
      ? `KGV-Perz. ${peP.toLocaleString('de-DE', { maximumFractionDigits: 0 })}${peAktuell ? ` · ${peAktuell}` : ''}`
      : '–'

  const divYield = paket.keyMetrics.find((m) => m.id === 'div_yield')
  const divYieldZahl = divYield ? parseMetricZahl(divYield.wert) : null
  const div = paket.erweitert?.dividenden ?? null
  const divStabJahre = div?.jahreOhneSenkung ?? null
  const divCagr = div?.cagr10yPct ?? div?.cagr5yPct ?? null
  const divCagrJahre = div?.cagr10yPct != null ? 10 : div?.cagr5yPct != null ? 5 : null

  const wachstumJahre = wachstum?.jahre ?? null

  const werte: Record<ScorecardBalkenId, Omit<ScorecardBalken, 'id'>> = {
    gewinnstabilitaet: {
      label: 'Gewinnstabilität',
      wertText: stabPct != null ? `${stabPct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} %` : '–',
      position: stabPct != null ? clamp01(stabPct / 100) : null,
    },
    gewinnwachstum: {
      label: wachstumJahre != null && wachstumJahre < 8 ? `Gewinnwachstum ${wachstumJahre}J` : 'Gewinnwachstum 10J',
      wertText: fmtPct(wachstum?.pct ?? null),
      position: wachstum != null ? linear(wachstum.pct, -5, 22) : null,
    },
    tilgungsjahre: {
      label: 'Tilgungsjahre',
      wertText: tilgungText,
      position: tilgungPos,
    },
    momentum: {
      label: 'Momentum',
      wertText: momentumText,
      position: momentumPos,
    },
    discount: {
      label: 'Discount',
      wertText: discountText,
      position: discountPos,
    },
    dividendenrendite: {
      label: 'Dividendenrendite',
      wertText: divYield?.wert && divYield.wert !== '–' ? divYield.wert : '–',
      position: divYieldZahl != null ? linear(divYieldZahl, 0, 5) : null,
    },
    dividendenstabilitaet: {
      label: 'Dividendenstabilität',
      wertText: divStabJahre != null ? `${divStabJahre} J. ohne Senkung` : '–',
      position: divStabJahre != null ? linear(divStabJahre, 0, 25) : null,
    },
    dividendenwachstum: {
      label: divCagrJahre === 5 ? 'Dividendenwachstum 5J' : 'Dividendenwachstum 10J',
      wertText: fmtPct(divCagr),
      position: divCagr != null ? linear(divCagr, -5, 15) : null,
    },
  }

  return BALKEN_REIHENFOLGE.map((id) => ({ id, ...werte[id] }))
}

const STRATEGIE_TITEL: Record<ScorecardStrategieId, string> = {
  dividendenertrag: 'Dividendenertrag',
  dividendenwachstum: 'Dividendenwachstum',
  gewinnwachstum: 'Gewinnwachstum',
}

export function baueScorecard(paket: FundamentaldatenPaket, isin?: string | null): ScorecardModell {
  const balken = baueBalken(paket)
  const strategien: ScorecardStrategie[] = (
    ['dividendenertrag', 'dividendenwachstum', 'gewinnwachstum'] as const
  ).map((id) => ({
    id,
    titel: STRATEGIE_TITEL[id],
    score: score1bis10(balken, GEWICHTE[id]),
    balken,
  }))

  return {
    firma: {
      ticker: paket.ticker,
      name: paket.firmenname,
      branche: paket.branche,
      sektor: paket.sektor,
      isin: isin?.trim() ? isin.trim().toUpperCase() : null,
      website: paket.website,
      boersenwertText: kmText(paket, 'market_cap'),
      kursText: kmText(paket, 'kurs_aktuell'),
      mantraAmpel: paket.mantra?.ampel ?? null,
      mantraScorePct: paket.mantra?.ampelScorePct ?? null,
    },
    strategien,
  }
}

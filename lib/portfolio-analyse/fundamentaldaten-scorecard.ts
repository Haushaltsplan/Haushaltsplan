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
  | 'ausschuettung'
  | 'roic'

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
  /** z. B. „Keine Dividende“ — Score bewusst 0, keine fehlenden Daten. */
  hinweis: string | null
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

/** Spalten-Punkte: nur die Kennzahlen der jeweiligen Strategie, wichtigste zuerst. */
const ANZEIGE_BALKEN: Record<ScorecardStrategieId, ScorecardBalkenId[]> = {
  dividendenertrag: [
    'dividendenrendite',
    'ausschuettung',
    'dividendenstabilitaet',
    'tilgungsjahre',
    'dividendenwachstum',
  ],
  dividendenwachstum: [
    'dividendenwachstum',
    'gewinnwachstum',
    'dividendenstabilitaet',
    'gewinnstabilitaet',
    'discount',
  ],
  gewinnwachstum: ['gewinnwachstum', 'gewinnstabilitaet', 'roic', 'momentum', 'discount'],
}

/** Gewicht nur der angezeigten Balken — Summe je Strategie = 1. */
const GEWICHTE: Record<ScorecardStrategieId, Partial<Record<ScorecardBalkenId, number>>> = {
  dividendenertrag: {
    dividendenrendite: 0.28,
    ausschuettung: 0.2,
    dividendenstabilitaet: 0.2,
    tilgungsjahre: 0.16,
    dividendenwachstum: 0.16,
  },
  dividendenwachstum: {
    dividendenwachstum: 0.28,
    gewinnwachstum: 0.24,
    dividendenstabilitaet: 0.18,
    gewinnstabilitaet: 0.16,
    discount: 0.14,
  },
  gewinnwachstum: {
    gewinnwachstum: 0.3,
    gewinnstabilitaet: 0.22,
    roic: 0.18,
    momentum: 0.16,
    discount: 0.14,
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

/** Unter dieser Rendite gilt die Aktie als Nichtzahler (Rauschen / 0,0 %). */
const DIVIDENDEN_MIN_YIELD_PCT = 0.05

function letzterDividendenCashflowMio(paket: FundamentaldatenPaket): number | null {
  const v = letzterVerfuegbarerWert(zeile(paket, 'dividenden_gezahlt'), paket.perioden)
  return v != null && Number.isFinite(v) ? Math.abs(v) : null
}

function exDateIstAktuell(iso: string | null | undefined, maxTage = 420): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return false
  return Date.now() - t <= maxTage * 86_400_000
}

/**
 * Zahlt das Unternehmen aktuell eine Dividende?
 * Explizite 0-%-Rendite schlägt alte Cashflow-Reste; fehlende Rendite + Historie zählt als Zahler.
 */
function zahltDividende(
  paket: FundamentaldatenPaket,
  divYieldZahl: number | null,
  payoutZahl: number | null,
): boolean {
  if (divYieldZahl != null && divYieldZahl > DIVIDENDEN_MIN_YIELD_PCT) return true
  if (divYieldZahl != null && divYieldZahl <= DIVIDENDEN_MIN_YIELD_PCT) return false

  const div = paket.erweitert?.dividenden
  if (div && (div.letzteDividendeUsd ?? 0) > 0 && exDateIstAktuell(div.letzteExDate)) return true
  if (div && (div.anzahlZahlungen ?? 0) > 0 && (div.cagr5yPct != null || div.cagr10yPct != null)) {
    return true
  }

  const cf = letzterDividendenCashflowMio(paket)
  if (cf != null && cf > 0.05) return true
  if (payoutZahl != null && payoutZahl > 1) return true

  return false
}

function keineDividendePaket(paket: FundamentaldatenPaket): boolean {
  const y = kmZahl(paket, 'div_yield')
  const p = kmZahl(paket, 'payout')
  return !zahltDividende(paket, y, p)
}

function score1bis10(
  balken: ScorecardBalken[],
  gewichte: Partial<Record<ScorecardBalkenId, number>>,
): number | null {
  let acc = 0
  let wSum = 0
  let n = 0
  for (const b of balken) {
    if (b.position == null) continue
    const w = gewichte[b.id] ?? 0
    if (w <= 0) continue
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
  const divYieldZahl = divYield ? (kmZahl(paket, 'div_yield') ?? parseMetricZahl(divYield.wert)) : null
  const div = paket.erweitert?.dividenden ?? null
  const payoutZahl = kmZahl(paket, 'payout')
  const payoutText = kmText(paket, 'payout')
  const keineDividende = keineDividendePaket(paket)

  const divStabJahre = keineDividende ? 0 : (div?.jahreOhneSenkung ?? null)
  const divCagr = keineDividende ? 0 : (div?.cagr10yPct ?? div?.cagr5yPct ?? null)
  const divCagrJahre = keineDividende ? null : div?.cagr10yPct != null ? 10 : div?.cagr5yPct != null ? 5 : null

  const roicZahl = kmZahl(paket, 'ltm_roic') ?? kmZahl(paket, 'roic')
  const roicText = kmText(paket, 'ltm_roic') ?? kmText(paket, 'roic')

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
      wertText: keineDividende
        ? 'keine Dividende'
        : divYield?.wert && divYield.wert !== '–'
          ? divYield.wert
          : '–',
      position: keineDividende ? 0 : divYieldZahl != null ? linear(divYieldZahl, 0, 5) : null,
    },
    dividendenstabilitaet: {
      label: 'Dividendenstabilität',
      wertText: keineDividende
        ? 'keine Dividende'
        : divStabJahre != null
          ? `${divStabJahre} J. ohne Senkung`
          : '–',
      position: keineDividende ? 0 : divStabJahre != null ? linear(divStabJahre, 0, 25) : null,
    },
    dividendenwachstum: {
      label: divCagrJahre === 5 ? 'Dividendenwachstum 5J' : 'Dividendenwachstum 10J',
      wertText: keineDividende ? 'keine Dividende' : fmtPct(divCagr),
      position: keineDividende ? 0 : divCagr != null ? linear(divCagr, -5, 15) : null,
    },
    ausschuettung: {
      label: 'Ausschüttungsquote',
      wertText: keineDividende ? 'keine Dividende' : (payoutText ?? '–'),
      // 0 % ohne Dividende ist kein Plus; sonst niedrige Quote = nachhaltiger.
      position: keineDividende ? 0 : payoutZahl != null ? linear(payoutZahl, 75, 15) : null,
    },
    roic: {
      label: 'ROIC',
      wertText: roicText ?? '–',
      position: roicZahl != null ? linear(roicZahl, 8, 30) : null,
    },
  }

  return (Object.keys(werte) as ScorecardBalkenId[]).map((id) => ({ id, ...werte[id] }))
}

const STRATEGIE_TITEL: Record<ScorecardStrategieId, string> = {
  dividendenertrag: 'Dividendenertrag',
  dividendenwachstum: 'Dividendenwachstum',
  gewinnwachstum: 'Gewinnwachstum',
}

export function baueScorecard(paket: FundamentaldatenPaket, isin?: string | null): ScorecardModell {
  const alle = baueBalken(paket)
  const byId = new Map(alle.map((b) => [b.id, b]))
  const keineDiv = keineDividendePaket(paket)
  const strategien: ScorecardStrategie[] = (
    ['dividendenertrag', 'dividendenwachstum', 'gewinnwachstum'] as const
  ).map((id) => {
    const balken = ANZEIGE_BALKEN[id].flatMap((bid) => {
      const b = byId.get(bid)
      return b ? [b] : []
    })
    const dividendenspalte = id === 'dividendenertrag' || id === 'dividendenwachstum'
    return {
      id,
      titel: STRATEGIE_TITEL[id],
      score: keineDiv && dividendenspalte ? 0 : score1bis10(balken, GEWICHTE[id]),
      balken,
      hinweis: keineDiv && dividendenspalte ? 'Keine Dividende' : null,
    }
  })

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

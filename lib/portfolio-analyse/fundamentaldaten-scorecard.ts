import { berechneHistorischeBewertung } from '@/lib/portfolio-analyse/fundamentaldaten-historische-bewertung'
import {
  historischeWerteAusZeile,
  letzterVerfuegbarerWert,
} from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import {
  adaptiverCagr,
  dividendenStabilitaetPosition,
  historieBadge,
  historieFussnote,
  horizontStufe,
  letzterWert,
  score1bis10Renorm,
  wachstumLabel,
  zaehleGeschaeftsjahre,
  type HorizontStufe,
} from '@/lib/portfolio-analyse/fundamentaldaten-scorecard-horizont'
import type { FundamentaldatenPaket, MantraAmpel } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type ScorecardBalkenId =
  | 'gewinnstabilitaet'
  | 'gewinnwachstum'
  | 'umsatzwachstum'
  | 'tilgungsjahre'
  | 'discount'
  | 'dividendenrendite'
  | 'dividendenstabilitaet'
  | 'dividendenwachstum'
  | 'ausschuettung'
  | 'fcfDeckung'
  | 'zinsdeckung'
  | 'fcfConversion'
  | 'verwaesserung'
  | 'fwdWachstum'
  | 'nrr'
  | 'roic'

export type ScorecardStrategieId = 'dividendenertrag' | 'dividendenwachstum' | 'gewinnwachstum'

export type ScorecardBalken = {
  id: ScorecardBalkenId
  label: string
  wertText: string
  /** 0 = schwach, 1 = stark. `null` = keine Daten. */
  position: number | null
  /** Nur wenn `position` null: warum der Balken leer ist. */
  leergrund?: string | null
  /** Fehlt der Wert, Balken ausblenden (kein leerer NRR-Strich bei Industrie). */
  optional?: boolean
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

export type ScorecardHistorie = {
  geschaeftsjahre: number
  stufe: HorizontStufe
  badge: string
  fussnote: string
}

export type ScorecardModell = {
  firma: ScorecardFirma
  strategien: ScorecardStrategie[]
  historie: ScorecardHistorie
}

type WachstumsQuelle = 'eps' | 'nettogewinn' | 'ebit' | 'umsatz' | 'eps-km'

/** Spalten-Punkte: nur die Kennzahlen der jeweiligen Strategie, wichtigste zuerst. */
const ANZEIGE_BALKEN: Record<ScorecardStrategieId, ScorecardBalkenId[]> = {
  dividendenertrag: [
    'dividendenrendite',
    'fcfDeckung',
    'ausschuettung',
    'dividendenstabilitaet',
    'tilgungsjahre',
    'zinsdeckung',
    'dividendenwachstum',
  ],
  dividendenwachstum: [
    'dividendenwachstum',
    'gewinnwachstum',
    'fcfConversion',
    'dividendenstabilitaet',
    'verwaesserung',
    'gewinnstabilitaet',
    'discount',
  ],
  gewinnwachstum: [
    'gewinnwachstum',
    'umsatzwachstum',
    'gewinnstabilitaet',
    'roic',
    'fcfConversion',
    'verwaesserung',
    'fwdWachstum',
    'discount',
    'nrr',
  ],
}

/** Gewicht nur der angezeigten Balken — Summe je Strategie ≈ 1. */
const GEWICHTE: Record<ScorecardStrategieId, Partial<Record<ScorecardBalkenId, number>>> = {
  dividendenertrag: {
    dividendenrendite: 0.22,
    fcfDeckung: 0.18,
    ausschuettung: 0.14,
    dividendenstabilitaet: 0.16,
    tilgungsjahre: 0.1,
    zinsdeckung: 0.1,
    dividendenwachstum: 0.1,
  },
  dividendenwachstum: {
    dividendenwachstum: 0.22,
    gewinnwachstum: 0.16,
    fcfConversion: 0.14,
    dividendenstabilitaet: 0.14,
    verwaesserung: 0.1,
    gewinnstabilitaet: 0.12,
    discount: 0.12,
  },
  gewinnwachstum: {
    gewinnwachstum: 0.2,
    umsatzwachstum: 0.14,
    gewinnstabilitaet: 0.12,
    roic: 0.14,
    fcfConversion: 0.12,
    verwaesserung: 0.08,
    fwdWachstum: 0.1,
    discount: 0.08,
    nrr: 0.08,
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

/** Optimaler Bereich (z. B. Ausschüttung 25–55 %), außerhalb 0. */
function tent(wert: number, low: number, peak: number, high: number): number {
  if (wert <= low || wert >= high) return 0
  if (wert === peak) return 1
  if (wert < peak) return clamp01((wert - low) / (peak - low))
  return clamp01((high - wert) / (high - peak))
}

function fmtMult(v: number, digits = 1): string {
  return `${v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })}×`
}

function kmText(paket: FundamentaldatenPaket, id: string): string | null {
  const w = paket.keyMetrics.find((m) => m.id === id)?.wert?.trim()
  return w && w !== '–' && w !== '-' ? w : null
}

function parseMetricZahl(wert: string): number | null {
  const t = wert.trim().replace(/−/g, '-')
  const negativ = /^\(.*\)$/.test(t)
  const s = t
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

function wachstumBasisLabel(quelle: WachstumsQuelle): string {
  switch (quelle) {
    case 'umsatz':
      return 'Umsatzwachstum'
    case 'ebit':
      return 'EBIT-Wachstum'
    default:
      return 'Gewinnwachstum'
  }
}

function cagrMitQuelle(
  paket: FundamentaldatenPaket,
  id: string,
  quelle: WachstumsQuelle,
): { pct: number; jahre: number; methode: 'cagr' | 'yoy-mittel'; quelle: WachstumsQuelle } | null {
  const hist = historischeWerteAusZeile(zeile(paket, id), paket.perioden)
  const c = adaptiverCagr(hist)
  return c ? { ...c, quelle } : null
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
  if (
    div &&
    (div.anzahlZahlungen ?? 0) > 0 &&
    (div.cagr5yPct != null ||
      div.cagr10yPct != null ||
      div.cagrVerfuegbarPct != null ||
      div.durchschnittWachstum3yPct != null)
  ) {
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
  return score1bis10Renorm(
    balken.map((b) => ({
      position: b.position,
      gewicht: gewichte[b.id] ?? 0,
    })),
  )
}

function baueBalken(paket: FundamentaldatenPaket): ScorecardBalken[] {
  const epsHist = historischeWerteAusZeile(zeile(paket, 'eps'), paket.perioden)
  const niHist = historischeWerteAusZeile(zeile(paket, 'nettogewinn'), paket.perioden)
  const gewinnHistRoh = epsHist.length >= niHist.length ? epsHist : niHist
  const gewinnHist = gewinnHistRoh.slice(-11)
  const stabPct = gewinnStabilitaetPct(gewinnHist)
  const stabJahre = gewinnHist.length >= 3 ? gewinnHist.length : null

  const letzterGewinn = letzterWert(gewinnHist)
  const gewinnJahreVerfuegbar = gewinnHist.length
  const gewinnNegativ = letzterGewinn != null && letzterGewinn <= 0

  const wachstumGewinn =
    cagrMitQuelle(paket, 'eps', 'eps') ?? cagrMitQuelle(paket, 'nettogewinn', 'nettogewinn')
  const wachstum =
    wachstumGewinn ??
    (gewinnNegativ
      ? null
      : (cagrMitQuelle(paket, 'ebit', 'ebit') ?? cagrMitQuelle(paket, 'umsatz', 'umsatz')))
  const kmCagr3 = kmZahl(paket, 'eps_cagr_3y')
  const wachstumEff =
    wachstum ??
    (!gewinnNegativ && kmCagr3 != null && Number.isFinite(kmCagr3)
      ? { pct: kmCagr3, jahre: 3, methode: 'cagr' as const, quelle: 'eps-km' as const }
      : null)

  let gewinnWachstumLabel = 'Gewinnwachstum'
  let gewinnWachstumText = '–'
  let gewinnWachstumPos: number | null = null
  let gewinnWachstumLeer: string | null = null

  if (gewinnNegativ && !wachstumEff) {
    gewinnWachstumLabel = wachstumLabel('Gewinnwachstum', gewinnJahreVerfuegbar || null)
    gewinnWachstumText = 'letzter Gewinn negativ'
    gewinnWachstumPos = 0
  } else if (wachstumEff) {
    gewinnWachstumLabel = wachstumLabel(wachstumBasisLabel(wachstumEff.quelle), wachstumEff.jahre)
    gewinnWachstumText =
      wachstumEff.methode === 'yoy-mittel' ? `${fmtPct(wachstumEff.pct)} · Ø YoY` : fmtPct(wachstumEff.pct)
    gewinnWachstumPos = linear(wachstumEff.pct, -5, 22)
  } else if (gewinnJahreVerfuegbar > 0 && gewinnJahreVerfuegbar < 3) {
    gewinnWachstumLabel = wachstumLabel('Gewinnwachstum', gewinnJahreVerfuegbar)
    gewinnWachstumLeer = `Historie ${gewinnJahreVerfuegbar}J — CAGR erst ab 3J`
  } else {
    gewinnWachstumLeer = 'kein vergleichbares Gewinnfenster'
  }

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

  const histBew = berechneHistorischeBewertung(paket)
  const usePe10 = histBew.pePerzentil10y != null && histBew.peJahre10 >= 7
  const peP = usePe10 ? histBew.pePerzentil10y : histBew.pePerzentil5y
  const peJahre = usePe10 ? histBew.peJahre10 : histBew.peJahre5
  const discountPos = peP != null ? clamp01(1 - peP / 100) : null
  const peAktuell = kmText(paket, 'ltm_pe')
  const discountText =
    peP != null
      ? `KGV-Perz. ${peP.toLocaleString('de-DE', { maximumFractionDigits: 0 })} (${peJahre}J)${peAktuell ? ` · ${peAktuell}` : ''}`
      : '–'
  const discountLeer =
    peP == null
      ? peJahre > 0 && peJahre < 3
        ? `KGV-Historie ${peJahre}J — Perzentil erst ab 3J`
        : 'zu wenig KGV-Historie'
      : null

  const divYield = paket.keyMetrics.find((m) => m.id === 'div_yield')
  const divYieldZahl = divYield ? (kmZahl(paket, 'div_yield') ?? parseMetricZahl(divYield.wert)) : null
  const div = paket.erweitert?.dividenden ?? null
  const payoutZahl = kmZahl(paket, 'payout')
  const payoutText = kmText(paket, 'payout')
  const keineDividende = keineDividendePaket(paket)

  const divStabJahre = keineDividende ? 0 : (div?.jahreOhneSenkung ?? null)
  const divHistJahre = div?.jahreMitDaten ?? divStabJahre ?? 0

  const divGuvHist = historischeWerteAusZeile(zeile(paket, 'dividenden_gezahlt'), paket.perioden).map((v) =>
    Math.abs(v),
  )
  const divGuvCagr = keineDividende ? null : adaptiverCagr(divGuvHist)

  let divCagr: number | null = null
  let divCagrJahre: number | null = null
  let divCagrYoy = false
  if (keineDividende) {
    divCagr = 0
    divCagrJahre = null
  } else if (div?.cagr10yPct != null) {
    divCagr = div.cagr10yPct
    divCagrJahre = 10
  } else if (div?.cagr5yPct != null) {
    divCagr = div.cagr5yPct
    divCagrJahre = 5
  } else if (div?.cagrVerfuegbarPct != null && div.cagrJahre != null) {
    divCagr = div.cagrVerfuegbarPct
    divCagrJahre = div.cagrJahre
  } else if (divGuvCagr) {
    divCagr = divGuvCagr.pct
    divCagrJahre = divGuvCagr.jahre
    divCagrYoy = divGuvCagr.methode === 'yoy-mittel'
  } else if (div?.durchschnittWachstum3yPct != null) {
    divCagr = div.durchschnittWachstum3yPct
    divCagrJahre = 3
    divCagrYoy = true
  }

  let divWachstumLeer: string | null = null
  if (!keineDividende && divCagr == null) {
    const n = divHistJahre
    divWachstumLeer =
      n > 0 && n < 4 ? `Zahler seit ${n}J — CAGR erst ab 3J` : 'keine vergleichbare Dividendenreihe'
  }

  const roicZahl = kmZahl(paket, 'ltm_roic') ?? kmZahl(paket, 'roic')
  const roicTextRoh = kmText(paket, 'ltm_roic') ?? kmText(paket, 'roic')
  const valueSpread = kmZahl(paket, 'ltm_value_spread')
  const incrementalRoic = kmZahl(paket, 'incremental_roic')
  let roicText = roicTextRoh ?? '–'
  let roicPos: number | null = roicZahl != null ? linear(roicZahl, 8, 30) : null
  if (roicTextRoh && valueSpread != null) {
    roicText = `${roicTextRoh} · Spread ${fmtPct(valueSpread)}`
    const spreadPos = linear(valueSpread, -2, 10)
    roicPos = roicPos != null ? clamp01(0.6 * roicPos + 0.4 * spreadPos) : spreadPos
  } else if (roicTextRoh && incrementalRoic != null) {
    roicText = `${roicTextRoh} · Δ ${fmtPct(incrementalRoic)}`
  }

  const divCash = letzterDividendenCashflowMio(paket)
  let fcfDeckungText = '–'
  let fcfDeckungPos: number | null = null
  let fcfDeckungLeer: string | null = null
  if (keineDividende) {
    fcfDeckungText = 'keine Dividende'
    fcfDeckungPos = 0
  } else if (divCash == null || divCash < 0.05) {
    fcfDeckungLeer = 'keine Dividenden in der GuV'
  } else if (fcf == null) {
    fcfDeckungLeer = 'kein FCF'
  } else if (fcf <= 0) {
    fcfDeckungText = 'kein FCF'
    fcfDeckungPos = 0
  } else {
    const x = fcf / divCash
    fcfDeckungText = `${fmtMult(x)} FCF`
    fcfDeckungPos = linear(x, 0.6, 3.2)
  }

  const zinsZahl = kmZahl(paket, 'interest_coverage')
  const zinsText = kmText(paket, 'interest_coverage')
  let zinsPos: number | null = null
  let zinsWert = zinsText ?? '–'
  if (nd != null && nd <= 0 && zinsZahl == null) {
    zinsWert = 'Netto-Cash'
    zinsPos = 1
  } else if (zinsZahl != null) {
    zinsPos = linear(zinsZahl, 2.5, 14)
    zinsWert = zinsText ?? fmtMult(zinsZahl)
  }

  const fcfConvZahl = kmZahl(paket, 'fcf_conversion')
  const fcfConvText = kmText(paket, 'fcf_conversion')
  const fcfConvPos =
    fcfConvZahl == null ? null : linear(Math.min(fcfConvZahl, 160), 45, 125)

  const verwZahlKm = kmZahl(paket, 'aktien_verwaesserung')
  const verwTextKm = kmText(paket, 'aktien_verwaesserung')
  const aktienCagr = adaptiverCagr(historischeWerteAusZeile(zeile(paket, 'aktien'), paket.perioden))
  const verwZahl = verwZahlKm ?? aktienCagr?.pct ?? null
  const verwText =
    verwTextKm ??
    (aktienCagr != null ? `${fmtPct(aktienCagr.pct)} p.a.` : null)
  const verwPos = verwZahl == null ? null : linear(-verwZahl, -4, 4)

  const umsatzCagr =
    cagrMitQuelle(paket, 'umsatz', 'umsatz') ??
    (() => {
      const km = kmZahl(paket, 'rev_cagr_3y')
      return km != null && Number.isFinite(km)
        ? { pct: km, jahre: 3, methode: 'cagr' as const, quelle: 'umsatz' as const }
        : null
    })()
  const umsatzIstGewinnBalken = wachstumEff?.quelle === 'umsatz'

  const fwdZahl = kmZahl(paket, 'fwd_eps_cagr_2y')
  const fwdText = kmText(paket, 'fwd_eps_cagr_2y')
  const fwdPos = fwdZahl == null ? null : linear(fwdZahl, -5, 20)

  const nrrZahl = kmZahl(paket, 'nrr')
  const nrrText = kmText(paket, 'nrr')
  const nrrPos = nrrZahl == null ? null : linear(nrrZahl, 96, 124)

  const payoutPosErtrag =
    keineDividende ? 0 : payoutZahl != null ? tent(payoutZahl, 8, 40, 82) : null

  const werte: Record<ScorecardBalkenId, Omit<ScorecardBalken, 'id'>> = {
    gewinnstabilitaet: {
      label: stabJahre != null ? `Gewinnstabilität ${stabJahre}J` : 'Gewinnstabilität',
      wertText: stabPct != null ? `${stabPct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} %` : '–',
      position: stabPct != null ? clamp01(stabPct / 100) : null,
      leergrund:
        stabPct == null
          ? gewinnJahreVerfuegbar > 0
            ? `Historie ${gewinnJahreVerfuegbar}J — Stabilität erst ab 3J`
            : 'zu wenig Gewinnjahre'
          : null,
    },
    gewinnwachstum: {
      label: gewinnWachstumLabel,
      wertText: gewinnWachstumText,
      position: gewinnWachstumPos,
      leergrund: gewinnWachstumLeer,
    },
    tilgungsjahre: {
      label: 'Tilgungsjahre',
      wertText: tilgungText,
      position: tilgungPos,
    },
    discount: {
      label: 'Discount',
      wertText: discountText,
      position: discountPos,
      leergrund: discountLeer,
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
          ? `${divStabJahre} J. ohne Senkung${divHistJahre > 0 && divHistJahre < 10 ? ` (${divHistJahre}J Hist.)` : ''}`
          : '–',
      position: keineDividende
        ? 0
        : divStabJahre != null
          ? dividendenStabilitaetPosition(divStabJahre, divHistJahre)
          : null,
      leergrund: !keineDividende && divStabJahre == null ? 'keine Dividendenhistorie' : null,
    },
    dividendenwachstum: {
      label: wachstumLabel('Dividendenwachstum', keineDividende ? null : divCagrJahre),
      wertText: keineDividende
        ? 'keine Dividende'
        : divCagr != null
          ? divCagrYoy
            ? `${fmtPct(divCagr)} · Ø YoY`
            : fmtPct(divCagr)
          : '–',
      position: keineDividende ? 0 : divCagr != null ? linear(divCagr, -5, 15) : null,
      leergrund: divWachstumLeer,
    },
    ausschuettung: {
      label: 'Ausschüttungsquote',
      wertText: keineDividende ? 'keine Dividende' : (payoutText ?? '–'),
      position: payoutPosErtrag,
    },
    fcfDeckung: {
      label: 'FCF-Deckung',
      wertText: fcfDeckungText,
      position: fcfDeckungPos,
      leergrund: fcfDeckungLeer,
    },
    zinsdeckung: {
      label: 'Zinsdeckung',
      wertText: zinsWert,
      position: zinsPos,
      leergrund: zinsPos == null ? 'keine Zinsdeckung' : null,
    },
    fcfConversion: {
      label: 'FCF-Conversion',
      wertText: fcfConvText ?? '–',
      position: fcfConvPos,
      leergrund: fcfConvPos == null ? 'kein FCF/Gewinn-Verhältnis' : null,
    },
    verwaesserung: {
      label: 'Aktienzahl p.a.',
      wertText: verwText ?? '–',
      position: verwPos,
      leergrund: verwPos == null ? 'keine Aktienzahl-Reihe' : null,
    },
    umsatzwachstum: {
      label: umsatzCagr ? wachstumLabel('Umsatzwachstum', umsatzCagr.jahre) : 'Umsatzwachstum',
      wertText: umsatzCagr
        ? umsatzCagr.methode === 'yoy-mittel'
          ? `${fmtPct(umsatzCagr.pct)} · Ø YoY`
          : fmtPct(umsatzCagr.pct)
        : '–',
      position: umsatzIstGewinnBalken ? null : umsatzCagr != null ? linear(umsatzCagr.pct, -2, 16) : null,
      leergrund: umsatzIstGewinnBalken
        ? null
        : umsatzCagr == null
          ? 'kein vergleichbares Umsatzfenster'
          : null,
      optional: umsatzIstGewinnBalken,
    },
    fwdWachstum: {
      label: 'Erw. EPS-Wachstum 2J',
      wertText: fwdText ?? '–',
      position: fwdPos,
      leergrund: fwdPos == null ? 'keine Konsens-Schätzung' : null,
    },
    nrr: {
      label: 'NRR',
      wertText: nrrText ?? '–',
      position: nrrPos,
      optional: true,
    },
    roic: {
      label: valueSpread != null ? 'ROIC / Spread' : 'ROIC',
      wertText: roicText,
      position: roicPos,
      leergrund: roicPos == null ? 'kein ROIC' : null,
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
  const gj = zaehleGeschaeftsjahre(paket.perioden)
  const stufe = horizontStufe(gj)
  const strategien: ScorecardStrategie[] = (
    ['dividendenertrag', 'dividendenwachstum', 'gewinnwachstum'] as const
  ).map((id) => {
    const balken = ANZEIGE_BALKEN[id].flatMap((bid) => {
      const b = byId.get(bid)
      if (!b) return []
      if (b.optional && b.position == null) return []
      return [b]
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
    historie: {
      geschaeftsjahre: gj,
      stufe,
      badge: historieBadge(gj),
      fussnote: historieFussnote(gj),
    },
  }
}

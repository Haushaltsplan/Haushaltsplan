import {
  cagr3AusSerie,
  cagrProzent,
  formatFundamentalWert,
} from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { historischeWerteAusZeile } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { FundamentalSchaetzungenRoh } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import type {
  FundamentalKeyMetric,
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  FUNDAMENTAL_TTM_KEY,
  istFundamentalQuartalSchaetzungIso,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { FundamentalKontextWerte } from '@/lib/portfolio-analyse/fundamentaldaten-kontext-werte'
import type { MacrotrendsFundamentalRoh } from '@/lib/portfolio-analyse/macrotrends-scraper-server'

export type YahooFundamentalKennzahlen = {
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  beta?: number
  marketCap?: number
  sharesOutstanding?: number
  floatShares?: number
  /** Alle Klassen (Dual-Class) — besserer Nenner für Free Float. */
  impliedSharesOutstanding?: number
  enterpriseValue?: number
  trailingPE?: number
  forwardPE?: number
  dividendYield?: number
  payoutRatio?: number
  trailingEps?: number
  trailingAnnualDividendRate?: number
  returnOnEquity?: number
  returnOnAssets?: number
  revenueGrowth?: number
  earningsGrowth?: number
  grossMargins?: number
  operatingMargins?: number
  ebitdaMargins?: number
  currentPrice?: number
  /** ISO-Währung des Listing-Kurses (USD, EUR, …). */
  currency?: string
  targetMeanPrice?: number
  priceToBook?: number
  enterpriseToRevenue?: number
  enterpriseToEbitda?: number
  totalDebt?: number
  totalCash?: number
  averageVolume?: number
  ntmEpsSchaetzung?: number
  ntmRevenueUsd?: number
  ntmEbitdaUsd?: number
  fy1RevenueUsd?: number
  fy1EbitdaUsd?: number
  fy1Eps?: number
}

function wertAnPeriode(z: FundamentalMetrikZeile | undefined, key: string): number | null {
  return z?.werte[key] ?? null
}

function jahresSchaetzKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden.filter((p) => !istFundamentalQuartalSchaetzungIso(p.iso)).map((p) => p.iso)
}

/** Erwartetes 2J-Wachstum: darüber liegt fast immer Einheiten-Mix, nicht Consensus. */
const FWD_CAGR_ABS_MAX = 55

/**
 * YoY aus den ersten zwei Jahres-Schätzungen.
 * Quartals-Spalten und Einheiten-Mix (z. B. Jahres-EPS vs. Quartals-EPS → −80 %)
 * werden verworfen; Fallback: Consensus-Wachstumsfeld derselben Spalte.
 */
function fwdCagrZweiJahre(
  niveau: FundamentalMetrikZeile | undefined,
  wachstum: FundamentalMetrikZeile | undefined,
  jahresKeys: string[],
  referenzCagr: number | null,
): number | null {
  const k0 = jahresKeys[0]
  const k1 = jahresKeys[1]
  const a = k0 ? wertAnPeriode(niveau, k0) : null
  const b = k1 ? wertAnPeriode(niveau, k1) : null
  const ausNiveau = a != null && b != null && a > 0 && b > 0 ? cagrProzent([a, b], 1) : null
  const ausFeld = k1 ? wertAnPeriode(wachstum, k1) : k0 ? wertAnPeriode(wachstum, k0) : null
  const feldOk = ausFeld != null && Number.isFinite(ausFeld) && Math.abs(ausFeld) <= FWD_CAGR_ABS_MAX

  const niveausMix =
    ausNiveau != null &&
    (Math.abs(ausNiveau) > FWD_CAGR_ABS_MAX ||
      (a != null && b != null && a > 0 && b > 0 && (b / a > 1.6 || a / b > 1.6)) ||
      (ausNiveau < -35 && referenzCagr != null && referenzCagr > 0))
  if (ausNiveau != null && !niveausMix) return ausNiveau
  if (feldOk) return ausFeld
  return null
}

function letzterGeschaeftsjahresKey(perioden: FundamentalPeriode[] | undefined): string | null {
  const keys = perioden?.filter((p) => !p.istLtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  return keys.length > 0 ? keys[keys.length - 1]! : null
}

function letzterGeschaeftsjahresWert(
  zeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number | null {
  if (!zeile) return null
  const ttm = zeile.werte[FUNDAMENTAL_TTM_KEY]
  if (ttm != null) return ttm
  const lastKey = letzterGeschaeftsjahresKey(perioden)
  return lastKey ? wertAnPeriode(zeile, lastKey) : null
}

function multiple(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? formatFundamentalWert(v, 'multiple') : '–'
}

function pctRaw(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? formatFundamentalWert(v, 'prozent') : '–'
}

function zahl(v: number | null | undefined, suffix = ''): string {
  return v != null && Number.isFinite(v) ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })}${suffix}` : '–'
}

function kursSuffix(currency?: string | null): string {
  const c = currency?.trim().toUpperCase()
  if (!c || c === 'USD') return ' $'
  if (c === 'EUR') return ' €'
  if (c === 'GBP') return ' £'
  if (c === 'CHF') return ' CHF'
  return ` ${c}`
}

function waehrungNegativ(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–'
  const s = formatFundamentalWert(Math.abs(v), 'waehrung_usd')
  return v < 0 ? `(${s})` : s
}

function pctSigned(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–'
  if (v < 0) return `(${formatFundamentalWert(Math.abs(v), 'prozent')})`
  return formatFundamentalWert(v, 'prozent')
}

/** Minuszeichen statt Klammern — für Kennzahlen, bei denen negativ gut sein kann (Rückkäufe). */
/**
 * ROIIC mit Regime-Hinweis. Ohne den Zusatz wäre der Wert irreführend: im kapitalleichten
 * Regime steht im Nenner die Brutto-Reinvestition statt ΔIC, und bei einer Großakquisition
 * im Fenster ist der organische Wert nach oben verzerrt. Der Buchwert daneben zeigt, wie
 * teuer der Zukauf war — genau der Kontrast, um den es bei ROIC gegen ROIIC geht.
 */
function roiicAnzeige(
  w:
    | {
        incrementalRoicPct?: number | null
        incrementalRoicRegime?: string | null
        incrementalRoicBuchPct?: number | null
      }
    | null
    | undefined,
): string {
  const basis = pctRaw(w?.incrementalRoicPct)
  if (basis === '–') return basis

  const zusatz: string[] = []
  if (w?.incrementalRoicRegime === 'kapitalleicht') zusatz.push('kapitalleicht')
  if (w?.incrementalRoicRegime === 'schrumpfend') zusatz.push('NOPAT rückläufig')
  if (
    w?.incrementalRoicBuchPct != null &&
    w.incrementalRoicPct != null &&
    Math.abs(w.incrementalRoicBuchPct - w.incrementalRoicPct) >= 5
  ) {
    zusatz.push(`Buch ${pctRaw(w.incrementalRoicBuchPct)}`)
  }
  return zusatz.length > 0 ? `${basis} (${zusatz.join(', ')})` : basis
}

function pctMitVorzeichen(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–'
  const abs = formatFundamentalWert(Math.abs(v), 'prozent')
  if (v < 0) return `−${abs}`
  if (v > 0) return `+${abs}`
  return abs
}

export function baueKeyMetrics(
  yahoo: YahooFundamentalKennzahlen | null,
  roh: MacrotrendsFundamentalRoh | null,
  schaetzungen: FundamentalSchaetzungenRoh,
  kontextWerte: FundamentalKontextWerte | null,
): FundamentalKeyMetric[] {
  const out: FundamentalKeyMetric[] = []
  const perioden = roh?.perioden
  const w = kontextWerte

  const sharesDenom = Math.max(
    yahoo?.sharesOutstanding ?? 0,
    yahoo?.impliedSharesOutstanding ?? 0,
  )
  let floatPct: number | null =
    yahoo?.floatShares != null && sharesDenom > 0
      ? (yahoo.floatShares / sharesDenom) * 100
      : null
  // Dual-Class / Datenfehler: >100 % ist unmöglich
  if (floatPct != null && (floatPct <= 0 || floatPct > 100.5)) floatPct = null
  else if (floatPct != null && floatPct > 100) floatPct = 100

  const volMio = yahoo?.averageVolume != null ? yahoo.averageVolume / 1_000_000 : null

  const kursEinheit = kursSuffix(yahoo?.currency)

  out.push(
    { id: '52w_hoch', label: '52-Wochen-Hoch', wert: zahl(yahoo?.fiftyTwoWeekHigh, kursEinheit), gruppe: 'marktdaten' },
    { id: '52w_tief', label: '52-Wochen-Tief', wert: zahl(yahoo?.fiftyTwoWeekLow, kursEinheit), gruppe: 'marktdaten' },
    {
      id: 'kurs_aktuell',
      label: 'Aktueller Kurs',
      wert: zahl(yahoo?.currentPrice, kursEinheit),
      gruppe: 'marktdaten',
    },
    { id: 'vol_3m', label: 'Ø Volumen (3M)', wert: volMio != null ? `${zahl(volMio)} Mio.` : '–', gruppe: 'marktdaten' },
    { id: 'beta', label: '5-Jahres-Beta', wert: zahl(yahoo?.beta), gruppe: 'marktdaten' },
    { id: 'float', label: 'Free Float', wert: pctRaw(floatPct), gruppe: 'marktdaten' },
  )

  const netDebt = w?.netDebt ?? null
  const ebitdaGuV = roh?.zeilen.find((z) => z.id === 'ebitda')
  const netDebtEbitda = w?.netDebtEbitda ?? null

  out.push(
    {
      id: 'market_cap',
      label: 'Marktkapitalisierung',
      wert: formatFundamentalWert(yahoo?.marketCap ?? null, 'waehrung_usd'),
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'enterprise_value',
      label: 'Enterprise Value',
      wert: formatFundamentalWert(yahoo?.enterpriseValue ?? null, 'waehrung_usd'),
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'shares_out',
      label: 'Ausstehende Aktien',
      wert:
        yahoo?.sharesOutstanding != null
          ? `${(yahoo.sharesOutstanding / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio.`
          : '–',
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'net_debt',
      label: 'Nettoverschuldung (LTM)',
      wert: waehrungNegativ(netDebt),
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'net_debt_ebitda',
      label: 'Net Debt / EBITDA (LTM)',
      wert: netDebtEbitda != null ? (netDebtEbitda < 0 ? `(${multiple(Math.abs(netDebtEbitda))})` : multiple(netDebtEbitda)) : '–',
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'net_debt_fcf',
      label: 'Net Debt / FCF (LTM)',
      wert:
        w?.netDebtFcf != null
          ? w.netDebtFcf < 0
            ? `(${multiple(Math.abs(w.netDebtFcf))})`
            : multiple(w.netDebtFcf)
          : '–',
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'interest_coverage',
      label: 'Zinsdeckung (EBIT/Zins)',
      wert: w?.interestCoverage != null ? multiple(w.interestCoverage) : '–',
      gruppe: 'kapitalstruktur',
    },
  )

  const fcfZeile = roh?.zeilen.find((z) => z.id === 'fcf')
  const umsatzZeile = roh?.zeilen.find((z) => z.id === 'umsatz')

  out.push(
    {
      id: 'ltm_brutto',
      label: 'LTM Bruttomarge',
      wert: pctRaw(w?.bruttoMarge),
      gruppe: 'effizienz',
    },
    {
      id: 'brutto_std_10y',
      label: 'Bruttomarge StdAbw. (≤10J)',
      wert:
        w?.bruttoMargeStd10y != null
          ? `${zahl(w.bruttoMargeStd10y)} Pp.${w.pricingPowerOk === false ? ' ⚠' : w.pricingPowerOk ? ' ✓' : ''}`
          : '–',
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_ebit',
      label: 'LTM EBIT-Marge',
      wert: pctRaw(w?.ebitMarge),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roa',
      label: 'LTM ROA',
      wert: pctRaw(w?.roa),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roe',
      label: 'LTM ROE',
      wert: pctRaw(w?.roe),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roic',
      label: 'LTM ROIC',
      wert: pctRaw(w?.roicAnzeige ?? w?.roic ?? w?.roicExGoodwill),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roic_ex_gw',
      label: 'LTM ROIC ex Goodwill',
      wert: pctRaw(w?.roicExGoodwill),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_value_spread',
      label: 'Value Spread (ROIC − WACC)',
      wert: pctSigned(w?.valueSpread),
      ton:
        w?.valueSpread == null
          ? undefined
          : w.valueSpread >= 0
            ? 'positiv'
            : 'negativ',
      gruppe: 'effizienz',
    },
    {
      id: 'reinvest_quote',
      label: 'Reinvestitionsquote (CapEx+M&A−D&A)/FCF',
      wert: pctMitVorzeichen(w?.reinvestitionsquotePct),
      gruppe: 'effizienz',
    },
    {
      id: 'incremental_roic',
      // Fensterlänge zuerst: „Lag 1J“ allein wurde als Einjahresfenster gelesen.
      label: 'Incremental ROIC (ΔNOPAT/ΔIC, 3J, ΔIC 1J versetzt)',
      wert: roiicAnzeige(w),
      zahl: w?.incrementalRoicPct ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'sloan_ratio',
      label: 'Sloan-Ratio (Accruals)',
      wert: w?.sloanRatio != null ? zahl(w.sloanRatio) : '–',
      gruppe: 'effizienz',
    },
    {
      id: 'beneish_m',
      label: 'Beneish M-Score',
      wert:
        w?.beneishMScore != null
          ? `${zahl(w.beneishMScore)}${w.beneishRisiko ? ` (${w.beneishRisiko})` : ''}`
          : '–',
      gruppe: 'effizienz',
    },
  )

  const umsatzSchaetz0 = schaetzungen.zeilen.find((z) => z.id === 'umsatz_schaetzung')
  const epsSchaetz0 = schaetzungen.zeilen.find((z) => z.id === 'eps_schaetzung')
  const ebitdaSchaetz0 = schaetzungen.zeilen.find((z) => z.id === 'ebitda_schaetzung')
  const umsatzWachstumZ = schaetzungen.zeilen.find((z) => z.id === 'umsatz_wachstum_schaetzung')
  const epsWachstumZ = schaetzungen.zeilen.find((z) => z.id === 'eps_wachstum_schaetzung')
  const jahresKeys = jahresSchaetzKeys(schaetzungen.perioden)

  const revCagr2 = fwdCagrZweiJahre(umsatzSchaetz0, umsatzWachstumZ, jahresKeys, null)
  const epsCagr2 = fwdCagrZweiJahre(epsSchaetz0, epsWachstumZ, jahresKeys, revCagr2)

  const ebitdaCagr2Yahoo =
    yahoo?.ntmEbitdaUsd != null && yahoo?.fy1EbitdaUsd != null && yahoo.ntmEbitdaUsd > 0 && yahoo.fy1EbitdaUsd > 0
      ? cagrProzent([yahoo.ntmEbitdaUsd, yahoo.fy1EbitdaUsd], 1)
      : null
  const ebitdaCagr2YahooOk =
    ebitdaCagr2Yahoo != null && Math.abs(ebitdaCagr2Yahoo) <= FWD_CAGR_ABS_MAX ? ebitdaCagr2Yahoo : null
  const ebitdaCagr2Ms = fwdCagrZweiJahre(ebitdaSchaetz0, undefined, jahresKeys, revCagr2)
  const ebitdaCagr2 = ebitdaCagr2YahooOk ?? ebitdaCagr2Ms

  out.push(
    { id: 'fwd_rev_cagr_2y', label: 'Erw. Umsatz-CAGR (2J)', wert: pctRaw(revCagr2), gruppe: 'wachstum' },
    { id: 'fwd_ebitda_cagr_2y', label: 'Erw. EBITDA-CAGR (2J)', wert: pctRaw(ebitdaCagr2), gruppe: 'wachstum' },
    { id: 'fwd_eps_cagr_2y', label: 'Erw. EPS-CAGR (2J)', wert: pctRaw(epsCagr2), gruppe: 'wachstum' },
    {
      id: 'rev_cagr_3y',
      label: 'Umsatz-CAGR (3J)',
      wert: pctRaw(w?.umsatzCagr3),
      gruppe: 'wachstum',
    },
    {
      id: 'ebitda_cagr_3y',
      label: 'EBITDA-CAGR (3J)',
      wert: pctRaw(w?.ebitdaCagr3),
      gruppe: 'wachstum',
    },
    {
      id: 'eps_cagr_3y',
      label: 'EPS-CAGR (3J)',
      wert: pctRaw(w?.epsCagr3),
      gruppe: 'wachstum',
    },
  )

  const kgvZeile = roh?.zeilen.find((z) => z.id === 'kgv')
  const psZeile = roh?.zeilen.find((z) => z.id === 'ps')
  const pbZeile = roh?.zeilen.find((z) => z.id === 'pb')
  const pfcfZeile = roh?.zeilen.find((z) => z.id === 'pfcf')
  const evRevZeile = roh?.zeilen.find((z) => z.id === 'ev_rev')
  const evEbitdaZeile = roh?.zeilen.find((z) => z.id === 'ev_ebitda')

  const ltmUmsatzUsd =
    letzterGeschaeftsjahresWert(umsatzZeile, perioden) != null
      ? letzterGeschaeftsjahresWert(umsatzZeile, perioden)! * 1_000_000
      : null
  const ltmEvRevenue =
    yahoo?.enterpriseValue != null && ltmUmsatzUsd != null && ltmUmsatzUsd > 0
      ? yahoo.enterpriseValue / ltmUmsatzUsd
      : null

  // Forward = erstes FY-Schätz-Multiple aus der Bewertungstabelle (kein NTM)
  const ersteFySchaetzKeys =
    perioden
      ?.filter((p) => p.istSchaetzung && !istFundamentalQuartalSchaetzungIso(p.iso))
      .map((p) => p.iso) ?? []
  const fyWert = (z: FundamentalMetrikZeile | undefined): number | null => {
    if (!z) return null
    for (const k of ersteFySchaetzKeys) {
      const v = z.werte[k]
      if (v != null && Number.isFinite(v)) return v
    }
    return null
  }

  const fwdKgv =
    fyWert(kgvZeile) ??
    (yahoo?.currentPrice != null && yahoo?.fy1Eps != null && yahoo.fy1Eps > 0
      ? yahoo.currentPrice / yahoo.fy1Eps
      : null) ??
    yahoo?.forwardPE ??
    null

  const ltmFcfUsd =
    letzterGeschaeftsjahresWert(fcfZeile, perioden) != null
      ? letzterGeschaeftsjahresWert(fcfZeile, perioden)! * 1_000_000
      : null
  const fwdMcFcf =
    fyWert(pfcfZeile) ??
    (yahoo?.marketCap != null && ltmFcfUsd != null && ltmFcfUsd > 0 && yahoo?.revenueGrowth != null
      ? yahoo.marketCap / (ltmFcfUsd * (1 + yahoo.revenueGrowth))
      : null)

  const fwdEvRevenue = fyWert(evRevZeile) ?? yahoo?.enterpriseToRevenue ?? null
  const fwdEvEbitda = fyWert(evEbitdaZeile) ?? yahoo?.enterpriseToEbitda ?? null

  out.push(
    {
      id: 'target_price',
      label: 'Kursziel (Konsens)',
      wert: zahl(yahoo?.targetMeanPrice, ' $'),
      gruppe: 'bewertung_ntm',
    },
    { id: 'ntm_ev_rev', label: 'FY EV / Umsatz', wert: multiple(fwdEvRevenue), gruppe: 'bewertung_ntm' },
    { id: 'ntm_ev_ebitda', label: 'FY EV / EBITDA', wert: multiple(fwdEvEbitda), gruppe: 'bewertung_ntm' },
    { id: 'ntm_pe', label: 'FY KGV (P/E)', wert: multiple(fwdKgv), gruppe: 'bewertung_ntm' },
    {
      id: 'peg_ratio',
      label: 'PEG (Fwd-KGV / EPS-Wachstum)',
      wert: multiple(w?.pegRatio),
      gruppe: 'bewertung_ntm',
    },
    { id: 'ntm_mc_fcf', label: 'FY MC / FCF', wert: multiple(fwdMcFcf), gruppe: 'bewertung_ntm' },
    { id: 'ltm_ev_rev', label: 'LTM EV / Umsatz', wert: multiple(ltmEvRevenue), gruppe: 'bewertung_ltm' },
    {
      id: 'ltm_pe',
      label: 'LTM KGV (P/E)',
      wert: multiple(yahoo?.trailingPE ?? letzterGeschaeftsjahresWert(kgvZeile, perioden)),
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'ltm_pb',
      label: 'LTM KBV (P/B)',
      wert: multiple(letzterGeschaeftsjahresWert(pbZeile, perioden) ?? w?.pb),
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'ltm_ps',
      label: 'LTM KUV (P/S)',
      wert: multiple(letzterGeschaeftsjahresWert(psZeile, perioden)),
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'ltm_pfcf',
      label: 'LTM MC / FCF',
      wert: multiple(
        yahoo?.marketCap != null && ltmFcfUsd != null && ltmFcfUsd > 0 ? yahoo.marketCap / ltmFcfUsd : letzterGeschaeftsjahresWert(pfcfZeile, perioden),
      ),
      gruppe: 'bewertung_ltm',
    },
    { id: 'div_yield', label: 'Dividendenrendite', wert: pctRaw(w?.divYieldPct ?? (yahoo?.dividendYield != null ? yahoo.dividendYield * 100 : null)), gruppe: 'bewertung_ltm' },
    {
      id: 'payout',
      label: 'Ausschüttungsquote',
      wert: pctRaw(w?.payoutPct),
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'fcf_conversion',
      label: 'FCF-Conversion (FCF/Nettogewinn)',
      wert: pctRaw(w?.fcfConversion),
      gruppe: 'effizienz',
    },
    {
      id: 'aktien_verwaesserung',
      label: 'Aktien-Verwässerung p.a.',
      wert: pctMitVorzeichen(w?.aktienVerwaesserungJaehrlichPct),
      ton:
        w?.aktienVerwaesserungJaehrlichPct == null
          ? undefined
          : w.aktienVerwaesserungJaehrlichPct <= 0
            ? 'positiv'
            : w.aktienVerwaesserungJaehrlichPct >= 1.5
              ? 'negativ'
              : 'neutral',
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'rule_of_40',
      label: 'Rule of 40',
      wert: w?.ruleOf40 != null ? zahl(w.ruleOf40) : '–',
      gruppe: 'wachstum',
    },
    {
      id: 'sbc_fcf_ratio',
      label: 'SBC / FCF',
      wert: pctRaw(w?.sbcFcfRatio),
      gruppe: 'effizienz',
    },
    {
      id: 'nrr',
      label: 'NRR (Net Retention)',
      wert: pctRaw(w?.nrrPct),
      gruppe: 'wachstum',
    },
  )

  return out
}

/** Schätzungs-Zeilen aus einem gespeicherten Paket — für Caches ohne erneuten Scrape. */
export function schaetzungenRohAusPaket(p: {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
}): FundamentalSchaetzungenRoh {
  const perioden = p.perioden.filter((x) => x.istSchaetzung)
  const zeilen = p.zeilen.filter((z) => z.gruppe === 'schaetzungen' || z.id.endsWith('_schaetzung'))
  if (zeilen.some((z) => z.id === 'eps_schaetzung' || z.id === 'umsatz_schaetzung')) {
    return { perioden, zeilen }
  }
  const synth: FundamentalMetrikZeile[] = []
  for (const [id, src] of [
    ['umsatz_schaetzung', 'umsatz'],
    ['eps_schaetzung', 'eps'],
    ['ebitda_schaetzung', 'ebitda'],
  ] as const) {
    const z = p.zeilen.find((r) => r.id === src)
    if (z) synth.push({ ...z, id, gruppe: 'schaetzungen', istSchaetzung: true })
  }
  return { perioden, zeilen: synth }
}

function cagr3AusPaketZeile(
  zeileId: string,
  historisch: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } | undefined,
): number | null {
  if (!historisch) return null
  const z = historisch.zeilen.find((r) => r.id === zeileId)
  return cagr3AusSerie(historischeWerteAusZeile(z, historisch.perioden))
}

/** Korrigiert Erw.-CAGR und 3J-CAGR in gespeicherten Key Metrics (Quartal/Einheiten-Mix). */
export function korrigiereFwdWachstumKeyMetrics(
  keyMetrics: FundamentalKeyMetric[],
  schaetzungen: FundamentalSchaetzungenRoh,
  historisch?: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
): FundamentalKeyMetric[] {
  const jahresKeys = jahresSchaetzKeys(schaetzungen.perioden)
  const rev = fwdCagrZweiJahre(
    schaetzungen.zeilen.find((z) => z.id === 'umsatz_schaetzung'),
    schaetzungen.zeilen.find((z) => z.id === 'umsatz_wachstum_schaetzung'),
    jahresKeys,
    null,
  )
  const eps = fwdCagrZweiJahre(
    schaetzungen.zeilen.find((z) => z.id === 'eps_schaetzung'),
    schaetzungen.zeilen.find((z) => z.id === 'eps_wachstum_schaetzung'),
    jahresKeys,
    rev,
  )
  const ebitda = fwdCagrZweiJahre(
    schaetzungen.zeilen.find((z) => z.id === 'ebitda_schaetzung'),
    undefined,
    jahresKeys,
    rev,
  )
  const rev3 = cagr3AusPaketZeile('umsatz', historisch)
  const ebitda3 = cagr3AusPaketZeile('ebitda', historisch)
  const eps3 = cagr3AusPaketZeile('eps', historisch)
  return keyMetrics.map((k) => {
    if (k.id === 'fwd_rev_cagr_2y') return { ...k, wert: pctRaw(rev) }
    if (k.id === 'fwd_eps_cagr_2y') return { ...k, wert: pctRaw(eps) }
    if (k.id === 'fwd_ebitda_cagr_2y' && ebitda != null) return { ...k, wert: pctRaw(ebitda) }
    if (k.id === 'rev_cagr_3y' && historisch) return { ...k, wert: pctRaw(rev3) }
    if (k.id === 'ebitda_cagr_3y' && historisch) return { ...k, wert: pctRaw(ebitda3) }
    if (k.id === 'eps_cagr_3y' && historisch) return { ...k, wert: pctRaw(eps3) }
    return k
  })
}

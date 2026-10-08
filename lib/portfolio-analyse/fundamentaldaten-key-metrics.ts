import {
  cagr3AusSerie,
  cagr5AusSerie,
  cagrProzent,
  formatFundamentalWert,
} from '@/lib/portfolio-analyse/fundamentaldaten-format'
import {
  fcfRenditeAusPfcf,
} from '@/lib/portfolio-analyse/fundamentaldaten-fcf-rendite-zeilen'
import {
  berechneIncrementalValueSpread,
  historischeJahresKeys,
  historischeWerteAusZeile,
  ttmOderLetzterFlow,
} from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import {
  berechnePegRatio,
  waehlePegWachstumPct,
} from '@/lib/portfolio-analyse/fundamentaldaten-reinvestition'
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
  /** Herkunft des Beta: Yahoo Key Statistics oder OLS aus Monatsrenditen. */
  betaQuelle?: 'yahoo' | 'berechnet'
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
  sector?: string
  industry?: string
}

function wertAnPeriode(z: FundamentalMetrikZeile | undefined, key: string): number | null {
  return z?.werte[key] ?? null
}

function jahresSchaetzKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden.filter((p) => !istFundamentalQuartalSchaetzungIso(p.iso)).map((p) => p.iso)
}

/** Erwartetes 2J-Wachstum: darüber liegt fast immer Einheiten-Mix, nicht Consensus. */
/** Erw. 2J: echte High-Growth-Jahre durchlassen; 3–4×-Sprünge bleiben Einheiten-Mix. */
const FWD_CAGR_ABS_MAX = 90
const FWD_CAGR_NIVEAU_FAKTOR = 2.2

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
      (a != null && b != null && a > 0 && b > 0 && (b / a > FWD_CAGR_NIVEAU_FAKTOR || a / b > FWD_CAGR_NIVEAU_FAKTOR)) ||
      (ausNiveau < -35 && referenzCagr != null && referenzCagr > 0))
  if (ausNiveau != null && !niveausMix) return ausNiveau
  if (feldOk) return ausFeld
  return null
}

function letzterGeschaeftsjahresKey(perioden: FundamentalPeriode[] | undefined): string | null {
  const keys = historischeJahresKeys(perioden)
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

/**
 * Forward-KGV: Schätz-Spalten (Wallstreet/Marketscreener) sind bei EU oft
 * um Größenordnungen falsch. Plausibel halten vs. Trailing; sonst Preis≈KGV·EPS / Fwd-EPS.
 */
function ermittleFwdKgv(opts: {
  perioden: FundamentalPeriode[] | undefined
  kgvZeile: FundamentalMetrikZeile | undefined
  epsZeile: FundamentalMetrikZeile | undefined
  yahooForwardPe?: number | null
  yahooPrice?: number | null
  yahooFy1Eps?: number | null
  ltmPeFallback?: number | null
}): number | null {
  const { perioden, kgvZeile, epsZeile } = opts
  const fyKeys =
    perioden
      ?.filter((p) => p.istSchaetzung && !istFundamentalQuartalSchaetzungIso(p.iso))
      .map((p) => p.iso) ?? []
  let fyKgv: number | null = null
  let fyEps: number | null = null
  for (const k of fyKeys) {
    if (fyKgv == null) fyKgv = wertAnPeriode(kgvZeile, k)
    if (fyEps == null) fyEps = wertAnPeriode(epsZeile, k)
    if (fyKgv != null && fyEps != null) break
  }
  const histKgv = letzterGeschaeftsjahresWert(kgvZeile, perioden)
  const histEps = letzterGeschaeftsjahresWert(epsZeile, perioden)
  const ltmPe = opts.ltmPeFallback ?? histKgv
  const ausYahooPe =
    opts.yahooForwardPe != null && opts.yahooForwardPe > 0 && opts.yahooForwardPe < 500
      ? opts.yahooForwardPe
      : null
  const ausPreisEps =
    opts.yahooPrice != null &&
    opts.yahooFy1Eps != null &&
    opts.yahooPrice > 0 &&
    opts.yahooFy1Eps > 0
      ? opts.yahooPrice / opts.yahooFy1Eps
      : null
  const ausHistPreis =
    histKgv != null && histEps != null && fyEps != null && histKgv > 0 && histEps > 0 && fyEps > 0
      ? (histKgv * histEps) / fyEps
      : null

  const plausibel = (pe: number | null): pe is number => {
    if (pe == null || !Number.isFinite(pe) || pe <= 0 || pe >= 500) return false
    if (ltmPe != null && ltmPe > 5) {
      // Schätz-KGV darf nicht um Größenordnungen vom Trailing abweichen (Scraping-Einheiten).
      if (pe < ltmPe * 0.35 || pe > ltmPe * 2.8) return false
    }
    return true
  }

  for (const k of [ausYahooPe, ausPreisEps, fyKgv, ausHistPreis]) {
    if (plausibel(k)) return Math.round(k * 100) / 100
  }
  // Wenn nur Rekonstruktion aus Hist-Preis bleibt (fyKgv verworfen): etwas lockerer.
  if (ausHistPreis != null && ausHistPreis > 0 && ausHistPreis < 500) {
    return Math.round(ausHistPreis * 100) / 100
  }
  if (ausYahooPe != null) return Math.round(ausYahooPe * 100) / 100
  if (ausPreisEps != null && ausPreisEps < 500) return Math.round(ausPreisEps * 100) / 100
  return null
}

/**
 * Forward-Multiples (EV/Umsatz, EV/EBITDA, MC/FCF): Schätz-Spalten oft Einheiten-Mix
 * (z. B. EV/Umsatz 22 000× statt 18×). Gegen Trailing prüfen, sonst skalieren/LTM.
 */
function ermittleFwdMultiple(opts: {
  fyRoh: number | null | undefined
  ltm: number | null | undefined
  yahoo?: number | null
  histNiveau?: number | null
  fyNiveau?: number | null
  /** Harte Obergrenze (EV/Umsatz viel niedriger als PE-Cap). */
  absMax?: number
}): number | null {
  const absMax = opts.absMax ?? 500
  const ltm = opts.ltm != null && Number.isFinite(opts.ltm) && opts.ltm > 0 ? opts.ltm : null
  const skalier =
    ltm != null &&
    opts.histNiveau != null &&
    opts.fyNiveau != null &&
    opts.histNiveau > 0 &&
    opts.fyNiveau > 0
      ? ltm * (opts.histNiveau / opts.fyNiveau)
      : null

  const ok = (v: number | null | undefined): v is number => {
    if (v == null || !Number.isFinite(v) || v <= 0 || v >= absMax) return false
    if (ltm != null && ltm > 0.2) {
      if (v < ltm * 0.25 || v > ltm * 4) return false
    }
    return true
  }

  for (const k of [opts.yahoo, opts.fyRoh, skalier]) {
    if (ok(k)) return Math.round(k * 100) / 100
  }
  if (skalier != null && skalier > 0 && skalier < absMax) return Math.round(skalier * 100) / 100
  if (ltm != null && ltm < absMax) return Math.round(ltm * 100) / 100
  return null
}

function ersterFySchaetzWert(
  zeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number | null {
  if (!zeile || !perioden) return null
  for (const p of perioden) {
    if (!p.istSchaetzung || istFundamentalQuartalSchaetzungIso(p.iso)) continue
    const v = zeile.werte[p.iso]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
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
  // Reines „0 %“ bei NOPAT-Rückgang ist irreführend — lieber klar kennzeichnen.
  if (
    w?.incrementalRoicRegime === 'schrumpfend' &&
    (w.incrementalRoicPct == null || w.incrementalRoicPct === 0)
  ) {
    const buch =
      w.incrementalRoicBuchPct != null && w.incrementalRoicBuchPct !== 0
        ? ` · Buch ${pctRaw(w.incrementalRoicBuchPct)}`
        : ''
    return `– (NOPAT rückläufig${buch})`
  }

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
    {
      id: 'beta',
      label: yahoo?.betaQuelle === 'berechnet' ? '5-Jahres-Beta (berechnet)' : '5-Jahres-Beta',
      wert: zahl(yahoo?.beta),
      zahl: yahoo?.beta ?? null,
      gruppe: 'marktdaten',
    },
    {
      id: 'float',
      label: 'Free Float',
      wert: pctRaw(floatPct),
      zahl: floatPct ?? null,
      gruppe: 'marktdaten',
    },
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
      zahl: netDebtEbitda ?? null,
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
      zahl: w?.netDebtFcf ?? null,
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'interest_coverage',
      label: 'Zinsdeckung (EBIT/Zins)',
      wert: w?.interestCoverage != null ? multiple(w.interestCoverage) : '–',
      zahl: w?.interestCoverage ?? null,
      gruppe: 'kapitalstruktur',
    },
  )

  const fcfZeile = roh?.zeilen.find((z) => z.id === 'fcf')
  const umsatzZeile = roh?.zeilen.find((z) => z.id === 'umsatz')

  out.push(
    {
      id: 'ltm_brutto',
      label: 'LTM Bruttomarge',
      wert: w?.bruttoMargeSchein ? '– (kein COGS)' : pctRaw(w?.bruttoMarge),
      zahl: w?.bruttoMargeSchein ? null : (w?.bruttoMarge ?? null),
      gruppe: 'effizienz',
    },
    {
      id: 'brutto_std_10y',
      label: 'Bruttomarge StdAbw. (≤10J)',
      wert: w?.bruttoMargeSchein
        ? '–'
        : w?.bruttoMargeStd10y != null
          ? `${zahl(w.bruttoMargeStd10y)} Pp.${w.pricingPowerOk === false ? ' ⚠' : w.pricingPowerOk ? ' ✓' : ''}`
          : '–',
      zahl: w?.bruttoMargeSchein ? null : (w?.bruttoMargeStd10y ?? null),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_ebit',
      label: 'LTM EBIT-Marge',
      wert: pctRaw(w?.ebitMarge),
      zahl: w?.ebitMarge ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roa',
      label: 'LTM ROA',
      wert: pctRaw(w?.roa),
      zahl: w?.roa ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roe',
      label: 'LTM ROE',
      wert: pctRaw(w?.roe),
      zahl: w?.roe ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roic',
      label: 'LTM ROIC',
      wert: pctRaw(w?.roicAnzeige ?? w?.roic ?? w?.roicExGoodwill),
      zahl: w?.roicAnzeige ?? w?.roic ?? w?.roicExGoodwill ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roic_ex_gw',
      label: 'LTM ROIC ex Goodwill',
      wert: pctRaw(w?.roicExGoodwill),
      zahl: w?.roicExGoodwill ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'wacc',
      label: 'WACC (geschätzt, CAPM)',
      wert: pctRaw(w?.wacc),
      zahl: w?.wacc ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_value_spread',
      label: 'Value Spread (ROIC − WACC)',
      wert: pctSigned(w?.valueSpread),
      zahl: w?.valueSpread ?? null,
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
      zahl: w?.reinvestitionsquotePct ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'incremental_roic',
      // Fensterlänge zuerst: „Lag 1J“ allein wurde als Einjahresfenster gelesen.
      label: 'Incremental ROIC (ΔNOPAT/ΔIC, 3J, ΔIC 1J versetzt)',
      wert: roiicAnzeige(w),
      zahl:
        w?.incrementalRoicRegime === 'schrumpfend' &&
        (w.incrementalRoicPct == null || w.incrementalRoicPct === 0)
          ? null
          : (w?.incrementalRoicPct ?? null),
      gruppe: 'effizienz',
    },
    {
      id: 'roic_5y_avg',
      label: 'Hist. ROIC (5J-Schnitt)',
      wert: pctRaw(w?.roic5yAvgPct),
      zahl: w?.roic5yAvgPct ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'incremental_value_spread',
      label: 'Incremental Value Spread (iROIC − WACC)',
      wert: pctSigned(w?.incrementalValueSpread),
      zahl: w?.incrementalValueSpread ?? null,
      ton:
        w?.incrementalValueSpread == null
          ? undefined
          : w.incrementalValueSpread >= 10
            ? 'positiv'
            : w.incrementalValueSpread >= 0
              ? 'neutral'
              : 'negativ',
      gruppe: 'effizienz',
    },
    {
      id: 'sloan_ratio',
      label: 'Sloan-Ratio (Accruals)',
      wert: w?.sloanRatio != null ? zahl(w.sloanRatio) : '–',
      zahl: w?.sloanRatio ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'beneish_m',
      label: 'Beneish M-Score',
      wert:
        w?.beneishMScore != null
          ? `${zahl(w.beneishMScore)}${w.beneishRisiko ? ` (${w.beneishRisiko})` : ''}`
          : '–',
      zahl: w?.beneishMScore ?? null,
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

  // Yahoo: FY0/FY1-EBITDA (nicht NTM↔FY1 — das ist kein sauberes 1J-Fenster).
  const ebitdaCagr2Yahoo =
    yahoo?.ntmEbitdaUsd != null &&
    yahoo?.fy1EbitdaUsd != null &&
    yahoo.ntmEbitdaUsd > 0 &&
    yahoo.fy1EbitdaUsd > 0
      ? cagrProzent([yahoo.ntmEbitdaUsd, yahoo.fy1EbitdaUsd], 1)
      : null
  const ebitdaCagr2YahooOk =
    ebitdaCagr2Yahoo != null && Math.abs(ebitdaCagr2Yahoo) <= FWD_CAGR_ABS_MAX
      ? ebitdaCagr2Yahoo
      : null
  const ebitdaCagr2Ms = fwdCagrZweiJahre(ebitdaSchaetz0, undefined, jahresKeys, revCagr2)
  // Ohne EBITDA-Consensus: bei stabilen Compoundern ≈ Umsatz-CAGR (besser als „–“).
  const ebitdaCagr2 = ebitdaCagr2YahooOk ?? ebitdaCagr2Ms ?? revCagr2

  out.push(
    {
      id: 'fwd_rev_cagr_2y',
      label: 'Erw. Umsatz-CAGR (2J)',
      wert: pctRaw(revCagr2),
      zahl: revCagr2 ?? null,
      gruppe: 'wachstum',
    },
    {
      id: 'fwd_ebitda_cagr_2y',
      label: 'Erw. EBITDA-CAGR (2J)',
      wert: pctRaw(ebitdaCagr2),
      zahl: ebitdaCagr2 ?? null,
      gruppe: 'wachstum',
    },
    {
      id: 'fwd_eps_cagr_2y',
      label: 'Erw. EPS-CAGR (2J)',
      wert: pctRaw(epsCagr2),
      zahl: epsCagr2 ?? null,
      gruppe: 'wachstum',
    },
    {
      id: 'rev_cagr_3y',
      label: 'Umsatz-CAGR (3J)',
      wert: pctRaw(w?.umsatzCagr3),
      zahl: w?.umsatzCagr3 ?? null,
      gruppe: 'wachstum',
    },
    {
      id: 'rev_cagr_5y',
      label: 'Umsatz-CAGR (5J)',
      wert: pctRaw(w?.umsatzCagr5),
      zahl: w?.umsatzCagr5 ?? null,
      gruppe: 'wachstum',
    },
    {
      id: 'ebitda_cagr_3y',
      label: 'EBITDA-CAGR (3J)',
      wert: pctRaw(w?.ebitdaCagr3),
      zahl: w?.ebitdaCagr3 ?? null,
      gruppe: 'wachstum',
    },
    {
      id: 'eps_cagr_3y',
      label: 'EPS-CAGR (3J)',
      wert: pctRaw(w?.epsCagr3),
      zahl: w?.epsCagr3 ?? null,
      gruppe: 'wachstum',
    },
    {
      id: 'eps_cagr_5y',
      label: 'EPS-CAGR (5J)',
      wert: pctRaw(w?.epsCagr5),
      zahl: w?.epsCagr5 ?? null,
      gruppe: 'wachstum',
    },
    {
      id: 'fcf_je_aktie_cagr_5y',
      label: 'FCF je Aktie CAGR (5J)',
      wert: pctRaw(w?.fcfJeAktieCagr5),
      zahl: w?.fcfJeAktieCagr5 ?? null,
      gruppe: 'wachstum',
    },
  )

  const kgvZeile = roh?.zeilen.find((z) => z.id === 'kgv')
  const psZeile = roh?.zeilen.find((z) => z.id === 'ps')
  const pbZeile = roh?.zeilen.find((z) => z.id === 'pb')
  const pfcfZeile = roh?.zeilen.find((z) => z.id === 'pfcf')
  const evRevZeile = roh?.zeilen.find((z) => z.id === 'ev_rev')
  const evEbitdaZeile = roh?.zeilen.find((z) => z.id === 'ev_ebitda')

  const ltmUmsatzUsd = (() => {
    const mio = ttmOderLetzterFlow(umsatzZeile, perioden)
    return mio != null ? mio * 1_000_000 : null
  })()
  const ltmEvRevenue =
    yahoo?.enterpriseValue != null && ltmUmsatzUsd != null && ltmUmsatzUsd > 0
      ? yahoo.enterpriseValue / ltmUmsatzUsd
      : null

  // Forward = FY-Schätz-Multiple (plausibel vs. Trailing; EU-Schätz-KGV oft Müll)
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

  const ltmKgvFuerFwd =
    yahoo?.trailingPE ?? letzterGeschaeftsjahresWert(kgvZeile, perioden) ?? null
  const fwdKgv = ermittleFwdKgv({
    perioden,
    kgvZeile,
    epsZeile: roh?.zeilen.find((z) => z.id === 'eps'),
    yahooForwardPe: yahoo?.forwardPE,
    yahooPrice: yahoo?.currentPrice,
    yahooFy1Eps: yahoo?.fy1Eps,
    ltmPeFallback: ltmKgvFuerFwd,
  })

  const ltmFcfUsd = (() => {
    const mio = ttmOderLetzterFlow(fcfZeile, perioden)
    return mio != null ? mio * 1_000_000 : null
  })()
  const ltmPfcf =
    yahoo?.marketCap != null && ltmFcfUsd != null && ltmFcfUsd > 0
      ? yahoo.marketCap / ltmFcfUsd
      : letzterGeschaeftsjahresWert(pfcfZeile, perioden)
  const ltmEvEbitda =
    letzterGeschaeftsjahresWert(evEbitdaZeile, perioden) ?? yahoo?.enterpriseToEbitda ?? null
  const ebitdaZeileFuerFwd = roh?.zeilen.find((z) => z.id === 'ebitda')
  const yahooFwdMcFcf =
    yahoo?.marketCap != null && ltmFcfUsd != null && ltmFcfUsd > 0 && yahoo?.revenueGrowth != null
      ? yahoo.marketCap / (ltmFcfUsd * (1 + yahoo.revenueGrowth))
      : null
  const fwdMcFcf = ermittleFwdMultiple({
    fyRoh: fyWert(pfcfZeile),
    ltm: ltmPfcf,
    yahoo: yahooFwdMcFcf,
    histNiveau: letzterGeschaeftsjahresWert(fcfZeile, perioden),
    fyNiveau: ersterFySchaetzWert(fcfZeile, perioden),
    absMax: 800,
  })
  const fwdEvRevenue = ermittleFwdMultiple({
    fyRoh: fyWert(evRevZeile),
    ltm: ltmEvRevenue ?? letzterGeschaeftsjahresWert(evRevZeile, perioden),
    yahoo: yahoo?.enterpriseToRevenue,
    histNiveau: letzterGeschaeftsjahresWert(umsatzZeile, perioden),
    fyNiveau: ersterFySchaetzWert(umsatzZeile, perioden),
    absMax: 200,
  })
  const fwdEvEbitda = ermittleFwdMultiple({
    fyRoh: fyWert(evEbitdaZeile),
    ltm: ltmEvEbitda,
    yahoo: yahoo?.enterpriseToEbitda,
    histNiveau: letzterGeschaeftsjahresWert(ebitdaZeileFuerFwd, perioden),
    fyNiveau: ersterFySchaetzWert(ebitdaZeileFuerFwd, perioden),
    absMax: 500,
  })
  const fyFcfRendite = fcfRenditeAusPfcf(fwdMcFcf)
  const ltmFcfRendite = fcfRenditeAusPfcf(ltmPfcf)
  const divYieldPct =
    w?.divYieldPct ??
    (yahoo?.dividendYield != null && yahoo.dividendYield > 0
      ? yahoo.dividendYield < 0.2
        ? yahoo.dividendYield * 100
        : yahoo.dividendYield
      : null)

  out.push(
    {
      id: 'target_price',
      label: 'Kursziel (Konsens)',
      wert: zahl(yahoo?.targetMeanPrice, ' $'),
      zahl: yahoo?.targetMeanPrice ?? null,
      gruppe: 'bewertung_ntm',
    },
    {
      id: 'ntm_ev_rev',
      label: 'FY EV / Umsatz',
      wert: multiple(fwdEvRevenue),
      zahl: fwdEvRevenue ?? null,
      gruppe: 'bewertung_ntm',
    },
    {
      id: 'ntm_ev_ebitda',
      label: 'FY EV / EBITDA',
      wert: multiple(fwdEvEbitda),
      zahl: fwdEvEbitda ?? null,
      gruppe: 'bewertung_ntm',
    },
    {
      id: 'ntm_pe',
      label: 'FY KGV (P/E)',
      wert: multiple(fwdKgv),
      zahl: fwdKgv ?? null,
      gruppe: 'bewertung_ntm',
    },
    {
      id: 'peg_ratio',
      label: 'PEG (Fwd-KGV / EPS-Wachstum)',
      wert: multiple(w?.pegRatio),
      zahl: w?.pegRatio ?? null,
      gruppe: 'bewertung_ntm',
    },
    {
      id: 'ntm_mc_fcf',
      label: 'FY MC / FCF',
      wert: multiple(fwdMcFcf),
      zahl: fwdMcFcf ?? null,
      gruppe: 'bewertung_ntm',
    },
    {
      id: 'ntm_fcf_rendite',
      label: 'FY FCF-Rendite',
      wert: pctRaw(fyFcfRendite),
      zahl: fyFcfRendite,
      gruppe: 'bewertung_ntm',
    },
    {
      id: 'ltm_ev_rev',
      label: 'LTM EV / Umsatz',
      wert: multiple(ltmEvRevenue),
      zahl: ltmEvRevenue ?? null,
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'ltm_pe',
      label: 'LTM KGV (P/E)',
      wert: multiple(yahoo?.trailingPE ?? letzterGeschaeftsjahresWert(kgvZeile, perioden)),
      zahl: yahoo?.trailingPE ?? letzterGeschaeftsjahresWert(kgvZeile, perioden) ?? null,
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'ltm_pb',
      label: 'LTM KBV (P/B)',
      wert: multiple(letzterGeschaeftsjahresWert(pbZeile, perioden) ?? w?.pb),
      zahl: letzterGeschaeftsjahresWert(pbZeile, perioden) ?? w?.pb ?? null,
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'ltm_ps',
      label: 'LTM KUV (P/S)',
      wert: multiple(letzterGeschaeftsjahresWert(psZeile, perioden)),
      zahl: letzterGeschaeftsjahresWert(psZeile, perioden) ?? null,
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'ltm_pfcf',
      label: 'LTM MC / FCF',
      wert: multiple(ltmPfcf),
      zahl: ltmPfcf ?? null,
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'ltm_fcf_rendite',
      label: 'LTM FCF-Rendite',
      wert: pctRaw(ltmFcfRendite),
      zahl: ltmFcfRendite,
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'div_yield',
      label: 'Dividendenrendite',
      wert: pctRaw(divYieldPct),
      zahl: divYieldPct,
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'payout',
      label: 'Ausschüttungsquote',
      wert: pctRaw(w?.payoutPct),
      zahl: w?.payoutPct ?? null,
      gruppe: 'bewertung_ltm',
    },
    {
      id: 'fcf_conversion',
      label: 'FCF-Conversion (FCF/Nettogewinn)',
      wert: pctRaw(w?.fcfConversion),
      zahl: w?.fcfConversion ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'aktien_verwaesserung',
      label: 'Aktien-Verwässerung p.a.',
      wert: pctMitVorzeichen(w?.aktienVerwaesserungJaehrlichPct),
      zahl: w?.aktienVerwaesserungJaehrlichPct ?? null,
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
      zahl: w?.ruleOf40 ?? null,
      gruppe: 'wachstum',
    },
    {
      id: 'sbc_fcf_ratio',
      label: 'SBC / FCF',
      wert: pctRaw(w?.sbcFcfRatio),
      zahl: w?.sbcFcfRatio ?? null,
      gruppe: 'effizienz',
    },
    {
      id: 'sbc_ocf_ratio',
      label: 'SBC / Operativer Cashflow',
      wert: pctRaw(w?.sbcOcfRatio),
      zahl: w?.sbcOcfRatio ?? null,
      ton:
        w?.sbcOcfRatio == null
          ? undefined
          : w.sbcOcfRatio < 5
            ? 'positiv'
            : w.sbcOcfRatio < 10
              ? 'neutral'
              : 'negativ',
      gruppe: 'effizienz',
    },
    {
      id: 'nrr',
      label: 'NRR (Net Retention)',
      wert: pctRaw(w?.nrrPct),
      zahl: w?.nrrPct ?? null,
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

function cagr5AusPaketZeile(
  zeileId: string,
  historisch: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } | undefined,
): number | null {
  if (!historisch) return null
  const z = historisch.zeilen.find((r) => r.id === zeileId)
  return cagr5AusSerie(historischeWerteAusZeile(z, historisch.perioden))
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
  const rev5 = cagr5AusPaketZeile('umsatz', historisch)
  const eps5 = cagr5AusPaketZeile('eps', historisch)

  const fwdKgv = historisch
    ? ermittleFwdKgv({
        perioden: historisch.perioden,
        kgvZeile: historisch.zeilen.find((z) => z.id === 'kgv'),
        epsZeile: historisch.zeilen.find((z) => z.id === 'eps'),
        ltmPeFallback: kmPctAusMetric(keyMetrics.find((m) => m.id === 'ltm_pe')),
      })
    : null

  const fwdEvRev = historisch
    ? ermittleFwdMultiple({
        fyRoh: ersterFySchaetzWert(
          historisch.zeilen.find((z) => z.id === 'ev_rev'),
          historisch.perioden,
        ),
        ltm:
          kmPctAusMetric(keyMetrics.find((m) => m.id === 'ltm_ev_rev')) ??
          letzterGeschaeftsjahresWert(
            historisch.zeilen.find((z) => z.id === 'ev_rev'),
            historisch.perioden,
          ),
        histNiveau: letzterGeschaeftsjahresWert(
          historisch.zeilen.find((z) => z.id === 'umsatz'),
          historisch.perioden,
        ),
        fyNiveau: ersterFySchaetzWert(
          historisch.zeilen.find((z) => z.id === 'umsatz'),
          historisch.perioden,
        ),
        absMax: 200,
      })
    : null
  const fwdEvEbitda = historisch
    ? ermittleFwdMultiple({
        fyRoh: ersterFySchaetzWert(
          historisch.zeilen.find((z) => z.id === 'ev_ebitda'),
          historisch.perioden,
        ),
        ltm:
          kmPctAusMetric(keyMetrics.find((m) => m.id === 'ltm_ev_ebitda')) ??
          letzterGeschaeftsjahresWert(
            historisch.zeilen.find((z) => z.id === 'ev_ebitda'),
            historisch.perioden,
          ),
        histNiveau: letzterGeschaeftsjahresWert(
          historisch.zeilen.find((z) => z.id === 'ebitda'),
          historisch.perioden,
        ),
        fyNiveau: ersterFySchaetzWert(
          historisch.zeilen.find((z) => z.id === 'ebitda'),
          historisch.perioden,
        ),
        absMax: 500,
      })
    : null
  const fwdMcFcf = historisch
    ? ermittleFwdMultiple({
        fyRoh: ersterFySchaetzWert(
          historisch.zeilen.find((z) => z.id === 'pfcf'),
          historisch.perioden,
        ),
        ltm:
          kmPctAusMetric(keyMetrics.find((m) => m.id === 'ltm_pfcf')) ??
          letzterGeschaeftsjahresWert(
            historisch.zeilen.find((z) => z.id === 'pfcf'),
            historisch.perioden,
          ),
        histNiveau: letzterGeschaeftsjahresWert(
          historisch.zeilen.find((z) => z.id === 'fcf'),
          historisch.perioden,
        ),
        fyNiveau: ersterFySchaetzWert(
          historisch.zeilen.find((z) => z.id === 'fcf'),
          historisch.perioden,
        ),
        absMax: 800,
      })
    : null

  return keyMetrics.map((k) => {
    if (k.id === 'fwd_rev_cagr_2y') return { ...k, wert: pctRaw(rev), zahl: rev }
    if (k.id === 'fwd_eps_cagr_2y') return { ...k, wert: pctRaw(eps), zahl: eps }
    if (k.id === 'fwd_ebitda_cagr_2y') {
      const e = ebitda ?? rev
      return { ...k, wert: pctRaw(e), zahl: e }
    }
    if (k.id === 'rev_cagr_3y' && historisch) return { ...k, wert: pctRaw(rev3), zahl: rev3 }
    if (k.id === 'ebitda_cagr_3y' && historisch) return { ...k, wert: pctRaw(ebitda3), zahl: ebitda3 }
    if (k.id === 'eps_cagr_3y' && historisch) return { ...k, wert: pctRaw(eps3), zahl: eps3 }
    if (k.id === 'rev_cagr_5y' && historisch) return { ...k, wert: pctRaw(rev5), zahl: rev5 }
    if (k.id === 'eps_cagr_5y' && historisch) return { ...k, wert: pctRaw(eps5), zahl: eps5 }
    if (k.id === 'ntm_pe' && fwdKgv != null) {
      return { ...k, wert: multiple(fwdKgv), zahl: fwdKgv }
    }
    if (k.id === 'ntm_ev_rev' && fwdEvRev != null) {
      return { ...k, wert: multiple(fwdEvRev), zahl: fwdEvRev }
    }
    if (k.id === 'ntm_ev_ebitda' && fwdEvEbitda != null) {
      return { ...k, wert: multiple(fwdEvEbitda), zahl: fwdEvEbitda }
    }
    if (k.id === 'ntm_mc_fcf' && fwdMcFcf != null) {
      return { ...k, wert: multiple(fwdMcFcf), zahl: fwdMcFcf }
    }
    if (k.id === 'ltm_ev_rev' || k.id === 'ltm_ev_ebitda' || k.id === 'ltm_pfcf') {
      const z = k.zahl ?? kmPctAusMetric(k)
      return z != null ? { ...k, zahl: z } : k
    }
    return k
  })
}

/** Prozent-Kennzahl aus `zahl` oder Anzeige-String („26,4 %“ / „−1,2 %“ / „(1,2 %)“). */
function kmPctAusMetric(m: FundamentalKeyMetric | undefined): number | null {
  if (!m) return null
  if (m.zahl != null && Number.isFinite(m.zahl)) return m.zahl
  // lazy: vermeidet Zirkel-Import; gleiche Regeln wie titel-vergleich-parse
  const roh = m.wert?.trim()
  if (!roh || roh === '–' || roh === '-' || roh === '—') return null
  let t = roh.replace(/\s*(Pp\.|pp\.|✓|⚠).*$/i, '')
  const inKlammern = /^\(.*\)$/.test(t.replace(/\s/g, ''))
  t = t
    .replace(/[()]/g, '')
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\./g, '')
    .replace(',', '.')
  const mSign = t.match(/^([+-]?)(.*)$/)
  if (!mSign) return null
  const body = (mSign[2] ?? '').replace(/[^\d.]/g, '')
  if (!body) return null
  let n = Number(`${mSign[1] ?? ''}${body}`)
  if (!Number.isFinite(n)) return null
  if (inKlammern && n > 0) n = -n
  return n
}

/**
 * Effizienz-Kennzahlen aus GuV/Bilanz neu ableiten (Cache-Read).
 * Behebt Schein-Bruttomarge 100 %, ROIC≈ROE und unsinniges ROIC-ex-Goodwill
 * ohne erneuten Macrotrends-Scrape — gilt für alle Titel.
 */
export function korrigiereEffizienzKeyMetrics(
  keyMetrics: FundamentalKeyMetric[],
  historisch: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
  kontextWerte: FundamentalKontextWerte | null,
): FundamentalKeyMetric[] {
  if (!kontextWerte) return keyMetrics
  const w = kontextWerte
  const roiicKm = keyMetrics.find((m) => m.id === 'incremental_roic')?.zahl ?? null
  const roicKm =
    w.roicAnzeige ??
    w.roic ??
    w.roicExGoodwill ??
    kmPctAusMetric(keyMetrics.find((m) => m.id === 'ltm_roic')) ??
    kmPctAusMetric(keyMetrics.find((m) => m.id === 'ltm_roic_ex_gw'))
  const waccKm = w.wacc ?? kmPctAusMetric(keyMetrics.find((m) => m.id === 'wacc'))
  const valueSpreadKm =
    roicKm != null && waccKm != null
      ? Math.round((roicKm - waccKm) * 100) / 100
      : (w.valueSpread ?? null)
  const iSpreadAnzeige = (zahl: number | null | undefined) => ({
    wert: pctSigned(zahl),
    zahl: zahl ?? null,
    ton:
      zahl == null
        ? undefined
        : zahl >= 10
          ? ('positiv' as const)
          : zahl >= 0
            ? ('neutral' as const)
            : ('negativ' as const),
  })
  const regime =
    w.incrementalRoicRegime ??
    (/NOPAT rückläufig/i.test(keyMetrics.find((m) => m.id === 'incremental_roic')?.wert ?? '')
      ? 'schrumpfend'
      : /kapitalleicht/i.test(keyMetrics.find((m) => m.id === 'incremental_roic')?.wert ?? '')
        ? 'kapitalleicht'
        : null)
  const roiicFuerSpread =
    regime === 'schrumpfend' || regime === 'unzureichend'
      ? null
      : (w.incrementalRoicPct ?? roiicKm)
  const incrementalSpread =
    w.incrementalValueSpread ??
    berechneIncrementalValueSpread({
      incrementalRoicPct: roiicFuerSpread,
      wacc: waccKm,
      roicAnzeige: roicKm,
      valueSpread: valueSpreadKm,
      incrementalRoicRegime: regime,
    })
  const roiicKontext = {
    incrementalRoicPct: roiicFuerSpread ?? w.incrementalRoicPct,
    incrementalRoicRegime: regime ?? w.incrementalRoicRegime,
    incrementalRoicBuchPct: w.incrementalRoicBuchPct,
  }
  let out: FundamentalKeyMetric[] = keyMetrics.map((k): FundamentalKeyMetric => {
    if (k.id === 'ltm_brutto') {
      return {
        ...k,
        wert: w.bruttoMargeSchein ? '– (kein COGS)' : pctRaw(w.bruttoMarge),
      }
    }
    if (k.id === 'brutto_std_10y') {
      return {
        ...k,
        wert: w.bruttoMargeSchein
          ? '–'
          : w.bruttoMargeStd10y != null
            ? `${zahl(w.bruttoMargeStd10y)} Pp.${w.pricingPowerOk === false ? ' ⚠' : w.pricingPowerOk ? ' ✓' : ''}`
            : '–',
      }
    }
    if (k.id === 'ltm_ebit') return { ...k, wert: pctRaw(w.ebitMarge) }
    if (k.id === 'ltm_roa') return { ...k, wert: pctRaw(w.roa) }
    if (k.id === 'ltm_roe') return { ...k, wert: pctRaw(w.roe) }
    if (k.id === 'ltm_roic') {
      const roic = w.roicAnzeige ?? w.roic ?? w.roicExGoodwill
      return { ...k, wert: pctRaw(roic), zahl: roic ?? k.zahl ?? null }
    }
    if (k.id === 'ltm_roic_ex_gw') return { ...k, wert: pctRaw(w.roicExGoodwill) }
    if (k.id === 'wacc') {
      if (waccKm == null) return k
      return { ...k, wert: pctRaw(waccKm), zahl: waccKm }
    }
    if (k.id === 'net_debt_ebitda') {
      const v = w.netDebtEbitda
      return {
        ...k,
        wert: v != null ? (v < 0 ? `(${multiple(Math.abs(v))})` : multiple(v)) : '–',
      }
    }
    if (k.id === 'net_debt_fcf') {
      const v = w.netDebtFcf
      return {
        ...k,
        wert: v != null ? (v < 0 ? `(${multiple(Math.abs(v))})` : multiple(v)) : '–',
      }
    }
    if (k.id === 'umsatz_cagr_3y') return { ...k, wert: pctRaw(w.umsatzCagr3), zahl: w.umsatzCagr3 ?? null }
    if (k.id === 'umsatz_cagr_5y') return { ...k, wert: pctRaw(w.umsatzCagr5), zahl: w.umsatzCagr5 ?? null }
    if (k.id === 'eps_cagr_3y') return { ...k, wert: pctRaw(w.epsCagr3), zahl: w.epsCagr3 ?? null }
    if (k.id === 'eps_cagr_5y') return { ...k, wert: pctRaw(w.epsCagr5), zahl: w.epsCagr5 ?? null }
    if (k.id === 'ltm_value_spread') {
      const spread = valueSpreadKm ?? kmPctAusMetric(k)
      return {
        ...k,
        wert: pctSigned(spread),
        zahl: spread,
        ton: spread == null ? undefined : spread >= 0 ? 'positiv' : 'negativ',
      }
    }
    if (k.id === 'sloan_ratio') {
      return {
        ...k,
        wert: w.sloanRatio != null ? zahl(w.sloanRatio) : '–',
        zahl: w.sloanRatio ?? null,
      }
    }
    if (k.id === 'beneish_m') {
      return {
        ...k,
        wert:
          w.beneishMScore != null
            ? `${zahl(w.beneishMScore)}${w.beneishRisiko ? ` (${w.beneishRisiko})` : ''}`
            : '–',
        zahl: w.beneishMScore ?? null,
      }
    }
    if (k.id === 'incremental_roic') {
      return {
        ...k,
        wert: roiicAnzeige(roiicKontext),
        zahl:
          regime === 'schrumpfend' &&
          (roiicFuerSpread == null || roiicFuerSpread === 0)
            ? null
            : (roiicFuerSpread ?? k.zahl ?? null),
      }
    }
    if (k.id === 'reinvest_quote') {
      return {
        ...k,
        wert: pctMitVorzeichen(w.reinvestitionsquotePct),
        zahl: w.reinvestitionsquotePct ?? k.zahl ?? null,
      }
    }
    if (k.id === 'div_yield') {
      const z = w.divYieldPct ?? kmPctAusMetric(k)
      return z != null ? { ...k, wert: pctRaw(z), zahl: z } : k
    }
    if (k.id === 'aktien_verwaesserung') {
      const v = w.aktienVerwaesserungJaehrlichPct
      if (v == null) return k
      return {
        ...k,
        wert: pctMitVorzeichen(v),
        zahl: v,
        ton: v <= 0 ? 'positiv' : v >= 1.5 ? 'negativ' : 'neutral',
      }
    }
    if (k.id === 'fcf_conversion') {
      return { ...k, wert: pctRaw(w.fcfConversion), zahl: w.fcfConversion ?? k.zahl ?? null }
    }
    if (k.id === 'rule_of_40') {
      if (w.ruleOf40 == null) return k
      return { ...k, wert: zahl(w.ruleOf40), zahl: w.ruleOf40 }
    }
    if (k.id === 'roic_5y_avg') return { ...k, wert: pctRaw(w.roic5yAvgPct), zahl: w.roic5yAvgPct ?? null }
    if (k.id === 'incremental_value_spread') {
      return { ...k, ...iSpreadAnzeige(incrementalSpread) }
    }
    if (k.id === 'sbc_ocf_ratio') {
      return {
        ...k,
        wert: pctRaw(w.sbcOcfRatio),
        zahl: w.sbcOcfRatio ?? null,
        ton:
          w.sbcOcfRatio == null
            ? undefined
            : w.sbcOcfRatio < 5
              ? 'positiv'
              : w.sbcOcfRatio < 10
                ? 'neutral'
                : 'negativ',
      }
    }
    if (k.id === 'rev_cagr_5y') return { ...k, wert: pctRaw(w.umsatzCagr5), zahl: w.umsatzCagr5 ?? null }
    if (k.id === 'eps_cagr_5y') return { ...k, wert: pctRaw(w.epsCagr5), zahl: w.epsCagr5 ?? null }
    if (k.id === 'fcf_je_aktie_cagr_5y') {
      return { ...k, wert: pctRaw(w.fcfJeAktieCagr5), zahl: w.fcfJeAktieCagr5 ?? null }
    }
    if (k.id === 'ntm_pe' || k.id === 'ltm_pe') {
      const z = k.zahl ?? kmPctAusMetric(k)
      return z != null ? { ...k, zahl: z } : k
    }
    return k
  })

  // PEG aus FY-KGV + Fwd-/Hist-Wachstum neu (stale Cache z. B. 0,06× bei negativem EPS-CAGR).
  {
    const ntmPe = kmPctAusMetric(out.find((m) => m.id === 'ntm_pe'))
    const fwdG = kmPctAusMetric(out.find((m) => m.id === 'fwd_eps_cagr_2y'))
    const histG = w.epsCagr3 ?? kmPctAusMetric(out.find((m) => m.id === 'eps_cagr_3y'))
    const growth = waehlePegWachstumPct({
      fwdEpsCagr2: fwdG,
      epsCagr3: histG,
      yahooEpsPct: null,
    })
    const peg = berechnePegRatio(ntmPe, growth, null)
    out = upsertNach(
      out,
      {
        id: 'peg_ratio',
        label: 'PEG (Fwd-KGV / EPS-Wachstum)',
        wert: multiple(peg),
        zahl: peg,
        gruppe: 'bewertung_ntm',
      },
      'ntm_pe',
    )
  }

  // Ältere Caches ohne WACC-Zeile: Kennzahl einfügen (nicht nur updaten).
  if (waccKm != null) {
    out = upsertNach(
      out,
      {
        id: 'wacc',
        label: 'WACC (geschätzt, CAPM)',
        wert: pctRaw(waccKm),
        zahl: waccKm,
        gruppe: 'effizienz',
      },
      'ltm_roic_ex_gw',
    )
  }
  if (valueSpreadKm != null) {
    out = upsertNach(
      out,
      {
        id: 'ltm_value_spread',
        label: 'Value Spread (ROIC − WACC)',
        wert: pctSigned(valueSpreadKm),
        zahl: valueSpreadKm,
        ton: valueSpreadKm >= 0 ? 'positiv' : 'negativ',
        gruppe: 'effizienz',
      },
      'wacc',
    )
  }
  out = upsertNach(
    out,
    {
      id: 'roic_5y_avg',
      label: 'Hist. ROIC (5J-Schnitt)',
      wert: pctRaw(w.roic5yAvgPct),
      zahl: w.roic5yAvgPct ?? null,
      gruppe: 'effizienz',
    },
    'incremental_roic',
  )
  out = upsertNach(
    out,
    {
      id: 'incremental_value_spread',
      label: 'Incremental Value Spread (iROIC − WACC)',
      gruppe: 'effizienz',
      ...iSpreadAnzeige(incrementalSpread),
    },
    'roic_5y_avg',
  )
  out = upsertNach(
    out,
    {
      id: 'sbc_ocf_ratio',
      label: 'SBC / Operativer Cashflow',
      wert: pctRaw(w.sbcOcfRatio),
      zahl: w.sbcOcfRatio ?? null,
      ton:
        w.sbcOcfRatio == null
          ? undefined
          : w.sbcOcfRatio < 5
            ? 'positiv'
            : w.sbcOcfRatio < 10
              ? 'neutral'
              : 'negativ',
      gruppe: 'effizienz',
    },
    'sbc_fcf_ratio',
  )
  out = upsertNach(
    out,
    {
      id: 'rev_cagr_5y',
      label: 'Umsatz-CAGR (5J)',
      wert: pctRaw(w.umsatzCagr5),
      zahl: w.umsatzCagr5 ?? null,
      gruppe: 'wachstum',
    },
    'rev_cagr_3y',
  )
  out = upsertNach(
    out,
    {
      id: 'eps_cagr_5y',
      label: 'EPS-CAGR (5J)',
      wert: pctRaw(w.epsCagr5),
      zahl: w.epsCagr5 ?? null,
      gruppe: 'wachstum',
    },
    'eps_cagr_3y',
  )
  out = upsertNach(
    out,
    {
      id: 'fcf_je_aktie_cagr_5y',
      label: 'FCF je Aktie CAGR (5J)',
      wert: pctRaw(w.fcfJeAktieCagr5),
      zahl: w.fcfJeAktieCagr5 ?? null,
      gruppe: 'wachstum',
    },
    'eps_cagr_5y',
  )
  return out
}

function upsertNach(
  liste: FundamentalKeyMetric[],
  neu: FundamentalKeyMetric,
  nachId: string,
): FundamentalKeyMetric[] {
  const i = liste.findIndex((k) => k.id === neu.id)
  if (i >= 0) {
    const out = [...liste]
    out[i] = { ...out[i]!, ...neu }
    return out
  }
  const j = liste.findIndex((k) => k.id === nachId)
  const out = [...liste]
  if (j >= 0) out.splice(j + 1, 0, neu)
  else out.push(neu)
  return out
}

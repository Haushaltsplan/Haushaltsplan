import {
  cagrProzent,
  formatFundamentalWert,
} from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { FundamentalSchaetzungenRoh } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import type {
  FundamentalKeyMetric,
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { FundamentalKontextWerte } from '@/lib/portfolio-analyse/fundamentaldaten-kontext-werte'
import type { MacrotrendsFundamentalRoh } from '@/lib/portfolio-analyse/macrotrends-scraper-server'

export type YahooFundamentalKennzahlen = {
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  beta?: number
  marketCap?: number
  sharesOutstanding?: number
  floatShares?: number
  enterpriseValue?: number
  trailingPE?: number
  forwardPE?: number
  dividendYield?: number
  payoutRatio?: number
  returnOnEquity?: number
  returnOnAssets?: number
  revenueGrowth?: number
  earningsGrowth?: number
  grossMargins?: number
  operatingMargins?: number
  ebitdaMargins?: number
  currentPrice?: number
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

export function baueKeyMetrics(
  yahoo: YahooFundamentalKennzahlen | null,
  roh: MacrotrendsFundamentalRoh | null,
  schaetzungen: FundamentalSchaetzungenRoh,
  kontextWerte: FundamentalKontextWerte | null,
): FundamentalKeyMetric[] {
  const out: FundamentalKeyMetric[] = []
  const perioden = roh?.perioden
  const w = kontextWerte

  const floatPct =
    yahoo?.floatShares != null && yahoo?.sharesOutstanding != null && yahoo.sharesOutstanding > 0
      ? (yahoo.floatShares / yahoo.sharesOutstanding) * 100
      : null

  const volMio = yahoo?.averageVolume != null ? yahoo.averageVolume / 1_000_000 : null

  out.push(
    { id: '52w_hoch', label: '52-Wochen-Hoch', wert: zahl(yahoo?.fiftyTwoWeekHigh, ' $'), gruppe: 'marktdaten' },
    { id: '52w_tief', label: '52-Wochen-Tief', wert: zahl(yahoo?.fiftyTwoWeekLow, ' $'), gruppe: 'marktdaten' },
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
      label: 'LTM ROIC (adjustiert)',
      wert: pctRaw(w?.roicAdjustiert ?? w?.roic),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roic_roh',
      label: 'LTM ROIC (unadjustiert)',
      wert: pctRaw(w?.roic),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roce',
      label: 'LTM ROCE',
      wert: pctRaw(w?.roic),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roiic',
      label: 'LTM ROIIC',
      wert: pctRaw(w?.roiic),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_value_spread',
      label: 'Value Spread (ROIC − WACC)',
      wert: pctSigned(w?.valueSpread),
      gruppe: 'effizienz',
    },
  )

  const umsatzSchaetz0 = schaetzungen.zeilen.find((z) => z.id === 'umsatz_schaetzung')
  const epsSchaetz0 = schaetzungen.zeilen.find((z) => z.id === 'eps_schaetzung')
  const fy0Key = schaetzungen.perioden[0]?.iso
  const fy1Key = schaetzungen.perioden[1]?.iso

  const revCagr2 =
    fy0Key && fy1Key && umsatzSchaetz0
      ? cagrProzent(
          [wertAnPeriode(umsatzSchaetz0, fy0Key), wertAnPeriode(umsatzSchaetz0, fy1Key)].filter(
            (v): v is number => v != null && v > 0,
          ),
          1,
        )
      : null

  const epsCagr2 =
    fy0Key && fy1Key && epsSchaetz0
      ? cagrProzent(
          [wertAnPeriode(epsSchaetz0, fy0Key), wertAnPeriode(epsSchaetz0, fy1Key)].filter(
            (v): v is number => v != null && v > 0,
          ),
          1,
        )
      : null

  const ebitdaCagr2 =
    yahoo?.ntmEbitdaUsd != null && yahoo?.fy1EbitdaUsd != null && yahoo.ntmEbitdaUsd > 0 && yahoo.fy1EbitdaUsd > 0
      ? cagrProzent([yahoo.ntmEbitdaUsd, yahoo.fy1EbitdaUsd], 1)
      : null

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

  const ltmUmsatzUsd =
    letzterGeschaeftsjahresWert(umsatzZeile, perioden) != null
      ? letzterGeschaeftsjahresWert(umsatzZeile, perioden)! * 1_000_000
      : null
  const ltmEvRevenue =
    yahoo?.enterpriseValue != null && ltmUmsatzUsd != null && ltmUmsatzUsd > 0
      ? yahoo.enterpriseValue / ltmUmsatzUsd
      : null

  const ntmKgv =
    yahoo?.forwardPE ??
    (yahoo?.currentPrice != null && yahoo?.ntmEpsSchaetzung != null && yahoo.ntmEpsSchaetzung > 0
      ? yahoo.currentPrice / yahoo.ntmEpsSchaetzung
      : null)

  const ltmFcfUsd =
    letzterGeschaeftsjahresWert(fcfZeile, perioden) != null
      ? letzterGeschaeftsjahresWert(fcfZeile, perioden)! * 1_000_000
      : null
  const ntmFcfUsd =
    ltmFcfUsd != null && yahoo?.revenueGrowth != null ? ltmFcfUsd * (1 + yahoo.revenueGrowth) : ltmFcfUsd
  const ntmMcFcf =
    yahoo?.marketCap != null && ntmFcfUsd != null && ntmFcfUsd > 0 ? yahoo.marketCap / ntmFcfUsd : null

  const ntmEvRevenue =
    yahoo?.enterpriseToRevenue ??
    (yahoo?.enterpriseValue != null && yahoo?.ntmRevenueUsd != null && yahoo.ntmRevenueUsd > 0
      ? yahoo.enterpriseValue / yahoo.ntmRevenueUsd
      : null)
  const ntmEvEbitda =
    yahoo?.enterpriseToEbitda ??
    (yahoo?.enterpriseValue != null && yahoo?.ntmEbitdaUsd != null && yahoo.ntmEbitdaUsd > 0
      ? yahoo.enterpriseValue / yahoo.ntmEbitdaUsd
      : null)

  out.push(
    {
      id: 'target_price',
      label: 'Kursziel (Konsens)',
      wert: zahl(yahoo?.targetMeanPrice, ' $'),
      gruppe: 'bewertung_ntm',
    },
    { id: 'ntm_ev_rev', label: 'NTM EV / Umsatz', wert: multiple(ntmEvRevenue), gruppe: 'bewertung_ntm' },
    { id: 'ntm_ev_ebitda', label: 'NTM EV / EBITDA', wert: multiple(ntmEvEbitda), gruppe: 'bewertung_ntm' },
    { id: 'ntm_pe', label: 'NTM KGV (P/E)', wert: multiple(ntmKgv), gruppe: 'bewertung_ntm' },
    { id: 'ntm_mc_fcf', label: 'NTM MC / FCF', wert: multiple(ntmMcFcf), gruppe: 'bewertung_ntm' },
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
    { id: 'div_yield', label: 'Dividendenrendite', wert: yahoo?.dividendYield != null ? pctRaw(yahoo.dividendYield * 100) : '–', gruppe: 'bewertung_ltm' },
    {
      id: 'payout',
      label: 'Ausschüttungsquote',
      wert: pctRaw(w?.payoutPct),
      gruppe: 'bewertung_ltm',
    },
  )

  return out
}

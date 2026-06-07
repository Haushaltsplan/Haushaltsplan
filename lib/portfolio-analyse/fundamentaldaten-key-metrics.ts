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
import { FUNDAMENTAL_FY0E_KEY, FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { MacrotrendsFundamentalRoh } from '@/lib/portfolio-analyse/macrotrends-scraper-server'

export type YahooFundamentalKennzahlen = {
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  beta?: number
  marketCap?: number
  sharesOutstanding?: number
  enterpriseValue?: number
  trailingPE?: number
  forwardPE?: number
  dividendYield?: number
  returnOnEquity?: number
  returnOnAssets?: number
  revenueGrowth?: number
  earningsGrowth?: number
  grossMargins?: number
  operatingMargins?: number
  ebitdaMargins?: number
  profitMargins?: number
  currentPrice?: number
  priceToBook?: number
  enterpriseToRevenue?: number
  enterpriseToEbitda?: number
  totalDebt?: number
  totalCash?: number
  /** Berechnet: Kurs / erwartetes EPS (FY0-Schätzung) */
  ntmEpsSchaetzung?: number
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

function berechneMargePct(zaehler: number | null, nenner: number | null): number | null {
  if (zaehler == null || nenner == null || nenner === 0) return null
  return (zaehler / nenner) * 100
}

function ttmOderBerechnet(
  ratioZeile: FundamentalMetrikZeile | undefined,
  zaehlerZeile: FundamentalMetrikZeile | undefined,
  nennerZeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
  yahooDezimal?: number,
): number | null {
  const ausRatio = letzterGeschaeftsjahresWert(ratioZeile, perioden)
  if (ausRatio != null) return ausRatio
  const marge = berechneMargePct(
    letzterGeschaeftsjahresWert(zaehlerZeile, perioden),
    letzterGeschaeftsjahresWert(nennerZeile, perioden),
  )
  if (marge != null) return marge
  if (yahooDezimal != null) return yahooDezimal * 100
  return null
}

export function baueKeyMetrics(
  yahoo: YahooFundamentalKennzahlen | null,
  roh: MacrotrendsFundamentalRoh | null,
  schaetzungen: FundamentalSchaetzungenRoh,
): FundamentalKeyMetric[] {
  const out: FundamentalKeyMetric[] = []
  const perioden = roh?.perioden
  const zahl = (v?: number | null, suffix = '') =>
    v != null && Number.isFinite(v) ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })}${suffix}` : '–'
  const pctDezimal = (v?: number | null) => {
    if (v == null || !Number.isFinite(v)) return '–'
    return `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`
  }
  const pctRaw = (v?: number | null) =>
    v != null && Number.isFinite(v) ? formatFundamentalWert(v, 'prozent') : '–'

  out.push(
    { id: '52w_hoch', label: '52-Wochen-Hoch', wert: zahl(yahoo?.fiftyTwoWeekHigh, ' $'), gruppe: 'marktdaten' },
    { id: '52w_tief', label: '52-Wochen-Tief', wert: zahl(yahoo?.fiftyTwoWeekLow, ' $'), gruppe: 'marktdaten' },
    { id: 'beta', label: '5-Jahres-Beta', wert: zahl(yahoo?.beta), gruppe: 'marktdaten' },
    {
      id: 'kurs',
      label: 'Aktueller Kurs',
      wert: zahl(yahoo?.currentPrice, ' $'),
      gruppe: 'marktdaten',
    },
  )

  const netDebt =
    yahoo?.totalDebt != null && yahoo?.totalCash != null ? yahoo.totalDebt - yahoo.totalCash : null

  out.push(
    {
      id: 'market_cap',
      label: 'Marktkapitalisierung',
      wert: formatFundamentalWert(yahoo?.marketCap ?? null, 'waehrung_usd'),
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'enterprise_value',
      label: 'Enterprise Value (EV)',
      wert: formatFundamentalWert(yahoo?.enterpriseValue ?? null, 'waehrung_usd'),
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'net_debt',
      label: 'Nettoverschuldung (LTM)',
      wert: formatFundamentalWert(netDebt, 'waehrung_usd'),
      gruppe: 'kapitalstruktur',
    },
    {
      id: 'shares_out',
      label: 'Ausstehende Aktien',
      wert: yahoo?.sharesOutstanding != null ? yahoo.sharesOutstanding.toLocaleString('de-DE') : '–',
      gruppe: 'kapitalstruktur',
    },
  )

  const bruttoZeile = roh?.zeilen.find((z) => z.id === 'bruttomarge')
  const ebitdaZeile = roh?.zeilen.find((z) => z.id === 'ebitda_marge')
  const ebitZeile = roh?.zeilen.find((z) => z.id === 'ebit_marge')
  const roeZeile = roh?.zeilen.find((z) => z.id === 'roe')
  const roaZeile = roh?.zeilen.find((z) => z.id === 'roa')
  const roiZeile = roh?.zeilen.find((z) => z.id === 'roi')
  const umsatzZeile = roh?.zeilen.find((z) => z.id === 'umsatz')
  const bruttoGewinnZeile = roh?.zeilen.find((z) => z.id === 'bruttogewinn')
  const ebitdaGuV = roh?.zeilen.find((z) => z.id === 'ebitda')
  const ebitGuV = roh?.zeilen.find((z) => z.id === 'ebit')

  out.push(
    {
      id: 'ltm_brutto',
      label: 'TTM Bruttomarge',
      wert: pctRaw(
        ttmOderBerechnet(bruttoZeile, bruttoGewinnZeile, umsatzZeile, perioden, yahoo?.grossMargins),
      ),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_ebit',
      label: 'TTM EBIT-Marge',
      wert: pctRaw(ttmOderBerechnet(ebitZeile, ebitGuV, umsatzZeile, perioden, yahoo?.operatingMargins)),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_ebitda',
      label: 'TTM EBITDA-Marge',
      wert: pctRaw(ttmOderBerechnet(ebitdaZeile, ebitdaGuV, umsatzZeile, perioden, yahoo?.ebitdaMargins)),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roa',
      label: 'TTM ROA',
      wert: pctRaw(
        letzterGeschaeftsjahresWert(roaZeile, perioden) ??
          (yahoo?.returnOnAssets != null ? yahoo.returnOnAssets * 100 : null),
      ),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roe',
      label: 'TTM ROE',
      wert: pctRaw(
        letzterGeschaeftsjahresWert(roeZeile, perioden) ??
          (yahoo?.returnOnEquity != null ? yahoo.returnOnEquity * 100 : null),
      ),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roi',
      label: 'TTM ROI',
      wert: pctRaw(letzterGeschaeftsjahresWert(roiZeile, perioden)),
      gruppe: 'effizienz',
    },
  )

  const epsSchaetz0 = schaetzungen.zeilen.find((z) => z.id === 'eps_schaetzung')
  const umsatzSchaetz0 = schaetzungen.zeilen.find((z) => z.id === 'umsatz_schaetzung')
  const umsatzWachstum0 = schaetzungen.zeilen.find((z) => z.id === 'umsatz_wachstum_schaetzung')
  const epsWachstum0 = schaetzungen.zeilen.find((z) => z.id === 'eps_wachstum_schaetzung')
  const fy0Key = schaetzungen.perioden[0]?.iso
  const fy1Key = schaetzungen.perioden[1]?.iso

  const fyKeys = perioden?.filter((p) => !p.istLtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  const umsatzHistorie = fyKeys.map((k) => umsatzZeile?.werte[k]).filter((v): v is number => v != null)
  const umsatzCagr3 = umsatzHistorie.length >= 2 ? cagrProzent(umsatzHistorie.slice(-4), 3) : null

  out.push(
    {
      id: 'fwd_umsatz',
      label: 'Erw. Umsatz (FY)',
      wert: fy0Key
        ? formatFundamentalWert(wertAnPeriode(umsatzSchaetz0, fy0Key), 'waehrung_usd_mio')
        : '–',
      gruppe: 'wachstum',
    },
    {
      id: 'fwd_eps',
      label: 'Erw. EPS (FY)',
      wert: fy0Key ? formatFundamentalWert(wertAnPeriode(epsSchaetz0, fy0Key), 'waehrung_usd_aktie') : '–',
      gruppe: 'wachstum',
    },
    {
      id: 'fwd_umsatz_wachstum',
      label: 'Erw. Umsatz-Wachstum',
      wert: pctRaw(
        wertAnPeriode(umsatzWachstum0, FUNDAMENTAL_FY0E_KEY) ??
          (yahoo?.revenueGrowth != null ? yahoo.revenueGrowth * 100 : null),
      ),
      gruppe: 'wachstum',
    },
    {
      id: 'fwd_eps_wachstum',
      label: 'Erw. EPS-Wachstum',
      wert: pctRaw(
        wertAnPeriode(epsWachstum0, FUNDAMENTAL_FY0E_KEY) ??
          (yahoo?.earningsGrowth != null ? yahoo.earningsGrowth * 100 : null),
      ),
      gruppe: 'wachstum',
    },
    {
      id: 'fwd_umsatz_cagr',
      label: 'Erw. Umsatz-CAGR (2J)',
      wert:
        fy0Key && fy1Key && umsatzSchaetz0
          ? (() => {
              const u0 = wertAnPeriode(umsatzSchaetz0, fy0Key)
              const u1 = wertAnPeriode(umsatzSchaetz0, fy1Key)
              if (u0 == null || u1 == null || u0 <= 0) return '–'
              const c = cagrProzent([u0, u1], 1)
              return c != null ? formatFundamentalWert(c, 'prozent') : '–'
            })()
          : '–',
      gruppe: 'wachstum',
    },
    {
      id: 'umsatz_cagr_3j',
      label: 'Umsatz-CAGR (3 Jahre)',
      wert: umsatzCagr3 != null ? formatFundamentalWert(umsatzCagr3, 'prozent') : '–',
      gruppe: 'wachstum',
    },
  )

  const kgvZeile = roh?.zeilen.find((z) => z.id === 'kgv')
  const psZeile = roh?.zeilen.find((z) => z.id === 'ps')
  const pbZeile = roh?.zeilen.find((z) => z.id === 'pb')
  const pfcfZeile = roh?.zeilen.find((z) => z.id === 'pfcf')

  const ntmKgvBerechnet =
    yahoo?.currentPrice != null && yahoo?.ntmEpsSchaetzung != null && yahoo.ntmEpsSchaetzung > 0
      ? yahoo.currentPrice / yahoo.ntmEpsSchaetzung
      : null

  out.push(
    {
      id: 'fwd_kgv_ntm',
      label: 'KGV Forward (NTM)',
      wert: zahl(yahoo?.forwardPE ?? ntmKgvBerechnet, 'x'),
      gruppe: 'bewertung',
    },
    {
      id: 'ntm_kgv_berechnet',
      label: 'KGV NTM (Kurs / Erw. EPS)',
      wert: zahl(ntmKgvBerechnet ?? yahoo?.forwardPE, 'x'),
      gruppe: 'bewertung',
    },
    {
      id: 'trailing_kgv',
      label: 'KGV Trailing (TTM)',
      wert: zahl(
        yahoo?.trailingPE ?? letzterGeschaeftsjahresWert(kgvZeile, perioden),
        'x',
      ),
      gruppe: 'bewertung',
    },
    {
      id: 'ltm_ps',
      label: 'KUV (P/S, TTM)',
      wert: formatFundamentalWert(letzterGeschaeftsjahresWert(psZeile, perioden), 'multiple'),
      gruppe: 'bewertung',
    },
    {
      id: 'ltm_pb',
      label: 'KBV (P/B, TTM)',
      wert: formatFundamentalWert(
        letzterGeschaeftsjahresWert(pbZeile, perioden) ?? yahoo?.priceToBook ?? null,
        'multiple',
      ),
      gruppe: 'bewertung',
    },
    {
      id: 'ltm_pfcf',
      label: 'Kurs/FCF (TTM)',
      wert: formatFundamentalWert(letzterGeschaeftsjahresWert(pfcfZeile, perioden), 'multiple'),
      gruppe: 'bewertung',
    },
    {
      id: 'ev_revenue',
      label: 'EV / Umsatz (NTM)',
      wert: zahl(yahoo?.enterpriseToRevenue, 'x'),
      gruppe: 'bewertung',
    },
    {
      id: 'ev_ebitda',
      label: 'EV / EBITDA (NTM)',
      wert: zahl(yahoo?.enterpriseToEbitda, 'x'),
      gruppe: 'bewertung',
    },
    { id: 'div_yield', label: 'Dividendenrendite', wert: pctDezimal(yahoo?.dividendYield), gruppe: 'bewertung' },
  )

  return out
}

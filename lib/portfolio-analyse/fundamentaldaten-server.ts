import 'server-only'

import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  cagrProzent,
  formatFundamentalWert,
} from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { ladeFundamentalSchaetzungen } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import {
  formatiereBrancheDe,
  ladeUnternehmensbeschreibungDe,
} from '@/lib/portfolio-analyse/fundamentaldaten-unternehmen-de'
import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
  FundamentalKeyMetric,
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeMacrotrendsFundamentaldaten,
  loeseMacrotrendsIdent,
  macrotrendsTickerAusSymbol,
  type MacrotrendsIdent,
} from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import { holeYahooFinanceAuth } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

function symboleAusAnfrage(anfrage: FundamentaldatenAnfrage): string[] {
  const out = new Set<string>()
  const add = (s?: string | null) => {
    for (const t of brokerSymbolKandidaten(s ?? '')) out.add(t)
  }
  add(anfrage.symbolYahoo)
  for (const s of anfrage.symbolCandidates ?? []) add(s)
  const isin = anfrage.isin?.trim().toUpperCase()
  if (isin) {
    const k = isinKenntnis(isin)
    add(k?.symbolYahoo)
    for (const s of k?.symbolCandidates ?? []) add(s)
  }
  return [...out]
}

async function loeseIdent(anfrage: FundamentaldatenAnfrage): Promise<{
  ident: MacrotrendsIdent | null
  symbolYahoo: string | null
}> {
  const symbole = symboleAusAnfrage(anfrage)
  const symbolYahoo = symbole[0] ?? anfrage.symbolYahoo ?? null

  if (anfrage.tickerOverride?.trim()) {
    const t = anfrage.tickerOverride.trim().toUpperCase()
    const ident =
      (await loeseMacrotrendsIdent(t, anfrage.name)) ??
      ({ ticker: t, slug: t.toLowerCase(), firmenname: anfrage.name ?? t } satisfies MacrotrendsIdent)
    return { ident, symbolYahoo }
  }

  for (const sym of symbole) {
    const ticker = macrotrendsTickerAusSymbol(sym)
    const ident = await loeseMacrotrendsIdent(ticker, anfrage.name)
    if (ident) return { ident, symbolYahoo: sym }
  }

  if (anfrage.name?.trim()) {
    const ident = await loeseMacrotrendsIdent(anfrage.name.trim())
    if (ident) return { ident, symbolYahoo }
  }

  return { ident: null, symbolYahoo }
}

type YahooKeyStats = {
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  beta?: number
  marketCap?: number
  sharesOutstanding?: number
  enterpriseValue?: number
  trailingPE?: number
  forwardPE?: number
  dividendYield?: number
  sector?: string
  industry?: string
  website?: string
  longBusinessSummary?: string
  returnOnEquity?: number
  returnOnAssets?: number
  revenueGrowth?: number
  earningsGrowth?: number
}

async function ladeYahooKeyStats(symbol: string): Promise<YahooKeyStats | null> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return null
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  u.searchParams.set('modules', 'defaultKeyStatistics,summaryDetail,assetProfile,financialData')
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), {
    headers: {
      'User-Agent': YAHOO_UA,
      Cookie: auth.cookie,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const j = (await res.json()) as {
    quoteSummary?: {
      result?: Array<{
        defaultKeyStatistics?: Record<string, { raw?: number }>
        summaryDetail?: Record<string, { raw?: number }>
        assetProfile?: Record<string, unknown>
        financialData?: Record<string, { raw?: number }>
      }>
    }
  }
  const row = j.quoteSummary?.result?.[0]
  if (!row) return null
  const raw = (o: Record<string, { raw?: number }> | undefined, k: string) => o?.[k]?.raw ?? undefined
  const dks = row.defaultKeyStatistics
  const sd = row.summaryDetail
  const fd = row.financialData
  const ap = row.assetProfile as Record<string, unknown> | undefined
  return {
    fiftyTwoWeekHigh: raw(sd, 'fiftyTwoWeekHigh'),
    fiftyTwoWeekLow: raw(sd, 'fiftyTwoWeekLow'),
    beta: raw(dks, 'beta'),
    marketCap: raw(sd, 'marketCap'),
    sharesOutstanding: raw(dks, 'sharesOutstanding'),
    enterpriseValue: raw(dks, 'enterpriseValue'),
    trailingPE: raw(sd, 'trailingPE'),
    forwardPE: raw(sd, 'forwardPE'),
    dividendYield: raw(sd, 'dividendYield'),
    returnOnEquity: raw(fd, 'returnOnEquity'),
    returnOnAssets: raw(fd, 'returnOnAssets'),
    revenueGrowth: raw(fd, 'revenueGrowth'),
    earningsGrowth: raw(fd, 'earningsGrowth'),
    sector: typeof ap?.sector === 'string' ? ap.sector : undefined,
    industry: typeof ap?.industry === 'string' ? ap.industry : undefined,
    website: typeof ap?.website === 'string' ? ap.website : undefined,
    longBusinessSummary: typeof ap?.longBusinessSummary === 'string' ? ap.longBusinessSummary : undefined,
  }
}

function wertAnPeriode(z: FundamentalMetrikZeile | undefined, key: string): number | null {
  return z?.werte[key] ?? null
}

function baueKeyMetrics(
  yahoo: YahooKeyStats | null,
  roh: Awaited<ReturnType<typeof ladeMacrotrendsFundamentaldaten>>,
  schaetzungen: Awaited<ReturnType<typeof ladeFundamentalSchaetzungen>>,
): FundamentalKeyMetric[] {
  const out: FundamentalKeyMetric[] = []
  const zahl = (v?: number, suffix = '') =>
    v != null ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })}${suffix}` : '–'
  const pctDezimal = (v?: number) => {
    if (v == null) return '–'
    return `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`
  }

  out.push(
    { id: '52w_hoch', label: '52-Wochen-Hoch', wert: zahl(yahoo?.fiftyTwoWeekHigh, ' $'), gruppe: 'marktdaten' },
    { id: '52w_tief', label: '52-Wochen-Tief', wert: zahl(yahoo?.fiftyTwoWeekLow, ' $'), gruppe: 'marktdaten' },
    { id: 'beta', label: '5-Jahres-Beta', wert: zahl(yahoo?.beta), gruppe: 'marktdaten' },
  )

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
      id: 'shares_out',
      label: 'Ausstehende Aktien',
      wert: yahoo?.sharesOutstanding != null ? yahoo.sharesOutstanding.toLocaleString('de-DE') : '–',
      gruppe: 'kapitalstruktur',
    },
  )

  const ttmKey = FUNDAMENTAL_TTM_KEY
  const roeZeile = roh?.zeilen.find((z) => z.id === 'roe')
  const roaZeile = roh?.zeilen.find((z) => z.id === 'roa')
  const roiZeile = roh?.zeilen.find((z) => z.id === 'roi')
  const bruttoZeile = roh?.zeilen.find((z) => z.id === 'bruttomarge')
  const ebitdaZeile = roh?.zeilen.find((z) => z.id === 'ebitda_marge')
  const ebitZeile = roh?.zeilen.find((z) => z.id === 'ebit_marge')
  const kgvZeile = roh?.zeilen.find((z) => z.id === 'kgv')
  const psZeile = roh?.zeilen.find((z) => z.id === 'ps')
  const pbZeile = roh?.zeilen.find((z) => z.id === 'pb')
  const pfcfZeile = roh?.zeilen.find((z) => z.id === 'pfcf')

  const ttm = (z: FundamentalMetrikZeile | undefined) => wertAnPeriode(z, ttmKey)

  out.push(
    { id: 'ltm_brutto', label: 'TTM Bruttomarge', wert: formatFundamentalWert(ttm(bruttoZeile), 'prozent'), gruppe: 'effizienz' },
    { id: 'ltm_ebit', label: 'TTM EBIT-Marge', wert: formatFundamentalWert(ttm(ebitZeile), 'prozent'), gruppe: 'effizienz' },
    {
      id: 'ltm_roa',
      label: 'TTM ROA',
      wert: formatFundamentalWert(
        ttm(roaZeile) ?? (yahoo?.returnOnAssets != null ? yahoo.returnOnAssets * 100 : null),
        'prozent',
      ),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roe',
      label: 'TTM ROE',
      wert: formatFundamentalWert(
        ttm(roeZeile) ?? (yahoo?.returnOnEquity != null ? yahoo.returnOnEquity * 100 : null),
        'prozent',
      ),
      gruppe: 'effizienz',
    },
    { id: 'ltm_roi', label: 'TTM ROI', wert: formatFundamentalWert(ttm(roiZeile), 'prozent'), gruppe: 'effizienz' },
    { id: 'ltm_ebitda', label: 'TTM EBITDA-Marge', wert: formatFundamentalWert(ttm(ebitdaZeile), 'prozent'), gruppe: 'effizienz' },
  )

  const umsatzZeile = roh?.zeilen.find((z) => z.id === 'umsatz')
  const fyKeys = roh?.perioden.filter((p) => !p.istLtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  const umsatzHistorie = fyKeys.map((k) => umsatzZeile?.werte[k]).filter((v): v is number => v != null)
  const umsatzCagr3 = umsatzHistorie.length >= 2 ? cagrProzent(umsatzHistorie.slice(-4), 3) : null

  const epsSchaetz0 = schaetzungen.zeilen.find((z) => z.id === 'eps_schaetzung')
  const umsatzSchaetz0 = schaetzungen.zeilen.find((z) => z.id === 'umsatz_schaetzung')
  const fy0Key = schaetzungen.perioden[0]?.iso
  const fy1Key = schaetzungen.perioden[1]?.iso

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

  out.push(
    {
      id: 'fwd_kgv',
      label: 'Forward KGV (NTM)',
      wert: zahl(yahoo?.forwardPE ?? undefined, 'x'),
      gruppe: 'bewertung',
    },
    {
      id: 'trailing_kgv',
      label: 'Trailing KGV (TTM)',
      wert: zahl(yahoo?.trailingPE ?? ttm(kgvZeile) ?? undefined, 'x'),
      gruppe: 'bewertung',
    },
    {
      id: 'ltm_ps',
      label: 'KUV (P/S, TTM)',
      wert: formatFundamentalWert(ttm(psZeile), 'multiple'),
      gruppe: 'bewertung',
    },
    {
      id: 'ltm_pb',
      label: 'KBV (P/B, TTM)',
      wert: formatFundamentalWert(ttm(pbZeile), 'multiple'),
      gruppe: 'bewertung',
    },
    {
      id: 'ltm_pfcf',
      label: 'Kurs/FCF (TTM)',
      wert: formatFundamentalWert(ttm(pfcfZeile), 'multiple'),
      gruppe: 'bewertung',
    },
    { id: 'div_yield', label: 'Dividendenrendite', wert: pctDezimal(yahoo?.dividendYield), gruppe: 'bewertung' },
  )

  return out
}

function mergePeriodenUndZeilen(
  historisch: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
  schaetzungen: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
): { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } {
  if (schaetzungen.perioden.length === 0) return historisch

  const perioden = [...historisch.perioden, ...schaetzungen.perioden]
  const zeilen = [...historisch.zeilen]

  for (const sz of schaetzungen.zeilen) {
    const werte = { ...sz.werte }
    for (const p of historisch.perioden) {
      if (!(p.iso in werte)) werte[p.iso] = null
    }
    zeilen.push({ ...sz, werte })
  }

  for (const hz of historisch.zeilen) {
    for (const sp of schaetzungen.perioden) {
      if (!(sp.iso in hz.werte)) hz.werte[sp.iso] = null
    }
  }

  return { perioden, zeilen }
}

export async function ladeFundamentaldaten(anfrage: FundamentaldatenAnfrage): Promise<FundamentaldatenPaket> {
  const { ident, symbolYahoo } = await loeseIdent(anfrage)

  if (!ident) {
    return {
      ok: false,
      ticker: anfrage.tickerOverride?.trim().toUpperCase() ?? '',
      slug: '',
      firmenname: anfrage.name ?? 'Unbekannt',
      branche: null,
      sektor: null,
      website: null,
      beschreibung: null,
      waehrung: 'USD',
      perioden: [],
      zeilen: [],
      keyMetrics: [],
      symbolYahoo,
      geladenAm: new Date().toISOString(),
      quelle: 'macrotrends',
      fehler: 'Keine Fundamentaldaten auf Macrotrends gefunden. Ticker manuell eingeben.',
    }
  }

  const [roh, yahoo, schaetzungen] = await Promise.all([
    ladeMacrotrendsFundamentaldaten(ident),
    symbolYahoo ? ladeYahooKeyStats(symbolYahoo) : Promise.resolve(null),
    symbolYahoo ? ladeFundamentalSchaetzungen(symbolYahoo) : Promise.resolve({ perioden: [], zeilen: [] }),
  ])

  const brancheMeta = formatiereBrancheDe({ industry: yahoo?.industry, sector: yahoo?.sector })
  const beschreibungDe = await ladeUnternehmensbeschreibungDe({
    firmenname: ident.firmenname,
    ticker: ident.ticker,
    fallbackEn: yahoo?.longBusinessSummary ?? roh?.beschreibung,
  })

  if (!roh) {
    return {
      ok: false,
      ticker: ident.ticker,
      slug: ident.slug,
      firmenname: ident.firmenname,
      branche: brancheMeta.branche,
      sektor: brancheMeta.sektor,
      website: yahoo?.website ?? null,
      beschreibung: beschreibungDe,
      waehrung: 'USD',
      perioden: [],
      zeilen: [],
      keyMetrics: baueKeyMetrics(yahoo, null, schaetzungen),
      symbolYahoo,
      geladenAm: new Date().toISOString(),
      quelle: 'macrotrends',
      fehler: 'Macrotrends-Daten konnten nicht geladen werden.',
    }
  }

  const merged = mergePeriodenUndZeilen(roh, schaetzungen)

  return {
    ok: true,
    ticker: ident.ticker,
    slug: ident.slug,
    firmenname: ident.firmenname,
    branche: brancheMeta.branche ?? roh.branche,
    sektor: brancheMeta.sektor,
    website: yahoo?.website ?? null,
    beschreibung: beschreibungDe,
    waehrung: 'USD',
    perioden: merged.perioden,
    zeilen: merged.zeilen,
    keyMetrics: baueKeyMetrics(yahoo, roh, schaetzungen),
    symbolYahoo,
    geladenAm: new Date().toISOString(),
    quelle: 'macrotrends',
    fehler: null,
  }
}

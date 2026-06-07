import 'server-only'

import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  cagrProzent,
  formatFundamentalWert,
} from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
  FundamentalKeyMetric,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
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
    sector: typeof ap?.sector === 'string' ? ap.sector : undefined,
    industry: typeof ap?.industry === 'string' ? ap.industry : undefined,
    website: typeof ap?.website === 'string' ? ap.website : undefined,
    longBusinessSummary: typeof ap?.longBusinessSummary === 'string' ? ap.longBusinessSummary : undefined,
  }
}

function baueKeyMetrics(
  yahoo: YahooKeyStats | null,
  roh: Awaited<ReturnType<typeof ladeMacrotrendsFundamentaldaten>>,
): FundamentalKeyMetric[] {
  const out: FundamentalKeyMetric[] = []
  const zahl = (v?: number, suffix = '') =>
    v != null ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })}${suffix}` : '–'
  const pctRaw = (v?: number) => {
    if (v == null) return '–'
    const p = Math.abs(v) <= 1 ? v * 100 : v
    return `${p.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
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

  const roeZeile = roh?.zeilen.find((z) => z.id === 'roe')
  const roaZeile = roh?.zeilen.find((z) => z.id === 'roa')
  const roicZeile = roh?.zeilen.find((z) => z.id === 'roic')
  const bruttoZeile = roh?.zeilen.find((z) => z.id === 'bruttomarge')
  const ebitdaZeile = roh?.zeilen.find((z) => z.id === 'ebitda_marge')
  const ebitZeile = roh?.zeilen.find((z) => z.id === 'ebit_marge')

  const ltmKey = roh?.perioden.find((p) => p.istLtm)?.iso ?? roh?.perioden[roh.perioden.length - 1]?.iso
  const ltm = (z: typeof roeZeile) => (ltmKey && z ? z.werte[ltmKey] : null)

  out.push(
    { id: 'ltm_brutto', label: 'LTM Bruttomarge', wert: formatFundamentalWert(ltm(bruttoZeile), 'prozent'), gruppe: 'effizienz' },
    { id: 'ltm_ebit', label: 'LTM EBIT-Marge', wert: formatFundamentalWert(ltm(ebitZeile), 'prozent'), gruppe: 'effizienz' },
    {
      id: 'ltm_roa',
      label: 'LTM ROA',
      wert: formatFundamentalWert(
        ltm(roaZeile) ?? (yahoo?.returnOnAssets != null ? yahoo.returnOnAssets * 100 : null),
        'prozent',
      ),
      gruppe: 'effizienz',
    },
    {
      id: 'ltm_roe',
      label: 'LTM ROE',
      wert: formatFundamentalWert(
        ltm(roeZeile) ?? (yahoo?.returnOnEquity != null ? yahoo.returnOnEquity * 100 : null),
        'prozent',
      ),
      gruppe: 'effizienz',
    },
    { id: 'ltm_roic', label: 'LTM ROIC', wert: formatFundamentalWert(ltm(roicZeile), 'prozent'), gruppe: 'effizienz' },
    { id: 'ltm_ebitda', label: 'LTM EBITDA-Marge', wert: formatFundamentalWert(ltm(ebitdaZeile), 'prozent'), gruppe: 'effizienz' },
  )

  const perioden = roh?.perioden.filter((p) => !p.istLtm).map((p) => p.iso) ?? []
  const letzte3 = perioden.slice(-4)
  const roeWerte = letzte3.map((p) => roeZeile?.werte[p]).filter((v): v is number => v != null)
  const roeCagr = roeWerte.length >= 2 ? cagrProzent(roeWerte, 3) : null

  out.push(
    { id: 'fwd_kgv', label: 'Forward KGV (NTM)', wert: zahl(yahoo?.forwardPE, 'x'), gruppe: 'bewertung' },
    { id: 'trailing_kgv', label: 'Trailing KGV (LTM)', wert: zahl(yahoo?.trailingPE, 'x'), gruppe: 'bewertung' },
    { id: 'div_yield', label: 'Dividendenrendite', wert: pctRaw(yahoo?.dividendYield), gruppe: 'bewertung' },
    {
      id: 'roe_cagr_3j',
      label: 'ROE-CAGR (3 Jahre)',
      wert: roeCagr != null ? formatFundamentalWert(roeCagr, 'prozent') : '–',
      gruppe: 'wachstum',
    },
  )

  return out
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

  const [roh, yahoo] = await Promise.all([
    ladeMacrotrendsFundamentaldaten(ident),
    symbolYahoo ? ladeYahooKeyStats(symbolYahoo) : Promise.resolve(null),
  ])

  if (!roh) {
    return {
      ok: false,
      ticker: ident.ticker,
      slug: ident.slug,
      firmenname: ident.firmenname,
      branche: yahoo?.industry ?? null,
      website: yahoo?.website ?? null,
      beschreibung: yahoo?.longBusinessSummary ?? null,
      waehrung: 'USD',
      perioden: [],
      zeilen: [],
      keyMetrics: baueKeyMetrics(yahoo, null),
      symbolYahoo,
      geladenAm: new Date().toISOString(),
      quelle: 'macrotrends',
      fehler: 'Macrotrends-Daten konnten nicht geladen werden.',
    }
  }

  return {
    ok: true,
    ticker: ident.ticker,
    slug: ident.slug,
    firmenname: ident.firmenname,
    branche: yahoo?.industry ?? roh.branche,
    website: yahoo?.website ?? null,
    beschreibung: yahoo?.longBusinessSummary ?? roh.beschreibung,
    waehrung: 'USD',
    perioden: roh.perioden,
    zeilen: roh.zeilen,
    keyMetrics: baueKeyMetrics(yahoo, roh),
    symbolYahoo,
    geladenAm: new Date().toISOString(),
    quelle: 'macrotrends',
    fehler: null,
  }
}

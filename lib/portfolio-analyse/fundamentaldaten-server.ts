import 'server-only'

import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  baueKeyMetrics,
  type YahooFundamentalKennzahlen,
} from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import { ergaenzeKeyMetricsAusErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics-erweitert'
import { baueMantraAudit } from '@/lib/portfolio-analyse/fundamentaldaten-mantra'
import { baueKontextWerte } from '@/lib/portfolio-analyse/fundamentaldaten-kontext-werte'
import { ladeYahooMantraFinanzdaten } from '@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server'
import { ladeFundamentalNews } from '@/lib/portfolio-analyse/fundamentaldaten-news-server'
import { baueNtmBewertungsZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-ntm-bewertung-server'
import { ergaenzeDividendenHistorieZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-dividenden-historie-zeilen'
import { ergaenzeEvMultiplesZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-ev-multiples-zeilen'
import { ergaenzeNettoverschuldungZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-nettoverschuldung-zeilen'
import { ergaenzeMargenZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-margen-zeilen'
import { ergaenzeYahooSchuldenZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-yahoo-schulden-zeilen'
import { ladeFundamentalSchaetzungen, filterSchaetzungenGegenHistorisch, fuelleFehlendeEpsSchaetzungen } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import {
  formatiereBrancheDe,
  ladeUnternehmensbeschreibungDe,
} from '@/lib/portfolio-analyse/fundamentaldaten-unternehmen-de'
import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { FundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { ladeFundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-server'
import { ladeEuFundamentalAusCloud } from '@/lib/portfolio-analyse/eu-fundamental-cloud-server'
import { ladeMarketscreenerWatchlistPaket } from '@/lib/portfolio-analyse/marketscreener-fundamentaldaten-server'
import { lookupIsinMetadaten } from '@/lib/portfolio-analyse/isin-lookup-server'
import {
  baueUmsatzProJahrAusFinanzzeile,
  normalisiereSegmentPaketGegenUmsatz,
} from '@/lib/portfolio-analyse/segment-umsatz-abgleich'
import { FUNDAMENTAL_NTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis, loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeMacrotrendsFundamentaldaten,
  loeseMacrotrendsIdent,
  macrotrendsTickerAusSymbol,
  type MacrotrendsIdent,
  type MacrotrendsIdentOpts,
} from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import {
  baueFundamentalRohAusAlternativQuellen,
  ergaenzeMacrotrendsMitYahooGuV,
  nutzeYahooGuVFuerIsin,
  brauchtGuVErgaenzung,
} from '@/lib/portfolio-analyse/fundamentaldaten-yahoo-guv-server'
import { ISIN_WAEHRUNG, istEuIsin } from '@/lib/portfolio-analyse/eu-portfolio-ir-config'
import { ladeUnitEconomics } from '@/lib/portfolio-analyse/unit-economics-server'
import { ladeYahooFundamentalKennzahlenMitFallback } from '@/lib/portfolio-analyse/yahoo-kennzahlen-fallback-server'
import { ergaenzeFehlendeStatementZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-zeilen-backfill-server'
import { ergaenzeRoicAusBilanz } from '@/lib/portfolio-analyse/fundamentaldaten-roic-berechnung'
import { ergaenzeWorkingCapitalTageZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-working-capital-zeilen'
import { ladeIncrementalRoic } from '@/lib/portfolio-analyse/incremental-roic-server'

function waehrungFuerIsin(isin: string | null | undefined): string {
  const i = isin?.trim().toUpperCase() ?? ''
  if (i && ISIN_WAEHRUNG[i]) return ISIN_WAEHRUNG[i]
  const prefix = i.slice(0, 2)
  const map: Record<string, string> = {
    DE: 'EUR', FR: 'EUR', NL: 'EUR', IT: 'EUR', ES: 'EUR', BE: 'EUR', AT: 'EUR',
    FI: 'EUR', IE: 'EUR', PT: 'EUR', LU: 'EUR',
    CH: 'CHF', GB: 'GBP', DK: 'DKK', SE: 'SEK', NO: 'NOK', PL: 'PLN',
    CA: 'CAD', AU: 'AUD', JP: 'JPY',
  }
  return map[prefix] ?? 'USD'
}

function symboleAusAnfrage(anfrage: FundamentaldatenAnfrage): string[] {
  const out = new Set<string>()
  const add = (s?: string | null) => {
    for (const t of brokerSymbolKandidaten(s ?? '')) out.add(t)
  }
  const isin = anfrage.isin?.trim().toUpperCase()
  const k = isin ? isinKenntnis(isin) : undefined
  if (k) {
    add(k.symbolYahoo)
    for (const s of k.symbolCandidates ?? []) add(s)
  }
  add(anfrage.symbolYahoo)
  for (const s of anfrage.symbolCandidates ?? []) add(s)

  // US-ISIN: immer auch das reine US-Ticker-Symbol aufnehmen (ohne .DE/.F),
  // sonst landet die Watchlist oft bei AOS.DE ohne Forward-Schätzungen.
  if (isin?.startsWith('US')) {
    for (const s of [...out]) {
      const bare = s.split('.')[0]?.toUpperCase()
      if (bare && /^[A-Z]{1,5}$/.test(bare)) out.add(bare)
    }
  }

  const liste = [...out]

  // US-Titel ohne Kenntnisse-Eintrag (v. a. Watchlist): US-Listing (ohne Börsen-Suffix)
  // bevorzugen — nur dort liefert Yahoo Analysten-Schätzungen (Forward-KGV/NTM) und
  // USD-Kurse, die zu den USD-Fundamentaldaten von Macrotrends passen.
  if (isin?.startsWith('US') && !k?.symbolYahoo) {
    liste.sort((a, b) => Number(a.includes('.')) - Number(b.includes('.')))
  }

  return liste
}

function macrotrendsOptsAusAnfrage(
  anfrage: FundamentaldatenAnfrage,
  erwarteterTicker: string,
): MacrotrendsIdentOpts {
  const isin = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: anfrage.symbolYahoo,
    ticker: erwarteterTicker,
    firmenname: anfrage.name,
  })
  const k = isinKenntnis(isin)
  const macrotrendsTicker =
    k?.macrotrendsTicker?.trim().toUpperCase() ||
    k?.symbolYahoo?.split('.')[0]?.toUpperCase() ||
    erwarteterTicker.trim().toUpperCase()
  return {
    erwarteterTicker: macrotrendsTicker,
    firmenname: anfrage.name?.trim() || k?.name?.trim(),
    slug: k?.macrotrendsSlug,
    macrotrendsTicker: k?.macrotrendsTicker,
  }
}

async function loeseIdent(anfrage: FundamentaldatenAnfrage): Promise<{
  ident: MacrotrendsIdent | null
  symbolYahoo: string | null
}> {
  const symbole = symboleAusAnfrage(anfrage)
  const symbolYahoo = symbole[0] ?? anfrage.symbolYahoo ?? null
  const isin = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: anfrage.symbolYahoo ?? symbolYahoo,
    firmenname: anfrage.name,
  })
  const k = isinKenntnis(isin)
  const firmenname = anfrage.name?.trim() || k?.name?.trim()

  if (anfrage.tickerOverride?.trim()) {
    const t = anfrage.tickerOverride.trim().toUpperCase()
    const ident = await loeseMacrotrendsIdent(t, macrotrendsOptsAusAnfrage(anfrage, t))
    return { ident, symbolYahoo }
  }

  for (const sym of symbole) {
    const ticker = macrotrendsTickerAusSymbol(sym)
    const ident = await loeseMacrotrendsIdent(ticker, macrotrendsOptsAusAnfrage(anfrage, ticker))
    if (ident) return { ident, symbolYahoo: sym }
  }

  if (firmenname) {
    const ident = await loeseMacrotrendsIdent(firmenname, { firmenname })
    if (ident) return { ident, symbolYahoo }
  }

  return { ident: null, symbolYahoo }
}

async function ladeYahooFundamentalKennzahlen(
  symbol: string,
  opts?: { isin?: string | null; macrotrendsTicker?: string | null },
): Promise<YahooFundamentalKennzahlen | null> {
  return ladeYahooFundamentalKennzahlenMitFallback({
    symbolYahoo: symbol,
    isin: opts?.isin,
    macrotrendsTicker: opts?.macrotrendsTicker,
  })
}

function baueMantraMeta(
  yahooExt: (YahooFundamentalKennzahlen & { sector?: string; industry?: string }) | null,
  yahooFinanz: Awaited<ReturnType<typeof ladeYahooMantraFinanzdaten>>,
) {
  return {
    beta: yahooExt?.beta ?? null,
    marketCapUsd: yahooExt?.marketCap ?? null,
    totalDebtUsd: yahooExt?.totalDebt ?? null,
    totalCashUsd: yahooExt?.totalCash ?? null,
    yahooFinanz: yahooFinanz ?? null,
  }
}

function rohFuerMantra(
  roh: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } | null,
): { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } | null {
  if (!roh) return null
  return { perioden: roh.perioden, zeilen: roh.zeilen }
}
const SCHÄTZUNG_ZU_HISTORISCH_ZEILE: Record<string, string> = {
  umsatz_schaetzung: 'umsatz',
  eps_schaetzung: 'eps',
  ebit_schaetzung: 'ebit',
  ebitda_schaetzung: 'ebitda',
  nettogewinn_schaetzung: 'nettogewinn',
  fcf_schaetzung: 'fcf',
  bruttogewinn_schaetzung: 'bruttogewinn',
}

function mergePeriodenUndZeilen(
  historisch: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
  schaetzungen: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
): { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } {
  if (schaetzungen.perioden.length === 0) return historisch

  const perioden = [...historisch.perioden, ...schaetzungen.perioden]
  const zeilen = historisch.zeilen.map((z) => ({ ...z, werte: { ...z.werte } }))

  for (const hz of zeilen) {
    for (const sp of schaetzungen.perioden) {
      if (!(sp.iso in hz.werte)) hz.werte[sp.iso] = null
    }
  }

  for (const sz of schaetzungen.zeilen) {
    const histId = SCHÄTZUNG_ZU_HISTORISCH_ZEILE[sz.id]
    if (histId) {
      let hz = zeilen.find((z) => z.id === histId)
      // Manche Titel haben in Macrotrends keine eps-Zeile — dann anlegen,
      // sonst gehen EPS-Schätzungen verloren und Forward-KGV bleibt leer.
      if (!hz && histId === 'eps') {
        hz = {
          id: 'eps',
          label: 'EPS',
          gruppe: 'finanzdaten',
          einheit: 'waehrung_usd_aktie',
          werte: Object.fromEntries(perioden.map((p) => [p.iso, null as number | null])),
        }
        zeilen.push(hz)
      }
      if (hz) {
        for (const sp of schaetzungen.perioden) {
          const v = sz.werte[sp.iso]
          if (v != null && Number.isFinite(v)) hz.werte[sp.iso] = v
        }
      }
    }
  }

  // Schätzungs-Zeilen zusätzlich behalten (Fallback, falls Mapping fehlschlägt)
  for (const sz of schaetzungen.zeilen) {
    if (zeilen.some((z) => z.id === sz.id)) continue
    const werte: Record<string, number | null> = { ...sz.werte }
    for (const p of perioden) {
      if (!(p.iso in werte)) werte[p.iso] = null
    }
    zeilen.push({ ...sz, werte })
  }

  return { perioden, zeilen }
}

function leeresPaket(partial: Partial<FundamentaldatenPaket> & Pick<FundamentaldatenPaket, 'ok' | 'ticker' | 'firmenname'>): FundamentaldatenPaket {
  return {
    slug: '',
    branche: null,
    sektor: null,
    website: null,
    beschreibung: null,
    waehrung: 'USD',
    perioden: [],
    zeilen: [],
    keyMetrics: [],
    mantra: baueMantraAudit(null, null, null, null, { perioden: [], zeilen: [] }),
    mantraMeta: null,
    news: [],
    symbolYahoo: null,
    geladenAm: new Date().toISOString(),
    quelle: 'macrotrends',
    fehler: null,
    erweitert: null,
    ...partial,
  }
}

export async function ladeFundamentaldaten(anfrage: FundamentaldatenAnfrage): Promise<FundamentaldatenPaket> {
  const frequenz = anfrage.frequenz === 'quartal' ? 'quartal' : 'jahr'
  let { ident, symbolYahoo } = await loeseIdent(anfrage)
  /** Kein Macrotrends-Treffer, aber GuV-Historie aus StockAnalysis/Yahoo vorhanden (Watchlist). */
  let altRoh: Awaited<ReturnType<typeof baueFundamentalRohAusAlternativQuellen>> = null

  // Watchlist-Fallback: Wenn nur ISIN vorhanden ist (z. B. PL/EU Titel) und kein Symbol bekannt ist,
  // versuchen wir serverseitig Metadaten (Yahoo-Symbol/Name) nachzuladen, damit Yahoo-Fallback greifen kann.
  if (!symbolYahoo && anfrage.isin?.trim()) {
    const isin = anfrage.isin.trim().toUpperCase()
    if (isin.length >= 10) {
      const [meta] = await lookupIsinMetadaten([isin])
      if (meta?.symbolYahoo) {
        symbolYahoo = meta.symbolYahoo
        if (!anfrage.name?.trim() && meta.name?.trim()) {
          anfrage = { ...anfrage, name: meta.name }
        }
      }
    }
  }

  const isinNormEarly = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: symbolYahoo ?? anfrage.symbolYahoo,
    firmenname: anfrage.name,
  })
  const kEarly = isinNormEarly ? isinKenntnis(isinNormEarly) : null

  if (!ident && isinNormEarly && nutzeYahooGuVFuerIsin(isinNormEarly)) {
    const sym = symbolYahoo ?? kEarly?.symbolYahoo ?? anfrage.symbolYahoo
    if (sym) {
      const mt =
        kEarly?.macrotrendsTicker?.trim().toUpperCase() ||
        macrotrendsTickerAusSymbol(sym)
      ident = {
        ticker: mt,
        slug: kEarly?.macrotrendsSlug ?? mt.toLowerCase(),
        firmenname: kEarly?.name ?? anfrage.name ?? mt,
      }
      symbolYahoo = sym
    }
  }

  // Watchlist-Titel ohne Macrotrends-Seite (z. B. EU-Nebenwerte): volle Pipeline mit
  // GuV-/Cashflow-Historie aus StockAnalysis + Yahoo timeseries statt dünnem Yahoo-Fallback.
  if (!ident && symbolYahoo && frequenz === 'jahr') {
    const tickerGuess = macrotrendsTickerAusSymbol(symbolYahoo)
    const identGuess: MacrotrendsIdent = {
      ticker: tickerGuess,
      slug: '',
      firmenname: anfrage.name?.trim() || tickerGuess,
    }
    altRoh = await baueFundamentalRohAusAlternativQuellen(identGuess, symbolYahoo, {
      isin: isinNormEarly ?? anfrage.isin,
      firmenname: anfrage.name ?? identGuess.firmenname,
      ticker: tickerGuess,
    }).catch(() => null)
    if (altRoh && altRoh.zeilen.length > 0) {
      ident = identGuess
    } else {
      altRoh = null
    }
  }

  if (!ident) {
    // Watchlist: Live-Scrape von Marketscreener (ISIN/Name-Suche — auch PL/EU ohne Macrotrends).
    const msLive = await ladeMarketscreenerWatchlistPaket({
      isin: anfrage.isin,
      name: anfrage.name ?? '',
      symbolYahoo,
    }).catch(() => null)
    if (msLive?.ok) return msLive

    // Fallback: Wenn Macrotrends keinen Treffer liefert, dennoch Yahoo-Basisdaten anzeigen,
    // damit Watchlist immer "Daten" hat (Key-Metrics, Beschreibung, News, ggf. Schätzungen).
    const isinKey = anfrage.isin?.trim().toUpperCase() || null
    if (isinKey && istEuIsin(isinKey)) {
      const eu = await ladeEuFundamentalAusCloud(isinKey)
      if (eu?.kennzahlen?.length) {
        const metriken = eu.kennzahlen.map((k) => {
          const id = k.label
            .toLowerCase()
            .replace(/\d{4}.*/, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 28)
          const gruppe =
            /p\/e|ev|yield|market cap|enterprise value/i.test(k.label) ? ('bewertung_ltm' as const) : ('marktdaten' as const)
          return { id: `ms_${id}`, label: k.label, wert: k.wert, gruppe }
        })
        return leeresPaket({
          ok: true,
          quelle: 'marketscreener',
          ticker: '',
          slug: '',
          firmenname: anfrage.name ?? 'Unbekannt',
          symbolYahoo: null,
          keyMetrics: metriken,
          fehler: 'Keine Fundamentaldaten auf Macrotrends gefunden (Fallback: Marketscreener Cache).',
        })
      }
    }

    if (symbolYahoo) {
      const tickerGuess = macrotrendsTickerAusSymbol(symbolYahoo)
      const firmenname = anfrage.name?.trim() || tickerGuess || symbolYahoo
      const [yahooRaw, news, yahooFinanz, schaetzungen] = await Promise.all([
        ladeYahooFundamentalKennzahlen(symbolYahoo, {
          isin: anfrage.isin,
          macrotrendsTicker: isinKenntnis(anfrage.isin)?.macrotrendsTicker,
        }).catch(() => null),
        ladeFundamentalNews(symbolYahoo, firmenname).catch(() => []),
        ladeYahooMantraFinanzdaten(symbolYahoo).catch(() => null),
        frequenz === 'jahr'
          ? ladeFundamentalSchaetzungen({
              symbol: symbolYahoo,
              isin: anfrage.isin,
              name: firmenname,
              ticker: tickerGuess || symbolYahoo,
            }).catch(() => ({ perioden: [], zeilen: [] }))
          : Promise.resolve({ perioden: [], zeilen: [] }),
      ])

      const yahooExt = yahooRaw as (YahooFundamentalKennzahlen & {
        sector?: string
        industry?: string
        website?: string
        longBusinessSummary?: string
      }) | null
      const brancheMeta = formatiereBrancheDe({ industry: yahooExt?.industry, sector: yahooExt?.sector })
      const beschreibungDe = await ladeUnternehmensbeschreibungDe({
        firmenname,
        ticker: tickerGuess || symbolYahoo,
        fallbackEn: yahooExt?.longBusinessSummary,
      }).catch(() => yahooExt?.longBusinessSummary ?? null)

      const mantraMeta = baueMantraMeta(yahooExt, yahooFinanz)

      return leeresPaket({
        ok: true,
        quelle: 'yahoo',
        ticker: tickerGuess || symbolYahoo,
        firmenname,
        slug: '',
        branche: brancheMeta.branche,
        sektor: brancheMeta.sektor,
        website: yahooExt?.website ?? null,
        beschreibung: beschreibungDe,
        keyMetrics: baueKeyMetrics(yahooExt, null, schaetzungen, null),
        mantra: baueMantraAudit(
          brancheMeta.sektor,
          brancheMeta.branche,
          yahooExt,
          null,
          schaetzungen,
          yahooFinanz,
        ),
        mantraMeta,
        news,
        symbolYahoo,
        frequenz,
        fehler: 'Keine Fundamentaldaten auf Macrotrends gefunden (Fallback: Yahoo).',
      })
    }

    return leeresPaket({
      ok: false,
      ticker: anfrage.tickerOverride?.trim().toUpperCase() ?? '',
      firmenname: anfrage.name ?? 'Unbekannt',
      symbolYahoo,
      fehler: 'Keine Fundamentaldaten auf Macrotrends gefunden. Ticker manuell eingeben.',
    })
  }

  const [rohRaw, yahooRaw, schaetzungen, news, yahooFinanz, unitEconomics, erweitert] = await Promise.all([
    altRoh ? Promise.resolve(altRoh) : ladeMacrotrendsFundamentaldaten(ident, frequenz),
    symbolYahoo
      ? ladeYahooFundamentalKennzahlen(symbolYahoo, {
          isin: anfrage.isin,
          macrotrendsTicker: ident.ticker !== macrotrendsTickerAusSymbol(symbolYahoo) ? ident.ticker : isinKenntnis(anfrage.isin)?.macrotrendsTicker,
        })
      : Promise.resolve(null),
    frequenz === 'jahr' && symbolYahoo
      ? ladeFundamentalSchaetzungen({
          symbol: symbolYahoo,
          isin: anfrage.isin,
          name: anfrage.name ?? ident.firmenname,
          ticker: ident.ticker,
        })
      : Promise.resolve({ perioden: [], zeilen: [] }),
    symbolYahoo ? ladeFundamentalNews(symbolYahoo, ident.firmenname) : Promise.resolve([]),
    symbolYahoo ? ladeYahooMantraFinanzdaten(symbolYahoo, { isin: anfrage.isin }) : Promise.resolve(null),
    ladeUnitEconomics(ident.ticker).catch(() => null),
    ladeFundamentaldatenErweitert({
      ticker: ident.ticker,
      symbolYahoo,
      isin: isinNormEarly ?? anfrage.isin?.trim().toUpperCase() ?? null,
      firmenname: anfrage.name ?? ident.firmenname,
      segmentNurCloud: anfrage.segmentNurCloud === true,
    }).catch((e) => {
      console.warn('[fundamentaldaten] erweitert optional fehlgeschlagen:', e instanceof Error ? e.message : e)
      return null
    }),
  ])

  let roh = rohRaw
  const isinNorm = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: symbolYahoo ?? anfrage.symbolYahoo,
    firmenname: anfrage.name ?? ident.firmenname,
  })
  if (
    (!roh || roh.zeilen.length === 0) &&
    symbolYahoo &&
    frequenz === 'jahr' &&
    (nutzeYahooGuVFuerIsin(isinNorm ?? anfrage.isin) || brauchtGuVErgaenzung(roh))
  ) {
    const fallback = await baueFundamentalRohAusAlternativQuellen(ident, symbolYahoo, {
      isin: isinNorm ?? anfrage.isin,
      firmenname: anfrage.name ?? ident.firmenname,
      ticker: ident.ticker,
    })
    if (fallback) roh = fallback
  } else if (
    roh &&
    symbolYahoo &&
    frequenz === 'jahr' &&
    (nutzeYahooGuVFuerIsin(isinNorm ?? anfrage.isin) || brauchtGuVErgaenzung(roh))
  ) {
    roh = await ergaenzeMacrotrendsMitYahooGuV(roh, symbolYahoo, {
      isin: isinNorm ?? anfrage.isin,
      firmenname: anfrage.name ?? ident.firmenname,
      ticker: ident.ticker,
    })
  }

  const yahooExt = yahooRaw as (YahooFundamentalKennzahlen & {
    sector?: string
    industry?: string
    website?: string
    longBusinessSummary?: string
  }) | null

  const brancheMeta = formatiereBrancheDe({ industry: yahooExt?.industry, sector: yahooExt?.sector })
  const beschreibungDe = await ladeUnternehmensbeschreibungDe({
    firmenname: ident.firmenname,
    ticker: ident.ticker,
    fallbackEn: yahooExt?.longBusinessSummary ?? roh?.beschreibung,
  })

  const mantraMeta = baueMantraMeta(yahooExt, yahooFinanz)

  if (!roh) {
    return leeresPaket({
      ok: false,
      ticker: ident.ticker,
      slug: ident.slug,
      firmenname: ident.firmenname,
      branche: brancheMeta.branche,
      sektor: brancheMeta.sektor,
      website: yahooExt?.website ?? null,
      beschreibung: beschreibungDe,
      keyMetrics: baueKeyMetrics(yahooExt, null, schaetzungen, null),
      mantra: baueMantraAudit(brancheMeta.sektor, brancheMeta.branche, yahooExt, null, schaetzungen, yahooFinanz),
      mantraMeta,
      news,
      symbolYahoo,
      erweitert,
      fehler: 'Macrotrends-Daten konnten nicht geladen werden.',
    })
  }

  const schaetzungenNachFilter = roh
    ? filterSchaetzungenGegenHistorisch(schaetzungen, roh)
    : schaetzungen

  // Absolute EPS für FY-Spalten: Yahoo-Konsens und/oder Ist-EPS × Wachstum
  // (sonst bleibt Forward-KGV leer, obwohl KUV aus Umsatz-Schätzungen da ist).
  const schaetzungenGefiltert =
    frequenz === 'jahr' && roh && schaetzungenNachFilter.perioden.length > 0
      ? (() => {
          const mitYahoo = {
            ...schaetzungenNachFilter,
            zeilen: schaetzungenNachFilter.zeilen.map((z) =>
              z.id === 'eps_schaetzung' ? { ...z, werte: { ...z.werte } } : z,
            ),
          }
          let epsZ = mitYahoo.zeilen.find((z) => z.id === 'eps_schaetzung')
          if (!epsZ) {
            epsZ = {
              id: 'eps_schaetzung',
              label: 'EPS (Schätzung)',
              gruppe: 'schaetzungen' as const,
              einheit: 'waehrung_usd_aktie' as const,
              werte: Object.fromEntries(mitYahoo.perioden.map((p) => [p.iso, null as number | null])),
              istSchaetzung: true,
            }
            mitYahoo.zeilen = [...mitYahoo.zeilen, epsZ]
          }
          const p0 = mitYahoo.perioden[0]
          const p1 = mitYahoo.perioden[1]
          if (
            p0 &&
            (epsZ.werte[p0.iso] == null || !(epsZ.werte[p0.iso]! > 0)) &&
            yahooExt?.ntmEpsSchaetzung != null &&
            yahooExt.ntmEpsSchaetzung > 0
          ) {
            epsZ.werte[p0.iso] = yahooExt.ntmEpsSchaetzung
          }
          if (
            p1 &&
            (epsZ.werte[p1.iso] == null || !(epsZ.werte[p1.iso]! > 0)) &&
            yahooExt?.fy1Eps != null &&
            yahooExt.fy1Eps > 0
          ) {
            epsZ.werte[p1.iso] = yahooExt.fy1Eps
          }
          return fuelleFehlendeEpsSchaetzungen({
            schaetzungen: mitYahoo,
            historisch: roh,
            trailingEps: yahooExt?.trailingEps ?? null,
          })
        })()
      : schaetzungenNachFilter

  const merged =
    frequenz === 'jahr'
      ? mergePeriodenUndZeilen(roh, schaetzungenGefiltert)
      : { perioden: roh.perioden, zeilen: roh.zeilen }

  // Yahoo Total Debt (inkl. kurzfristig + Leases) vor Nettoverschuldung/EV.
  if (frequenz === 'jahr' && symbolYahoo) {
    await ergaenzeYahooSchuldenZeilen(symbolYahoo, merged.perioden, merged.zeilen, {
      isin: isinNorm ?? anfrage.isin,
    })
  }
  ergaenzeNettoverschuldungZeilen(merged.perioden, merged.zeilen)
  ergaenzeMargenZeilen(merged.perioden, merged.zeilen)
  ergaenzeEvMultiplesZeilen(merged.perioden, merged.zeilen)
  ergaenzeRoicAusBilanz(merged.perioden, merged.zeilen)
  ergaenzeWorkingCapitalTageZeilen(merged.perioden, merged.zeilen)

  await ergaenzeFehlendeStatementZeilen({
    perioden: merged.perioden,
    zeilen: merged.zeilen,
    symbolYahoo: symbolYahoo ?? ident.ticker,
    isin: isinNorm ?? anfrage.isin,
    ticker: ident.ticker,
    firmenname: anfrage.name ?? ident.firmenname,
    yahooFinanz,
  })

  // SBC aus Yahoo Timeseries nachziehen, wenn Macrotrends-Zeile leer (EU/ADR)
  if (yahooFinanz?.stockBasedCompensationUsd != null) {
    const sbcMio = yahooFinanz.stockBasedCompensationUsd / 1_000_000
    const histKeys = merged.perioden
      .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung)
      .map((p) => p.iso)
    const lastKey = histKeys[histKeys.length - 1]
    let sbcZ = merged.zeilen.find((z) => z.id === 'sbc')
    if (!sbcZ) {
      sbcZ = {
        id: 'sbc',
        label: 'Stock-Based Compensation (SBC)',
        gruppe: 'cashflow',
        einheit: 'waehrung_usd_mio',
        werte: {},
      }
      merged.zeilen.push(sbcZ)
    }
    if (lastKey && sbcZ.werte[lastKey] == null) {
      sbcZ.werte[lastKey] = Math.round(sbcMio * 10) / 10
    }
  }

  const ntm =
    frequenz === 'jahr'
      ? await baueNtmBewertungsZeilen(symbolYahoo, merged.perioden, merged.zeilen, yahooExt)
      : { periodenPatch: null as null, trailingPatches: {}, neueZeilen: [] as FundamentalMetrikZeile[], zeilen: [] as FundamentalMetrikZeile[] }
  // Kein NTM-Perioden-Patch mehr — nur FY-Schätz-Multiples in Trailing-Zeilen
  const trailingLabels: Record<string, string> = {
    kgv: 'KGV (P/E)',
    ps: 'KUV (P/S)',
    pfcf: 'Kurs / FCF',
  }
  for (const [zeileId, patch] of Object.entries(ntm.trailingPatches ?? {})) {
    if (!patch) continue
    let z = merged.zeilen.find((r) => r.id === zeileId)
    if (!z && (zeileId === 'kgv' || zeileId === 'ps' || zeileId === 'pfcf')) {
      z = {
        id: zeileId,
        label: trailingLabels[zeileId] ?? zeileId,
        gruppe: 'bewertung_trailing',
        einheit: 'multiple',
        werte: Object.fromEntries(merged.perioden.map((p) => [p.iso, null as number | null])),
      }
      merged.zeilen.push(z)
    }
    if (!z) continue
    for (const [iso, v] of Object.entries(patch)) {
      if (v != null) z.werte[iso] = v
      else if (!(iso in z.werte)) z.werte[iso] = null
    }
  }
  // Alte NTM-Spalte aus Caches/Perioden entfernen
  merged.perioden = merged.perioden.filter((p) => !p.istNtm && p.iso !== FUNDAMENTAL_NTM_KEY)
  for (const z of merged.zeilen) {
    if (FUNDAMENTAL_NTM_KEY in z.werte) delete z.werte[FUNDAMENTAL_NTM_KEY]
  }
  for (const neu of ntm.neueZeilen ?? []) {
    if (FUNDAMENTAL_NTM_KEY in neu.werte) delete neu.werte[FUNDAMENTAL_NTM_KEY]
    const existing = merged.zeilen.find((z) => z.id === neu.id)
    if (existing) {
      for (const [iso, v] of Object.entries(neu.werte)) {
        if (v != null) existing.werte[iso] = v
        else if (!(iso in existing.werte)) existing.werte[iso] = null
      }
      continue
    }
    for (const p of merged.perioden) {
      if (!(p.iso in neu.werte)) neu.werte[p.iso] = null
    }
    merged.zeilen.push(neu)
  }

  ergaenzeDividendenHistorieZeilen(merged.perioden, merged.zeilen, yahooExt)

  const sektorFinal = brancheMeta.sektor
  const brancheFinal = brancheMeta.branche ?? roh.branche
  const mergedRoh = { ...roh, perioden: merged.perioden, zeilen: merged.zeilen }
  const [roiicPaket] = await Promise.all([
    ladeIncrementalRoic({
      symbolYahoo: symbolYahoo ?? ident.ticker,
      yahooHistorie: yahooFinanz?.annualHistorie ?? null,
      isin: isinNorm ?? anfrage.isin,
      ticker: ident.ticker,
      firmenname: anfrage.name ?? ident.firmenname,
    }),
  ])

  const kontextWerte = baueKontextWerte({
    yahoo: yahooExt,
    roh: rohFuerMantra(merged),
    schaetzungen: schaetzungenGefiltert,
    yahooFinanz,
    unitEconomics,
    incrementalRoicPct: roiicPaket.incrementalRoicPct,
  })
  // Macrotrends liefert USD; nur bei Alternativquellen (Yahoo timeseries, Berichtswährung)
  // die Währung aus Konfig bzw. ISIN-Präfix ableiten.
  const waehrung = altRoh
    ? waehrungFuerIsin(isinNorm ?? anfrage.isin)
    : (isinNorm && ISIN_WAEHRUNG[isinNorm]) || 'USD'

  let erweitertFinal = erweitert
  if (erweitert?.secSegmentHistorie) {
    const umsatzMap = baueUmsatzProJahrAusFinanzzeile(merged.zeilen.find((z) => z.id === 'umsatz'))
    if (umsatzMap.size > 0) {
      const norm =
        normalisiereSegmentPaketGegenUmsatz(erweitert.secSegmentHistorie, umsatzMap) ??
        erweitert.secSegmentHistorie
      if (norm !== erweitert.secSegmentHistorie) {
        erweitertFinal = { ...erweitert, secSegmentHistorie: norm }
      }
    }
  }

  return leeresPaket({
    ok: true,
    quelle: altRoh ? 'yahoo' : 'macrotrends',
    ticker: ident.ticker,
    slug: ident.slug,
    firmenname: ident.firmenname,
    branche: brancheFinal,
    sektor: sektorFinal,
    website: yahooExt?.website ?? null,
    beschreibung: beschreibungDe,
    waehrung,
    perioden: merged.perioden,
    zeilen: merged.zeilen,
    keyMetrics: ergaenzeKeyMetricsAusErweitert(
      baueKeyMetrics(yahooExt, mergedRoh, schaetzungenGefiltert, kontextWerte),
      erweitertFinal,
    ),
    mantra: baueMantraAudit(
      sektorFinal,
      brancheFinal,
      yahooExt,
      rohFuerMantra(merged),
      schaetzungenGefiltert,
      yahooFinanz,
      kontextWerte,
    ),
    mantraMeta,
    news,
    symbolYahoo,
    frequenz,
    erweitert: erweitertFinal,
  })
}

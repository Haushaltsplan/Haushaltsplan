/** Orchestrierung: Marketscreener + StockAnalysis + SEC-Produkt-Fallback + Backlog. */

import 'server-only'

import type {
  SecBacklogHistorie,
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
  SecZusatzRisikoFelder,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { isinKenntnis, loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  baueUmsatzProJahrAusMacrotrends,
  loeseMacrotrendsIdent,
} from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import {
  ladeSegmentStrukturAusCloud,
  speichereSegmentStrukturInCloud,
} from '@/lib/portfolio-analyse/segment-struktur-cloud-server'
import { ladeMarketbeatBacklogHistorie } from '@/lib/portfolio-analyse/marketbeat-backlog-server'
import { ladeMarketscreenerSegmentHistorie } from '@/lib/portfolio-analyse/marketscreener-segment-historie-server'
import { ladeStockanalysisBacklogHistorie } from '@/lib/portfolio-analyse/stockanalysis-backlog-server'
import { ladeSecBacklogHistorie } from '@/lib/portfolio-analyse/sec-edgar-backlog-server'
import { cikFuerTicker } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { besteSegmentHistorieQuellen, bereinigeGeoNachProdukt, segmentPaketPlausibel } from '@/lib/portfolio-analyse/segment-historie-merge-hilfen'
import { ladeSecSegmentHistorie } from '@/lib/portfolio-analyse/sec-edgar-segment-historie-server'
import { ladeStockanalysisSegmentPaket } from '@/lib/portfolio-analyse/stockanalysis-segment-server'
import { normalisiereSegmentPaketGegenUmsatz } from '@/lib/portfolio-analyse/segment-umsatz-abgleich'
import { baueUmsatzProJahrAusYahoo } from '@/lib/portfolio-analyse/fundamentaldaten-yahoo-guv-server'

const LEER_ZUSATZ: SecZusatzRisikoFelder = {
  mitarbeiterAnzahl: null,
  auslandsumsatzAnteilPct: null,
  hauptkunden: [],
  mitarbeiterHistorie: [],
  kundenKonzentrationHistorie: [],
}

function usTicker(opts: {
  ticker?: string | null
  symbolYahoo?: string | null
}): string | null {
  for (const sym of [opts.ticker, opts.symbolYahoo]) {
    const t = sym?.trim().toUpperCase()
    if (t && !t.includes('.')) return t.split('.')[0]!
  }
  return null
}

/** Macrotrends-Ticker für Umsatz-Abgleich (auch EU/ADR mit macrotrendsTicker). */
function macrotrendsTickerFuerUmsatz(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
}): string | null {
  const isin = loesePortfolioIsin({
    isin: opts.isin,
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
    firmenname: opts.name,
  })
  const k = isin ? isinKenntnis(isin) : null
  return (
    k?.macrotrendsTicker?.trim().toUpperCase() ||
    usTicker(opts) ||
    opts.ticker?.trim().toUpperCase().split('.')[0] ||
    opts.symbolYahoo?.trim().toUpperCase().split('.')[0] ||
    null
  )
}

function leeresPaket(quelle: SecSegmentHistoriePaket['quelle'] = 'marketscreener'): SecSegmentHistoriePaket {
  return {
    produkt: null,
    geo: null,
    kategorien: [],
    zusatz: { ...LEER_ZUSATZ },
    backlog: null,
    kennzahlen: null,
    berichtJahr: null,
    anzahl10k: 0,
    geladenAm: new Date().toISOString(),
    quelle,
  }
}

function mergePakete(
  ms: SecSegmentHistoriePaket | null,
  sa: Awaited<ReturnType<typeof ladeStockanalysisSegmentPaket>>,
): SecSegmentHistoriePaket | null {
  const produkt = besteSegmentHistorieQuellen(ms?.produkt, sa?.produkt)
  let geo = besteSegmentHistorieQuellen(ms?.geo, sa?.geo)
  geo = bereinigeGeoNachProdukt(produkt, geo, sa?.geo ?? null)
  if (!produkt && !geo) return null

  const msHatProd = (ms?.produkt?.anzahlJahre ?? 0) > 0
  const msHatGeo = (ms?.geo?.anzahlJahre ?? 0) > 0
  const saHatProd = (sa?.produkt?.anzahlJahre ?? 0) > 0
  const saHatGeo = (sa?.geo?.anzahlJahre ?? 0) > 0
  const prodAusSa = produkt === sa?.produkt && saHatProd
  const geoAusSa = geo === sa?.geo && saHatGeo

  let quelle: SecSegmentHistoriePaket['quelle'] = 'marketscreener'
  if ((prodAusSa || geoAusSa) && (msHatProd || msHatGeo)) quelle = 'mixed'
  else if ((prodAusSa && !msHatProd) || (geoAusSa && !msHatGeo)) quelle = 'stockanalysis'
  else if (!msHatProd && !msHatGeo && (saHatProd || saHatGeo)) quelle = 'stockanalysis'

  const berichtJahr = Math.max(produkt?.juengstesJahr ?? 0, geo?.juengstesJahr ?? 0)
  const auslandAnteil =
    geo?.jahre.length && geo.jahre[geo.jahre.length - 1]
      ? (() => {
          const seg = geo.jahre[geo.jahre.length - 1]!.segmente
          const intl = seg.find((s) =>
            /non.?us|other countr|international|rest of|europe|asia|emea|abroad|foreign|apac/i.test(s.name),
          )
          return intl?.anteilPct ?? null
        })()
      : null

  return {
    produkt: produkt ?? null,
    geo: geo ?? null,
    kategorien: ms?.kategorien ?? [],
    zusatz: ms?.zusatz
      ? { ...ms.zusatz, auslandsumsatzAnteilPct: auslandAnteil ?? ms.zusatz.auslandsumsatzAnteilPct }
      : { ...LEER_ZUSATZ, auslandsumsatzAnteilPct: auslandAnteil },
    backlog: ms?.backlog ?? null,
    kennzahlen: ms?.kennzahlen ?? null,
    berichtJahr: berichtJahr > 0 ? berichtJahr : ms?.berichtJahr ?? null,
    anzahl10k: Math.max(produkt?.anzahlJahre ?? 0, geo?.anzahlJahre ?? 0, ms?.anzahl10k ?? 0),
    geladenAm: new Date().toISOString(),
    quelle,
  }
}

function waehleBacklog(
  sa: SecBacklogHistorie | null,
  mb: SecBacklogHistorie | null,
): SecBacklogHistorie | null {
  if (sa && mb) {
    if (sa.art === 'rpo' && mb.art !== 'rpo') return sa
    if (mb.art === 'rpo' && sa.art !== 'rpo') return mb
    return sa.anzahlJahre >= mb.anzahlJahre ? sa : mb
  }
  return sa ?? mb
}

async function ergaenzeBacklog(
  paket: SecSegmentHistoriePaket,
  opts: {
    ticker?: string | null
    symbolYahoo?: string | null
    isin?: string | null
    refresh?: boolean
  },
): Promise<SecSegmentHistoriePaket> {
  if (paket.backlog && !opts.refresh) return paket
  const ticker = usTicker(opts)
  const [mb, sa] = await Promise.all([
    ticker ? ladeMarketbeatBacklogHistorie(ticker, opts.refresh) : Promise.resolve(null),
    ladeStockanalysisBacklogHistorie({ ...opts, refresh: opts.refresh }),
  ])
  let backlog = waehleBacklog(sa, mb)

  // SEC XBRL RPO / Deferred Revenue — US-Filer, wenn SA/MB leer
  if (!backlog && ticker) {
    try {
      const cik = await cikFuerTicker(ticker)
      if (cik) {
        const sec = await ladeSecBacklogHistorie(cik)
        // Auch 1 Jahr reicht für backlogLabel (Nachkauf braucht Label + ggf. Wachstum)
        if (sec && sec.eintraege.length >= 1) backlog = sec
      }
    } catch {
      /* SEC optional */
    }
  }

  if (!backlog) return paket
  return { ...paket, backlog }
}

function anzahlProduktSegmente(historie: SecSegmentHistorie | null | undefined): number {
  return historie?.jahre.at(-1)?.segmente.length ?? 0
}

function brauchtSecProduktFallback(paket: SecSegmentHistoriePaket | null): boolean {
  return anzahlProduktSegmente(paket?.produkt ?? null) < 2
}

async function ergaenzeSecProduktFallback(
  paket: SecSegmentHistoriePaket,
  ticker: string,
): Promise<SecSegmentHistoriePaket> {
  if (!brauchtSecProduktFallback(paket)) return paket

  const sec = await ladeSecSegmentHistorie(ticker)
  if (!sec?.produkt || anzahlProduktSegmente(sec.produkt) < 2) return paket

  const geo = paket.geo ?? sec.geo ?? null
  const quelleVorher = paket.quelle
  let quelle: SecSegmentHistoriePaket['quelle'] = 'sec_edgar'
  if (geo && quelleVorher !== 'stockanalysis') quelle = 'mixed'
  else if (quelleVorher === 'mixed') quelle = 'mixed'

  const berichtJahr = Math.max(
    sec.produkt.juengstesJahr ?? 0,
    geo?.juengstesJahr ?? 0,
    paket.berichtJahr ?? 0,
  )

  return {
    ...paket,
    produkt: sec.produkt,
    geo,
    kategorien: sec.kategorien.length > 0 ? sec.kategorien : paket.kategorien,
    zusatz: {
      ...paket.zusatz,
      auslandsumsatzAnteilPct:
        paket.zusatz.auslandsumsatzAnteilPct ?? sec.zusatz.auslandsumsatzAnteilPct,
      mitarbeiterAnzahl: paket.zusatz.mitarbeiterAnzahl ?? sec.zusatz.mitarbeiterAnzahl,
      hauptkunden: paket.zusatz.hauptkunden.length > 0 ? paket.zusatz.hauptkunden : sec.zusatz.hauptkunden,
    },
    kennzahlen: paket.kennzahlen ?? sec.kennzahlen,
    berichtJahr: berichtJahr > 0 ? berichtJahr : paket.berichtJahr,
    anzahl10k: Math.max(sec.produkt.anzahlJahre, geo?.anzahlJahre ?? 0, paket.anzahl10k, sec.anzahl10k),
    quelle,
  }
}

async function ergaenzeUmsatzAbgleich(
  paket: SecSegmentHistoriePaket,
  opts: {
    isin?: string | null
    name: string
    symbolYahoo?: string | null
    ticker?: string | null
  },
): Promise<SecSegmentHistoriePaket> {
  const isin = loesePortfolioIsin({
    isin: opts.isin,
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
    firmenname: opts.name,
  })
  const k = isin ? isinKenntnis(isin) : null
  const mtTicker = macrotrendsTickerFuerUmsatz({ ...opts, isin })

  let umsatzMap = new Map<number, number>()

  if (mtTicker) {
    const ident = await loeseMacrotrendsIdent(mtTicker, {
      erwarteterTicker: mtTicker,
      firmenname: opts.name,
      slug: k?.macrotrendsSlug,
      macrotrendsTicker: k?.macrotrendsTicker,
    })
    if (ident) {
      umsatzMap = await baueUmsatzProJahrAusMacrotrends(ident)
    }
  }

  if (umsatzMap.size === 0 && opts.symbolYahoo?.trim()) {
    umsatzMap = await baueUmsatzProJahrAusYahoo(opts.symbolYahoo)
  }
  if (umsatzMap.size === 0) return paket

  return normalisiereSegmentPaketGegenUmsatz(paket, umsatzMap) ?? paket
}

async function scrapeLiveSegmentStruktur(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
  refresh?: boolean
}): Promise<SecSegmentHistoriePaket | null> {
  const isin = loesePortfolioIsin({
    isin: opts.isin,
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
    firmenname: opts.name,
  })

  const [ms, sa] = await Promise.all([
    ladeMarketscreenerSegmentHistorie({
      isin: isin ?? opts.isin,
      name: opts.name,
      symbolYahoo: opts.symbolYahoo,
      ticker: opts.ticker,
      refresh: opts.refresh,
    }),
    ladeStockanalysisSegmentPaket({
      isin: isin ?? opts.isin,
      symbolYahoo: opts.symbolYahoo,
      ticker: opts.ticker,
      refresh: opts.refresh,
    }),
  ])

  let paket = mergePakete(ms, sa)
  if (!paket) paket = leeresPaket()

  const ticker = usTicker(opts)
  if (ticker) {
    paket = await ergaenzeSecProduktFallback(paket, ticker)
  }

  paket = await ergaenzeBacklog(paket, { ...opts, isin, refresh: opts.refresh })

  paket = await ergaenzeUmsatzAbgleich(paket, { ...opts, isin })

  if (!paket.produkt && !paket.geo && !paket.backlog) return null
  return paket
}

export async function ladeGescrapteSegmentStruktur(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
  refresh?: boolean
}): Promise<SecSegmentHistoriePaket | null> {
  const isin = loesePortfolioIsin({
    isin: opts.isin,
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
    firmenname: opts.name,
  })

  if (!isin && !opts.name?.trim() && !opts.symbolYahoo && !opts.ticker) return null

  if (!opts.refresh && isin && isin.length >= 10) {
    const cloud = await ladeSegmentStrukturAusCloud(isin)
    if (
      cloud &&
      segmentPaketPlausibel(cloud, {
        ticker: opts.ticker ?? opts.symbolYahoo,
        name: opts.name,
      })
    ) {
      return ergaenzeUmsatzAbgleich(cloud, { ...opts, isin })
    }
    if (cloud) {
      console.warn(`[segment-struktur] Cloud verworfen (Plausibilität) für ${isin}`)
    }
  }

  const live = await scrapeLiveSegmentStruktur({ ...opts, isin: isin ?? opts.isin })
  if (live) {
    if (isin && isin.length >= 10) {
      await speichereSegmentStrukturInCloud({
        isin,
        ticker: opts.ticker ?? opts.symbolYahoo,
        firmenname: opts.name,
        paket: live,
      })
    }
    return live
  }

  if (isin && isin.length >= 10) {
    const cloud = await ladeSegmentStrukturAusCloud(isin)
    if (cloud) {
      console.warn(`[segment-struktur] Live-Scrape leer — Cloud-Fallback für ${isin}`)
      return ergaenzeUmsatzAbgleich(cloud, { ...opts, isin })
    }
  }

  return null
}

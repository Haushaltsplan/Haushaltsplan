/** Orchestrierung: Marketscreener Segmente + StockAnalysis-Fallback + Backlog (kein SEC). */

import 'server-only'

import type {
  SecBacklogHistorie,
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
  SecZusatzRisikoFelder,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeSegmentStrukturAusCloud,
  speichereSegmentStrukturInCloud,
} from '@/lib/portfolio-analyse/segment-struktur-cloud-server'
import { ladeMarketbeatBacklogHistorie } from '@/lib/portfolio-analyse/marketbeat-backlog-server'
import { ladeMarketscreenerSegmentHistorie } from '@/lib/portfolio-analyse/marketscreener-segment-historie-server'
import { ladeStockanalysisBacklogHistorie } from '@/lib/portfolio-analyse/stockanalysis-backlog-server'
import { besteSegmentHistorieQuellen } from '@/lib/portfolio-analyse/segment-historie-merge-hilfen'
import { ladeStockanalysisSegmentPaket } from '@/lib/portfolio-analyse/stockanalysis-segment-server'

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
  const geo = besteSegmentHistorieQuellen(ms?.geo, sa?.geo)
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
  const backlog = waehleBacklog(sa, mb)
  if (!backlog) return paket
  return { ...paket, backlog }
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

  paket = await ergaenzeBacklog(paket, { ...opts, isin, refresh: opts.refresh })

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
    if (cloud) return cloud
  }

  const live = await scrapeLiveSegmentStruktur({ ...opts, isin: isin ?? opts.isin })
  if (live) {
    if (isin && isin.length >= 10) {
      void speichereSegmentStrukturInCloud({
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
      return cloud
    }
  }

  return null
}

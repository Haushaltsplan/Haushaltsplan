/** Orchestrierung: Marketscreener Segmente + StockAnalysis-Fallback + Backlog (kein SEC). */

import 'server-only'

import type {
  SecSegmentHistoriePaket,
  SecZusatzRisikoFelder,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeMarketbeatBacklogHistorie } from '@/lib/portfolio-analyse/marketbeat-backlog-server'
import { ladeMarketscreenerSegmentHistorie } from '@/lib/portfolio-analyse/marketscreener-segment-historie-server'
import { ladeStockanalysisBacklogHistorie } from '@/lib/portfolio-analyse/stockanalysis-backlog-server'
import { ladeStockanalysisSegmentHistorie } from '@/lib/portfolio-analyse/stockanalysis-segment-server'

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
  saProdukt: Awaited<ReturnType<typeof ladeStockanalysisSegmentHistorie>>,
): SecSegmentHistoriePaket | null {
  if (!ms && !saProdukt) return null

  const produkt = ms?.produkt ?? saProdukt
  const geo = ms?.geo ?? null
  if (!produkt && !geo) return ms ? { ...ms, produkt: null, geo: null } : null

  let quelle: SecSegmentHistoriePaket['quelle'] = 'marketscreener'
  if (ms && saProdukt && !ms.produkt) quelle = 'mixed'
  else if (!ms && saProdukt) quelle = 'stockanalysis'

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
    geo,
    kategorien: ms?.kategorien ?? [],
    zusatz: ms?.zusatz ? { ...ms.zusatz, auslandsumsatzAnteilPct: auslandAnteil ?? ms.zusatz.auslandsumsatzAnteilPct } : { ...LEER_ZUSATZ, auslandsumsatzAnteilPct: auslandAnteil },
    backlog: ms?.backlog ?? null,
    kennzahlen: ms?.kennzahlen ?? null,
    berichtJahr: berichtJahr > 0 ? berichtJahr : ms?.berichtJahr ?? null,
    anzahl10k: Math.max(produkt?.anzahlJahre ?? 0, geo?.anzahlJahre ?? 0, ms?.anzahl10k ?? 0),
    geladenAm: new Date().toISOString(),
    quelle,
  }
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
  const backlog = sa && mb ? (sa.anzahlJahre >= mb.anzahlJahre ? sa : mb) : sa ?? mb
  if (!backlog) return paket
  return { ...paket, backlog }
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

  const ticker = usTicker(opts)
  const [ms, saProdukt] = await Promise.all([
    ladeMarketscreenerSegmentHistorie({
      isin: isin ?? opts.isin,
      name: opts.name,
      symbolYahoo: opts.symbolYahoo,
      ticker: opts.ticker,
      refresh: opts.refresh,
    }),
    ticker
      ? ladeStockanalysisSegmentHistorie({
          ticker,
          symbolYahoo: opts.symbolYahoo,
          isin: isin ?? opts.isin,
          refresh: opts.refresh,
        })
      : Promise.resolve(null),
  ])

  let paket = mergePakete(ms, saProdukt)
  if (!paket) paket = leeresPaket()

  paket = await ergaenzeBacklog(paket, { ...opts, isin, refresh: opts.refresh })

  if (!paket.produkt && !paket.geo && !paket.backlog) return null
  return paket
}

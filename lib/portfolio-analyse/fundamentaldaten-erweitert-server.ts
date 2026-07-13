/** Orchestriert Tier-1–3-Erweiterungen für Fundamentaldaten. */

import 'server-only'

import { ladeArbeitgeberBewertung } from '@/lib/portfolio-analyse/arbeitgeber-bewertung-server'
import { ladeDividendenHistorieStat } from '@/lib/portfolio-analyse/fundamentaldaten-dividenden-historie-server'
import type { FundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { ladeEuFundamentalAusCloud, speichereEuFundamentalInCloud } from '@/lib/portfolio-analyse/eu-fundamental-cloud-server'
import { ladeInsiderNettoHandel } from '@/lib/portfolio-analyse/fundamentaldaten-insider-netto-server'
import { ladeEarningsBeatMissHistorie } from '@/lib/portfolio-analyse/earnings-beat-miss-historie-server'
import { ladeEuFundamentalKennzahlen } from '@/lib/portfolio-analyse/marketscreener-fundamental-kennzahlen-server'
import { ladeFinvizKennzahlen } from '@/lib/portfolio-analyse/finviz-kennzahlen-server'
import { ladeGescrapteSegmentStruktur } from '@/lib/portfolio-analyse/segment-struktur-scraper-server'
import { ladeSegmentStrukturAusCloud } from '@/lib/portfolio-analyse/segment-struktur-cloud-server'
import { ladeSecStrukturExtraktion } from '@/lib/portfolio-analyse/sec-edgar-struktur-server'
import { ladeYahooHolders } from '@/lib/portfolio-analyse/yahoo-holders-server'
import { ladeYahooOptionsIv } from '@/lib/portfolio-analyse/yahoo-options-iv-server'

function istEuIsin(isin: string | null | undefined): boolean {
  const i = isin?.trim().toUpperCase() ?? ''
  return i.startsWith('DE') || i.startsWith('NL') || i.startsWith('FR') || i.startsWith('CH') || i.startsWith('GB')
}

export async function ladeFundamentaldatenErweitert(
  opts: {
    ticker: string
    symbolYahoo: string | null
    isin: string | null
    firmenname: string
    /** Segment-Historie aus segment_struktur_cache (lokal vorgewärmt), kein Live-Scrape. */
    segmentNurCloud?: boolean
  },
): Promise<FundamentaldatenErweitert> {
  const ticker = opts.ticker.trim().toUpperCase()
  const symbol = opts.symbolYahoo?.trim() || ticker
  const isin = opts.isin?.trim().toUpperCase() ?? ''
  const isEu = istEuIsin(isin)

  const segmentPromise =
    isin.length >= 10 && opts.segmentNurCloud
      ? ladeSegmentStrukturAusCloud(isin)
      : isin.length >= 10 || (!ticker.includes('.') && Boolean(symbol))
        ? ladeGescrapteSegmentStruktur({
            isin: isin || null,
            name: opts.firmenname,
            symbolYahoo: symbol,
            ticker,
          })
        : Promise.resolve(null)

  const [
    dividenden,
    holders,
    finvizRaw,
    insiderNetto,
    beatMissRaw,
    secStruktur,
    secSegmentHistorie,
    euFundamentalCloud,
    optionsIv,
    arbeitgeber,
  ] = await Promise.all([
    isin.length >= 10 ? ladeDividendenHistorieStat(isin, opts.firmenname) : Promise.resolve(null),
    symbol ? ladeYahooHolders(symbol) : Promise.resolve(null),
    symbol && !symbol.includes('.') ? ladeFinvizKennzahlen(symbol) : Promise.resolve(null),
    !ticker.includes('.') ? ladeInsiderNettoHandel(ticker) : Promise.resolve(null),
    ticker ? ladeEarningsBeatMissHistorie({ ticker, symbolYahoo: symbol, isin, limit: 8 }) : Promise.resolve(null),
    !ticker.includes('.') ? ladeSecStrukturExtraktion(ticker) : Promise.resolve(null),
    segmentPromise,
    isEu && isin.length >= 10 ? ladeEuFundamentalAusCloud(isin) : Promise.resolve(null),
    symbol && !symbol.includes('.') ? ladeYahooOptionsIv(symbol) : Promise.resolve(null),
    opts.firmenname.trim() ? ladeArbeitgeberBewertung(opts.firmenname, isEu) : Promise.resolve(null),
  ])

  // EU-Kennzahlen: Cloud-Cache bevorzugen; wenn leer (z. B. lokal), live scrapen und speichern.
  let euFundamental = euFundamentalCloud
  if (!euFundamental && isEu && isin.length >= 10) {
    euFundamental = await ladeEuFundamentalKennzahlen(isin, opts.firmenname, symbol)
    if (euFundamental) {
      await speichereEuFundamentalInCloud({
        isin,
        ticker,
        firmenname: opts.firmenname,
        paket: euFundamental,
      })
    }
  }

  const finviz = finvizRaw
    ? {
        shortFloatPct: finvizRaw.shortFloatPct,
        shortRatio: finvizRaw.shortRatio,
        rsi14: finvizRaw.rsi14,
        relVolume: finvizRaw.relVolume,
        insiderOwnershipPct: finvizRaw.insiderOwnershipPct,
        institutionalOwnershipPct: finvizRaw.institutionalOwnershipPct,
        peg: finvizRaw.peg,
        quelle: 'finviz' as const,
      }
    : null

  const beatMiss =
    beatMissRaw?.ok
      ? {
          agg12: beatMissRaw.agg12 ?? null,
          agg20: beatMissRaw.agg20 ?? null,
          streak: beatMissRaw.streak ?? null,
          epsBeatRatePct: beatMissRaw.epsBeatRatePct,
          umsatzBeatRatePct: beatMissRaw.umsatzBeatRatePct,
        }
      : null

  return {
    dividenden,
    holders,
    finviz,
    insiderNetto,
    beatMiss,
    secStruktur,
    secSegmentHistorie,
    euFundamental,
    optionsIv,
    arbeitgeber,
    geladenAm: new Date().toISOString(),
  }
}

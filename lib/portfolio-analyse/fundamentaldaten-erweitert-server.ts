/** Orchestriert Tier-1–3-Erweiterungen für Fundamentaldaten. */

import 'server-only'

import { ladeArbeitgeberBewertung } from '@/lib/portfolio-analyse/arbeitgeber-bewertung-server'
import { ladeDividendenHistorieStat } from '@/lib/portfolio-analyse/fundamentaldaten-dividenden-historie-server'
import type { FundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { ladeEuFundamentalAusCloud, speichereEuFundamentalInCloud } from '@/lib/portfolio-analyse/eu-fundamental-cloud-server'
import { ladeInsiderNettoHandel } from '@/lib/portfolio-analyse/fundamentaldaten-insider-netto-server'
import { ladeEuInsiderNettoAggregiert } from '@/lib/portfolio-analyse/eu-insider-aggregate-server'
import { ladeEuUrdNotes } from '@/lib/portfolio-analyse/eu-urd-notes-server'
import { ladeEarningsBeatMissHistorie } from '@/lib/portfolio-analyse/earnings-beat-miss-historie-server'
import { ladeEuFundamentalKennzahlen } from '@/lib/portfolio-analyse/marketscreener-fundamental-kennzahlen-server'
import { ladeFinvizKennzahlen } from '@/lib/portfolio-analyse/finviz-kennzahlen-server'
import { ladeGescrapteSegmentStruktur } from '@/lib/portfolio-analyse/segment-struktur-scraper-server'
import { ladeSegmentStrukturAusCloud } from '@/lib/portfolio-analyse/segment-struktur-cloud-server'
import { ladeSecStrukturExtraktion } from '@/lib/portfolio-analyse/sec-edgar-struktur-server'
import {
  ladeDebtMaturityProfil,
  ladeRdKapitalisierung,
} from '@/lib/portfolio-analyse/sec-edgar-debt-rd-server'
import { ladeYahooHolders } from '@/lib/portfolio-analyse/yahoo-holders-server'
import { ladeYahooOptionsIv } from '@/lib/portfolio-analyse/yahoo-options-iv-server'
import { ladeSecBacklogHistorie } from '@/lib/portfolio-analyse/sec-edgar-backlog-server'
import { cikFuerTicker } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { istEuIsin } from '@/lib/portfolio-analyse/eu-portfolio-ir-config'
import type {
  InsiderNettoPaket,
  SecSegmentHistoriePaket,
  SecStrukturPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

function secStrukturAusSegmentHistorie(hist: SecSegmentHistoriePaket | null): SecStrukturPaket | null {
  if (!hist) return null
  const produktJahre = hist.produkt?.jahre ?? []
  const geoJahre = hist.geo?.jahre ?? []
  const letztesProdukt = [...produktJahre].sort((a, b) => b.jahr - a.jahr)[0]
  const letztesGeo = [...geoJahre].sort((a, b) => b.jahr - a.jahr)[0]
  const segmenteProdukt = letztesProdukt?.segmente ?? []
  const segmenteGeo = letztesGeo?.segmente ?? []
  const segmente = segmenteProdukt.length > 0 ? segmenteProdukt : segmenteGeo
  if (segmente.length === 0) return null
  const artRoh = hist.produkt?.art ?? hist.geo?.art ?? null
  const segmentArt: SecStrukturPaket['segmentArt'] =
    artRoh === 'produkt' || artRoh === 'geo' ? artRoh : null
  return {
    segmente,
    segmenteProdukt,
    segmenteGeo,
    segmentHinweis: null,
    segmentArt,
    pensionVerpflichtungMio: null,
    leaseVerpflichtungMio: null,
    ceoVerguetungUsd: null,
    proxyJahr: null,
    berichtJahr: letztesProdukt?.jahr ?? letztesGeo?.jahr ?? null,
    quelle: 'sec_edgar',
  }
}

async function ladeInsiderNettoMitEuFallback(opts: {
  ticker: string
  symbol: string
  isin: string
  firmenname: string
  isEu: boolean
}): Promise<InsiderNettoPaket | null> {
  const usTicker = opts.symbol.includes('.') ? opts.ticker.replace(/\..*$/, '') : opts.symbol
  // US/ADR: Form 4 + OpenInsider (GOOG↔GOOGL Alias intern)
  if (!opts.symbol.includes('.') || /^[A-Z]{1,5}$/.test(usTicker)) {
    const us = await ladeInsiderNettoHandel(usTicker === 'RMS' ? 'HESAY' : usTicker)
    if (us && (us.kaeufe90d > 0 || us.verkaeufe90d > 0 || us.nettoRichtung != null)) {
      return us
    }
  }

  if (!opts.isEu || opts.isin.length < 10) return null

  return ladeEuInsiderNettoAggregiert({
    ticker: opts.ticker,
    isin: opts.isin,
    firmenname: opts.firmenname,
  })
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
      ? (async (): Promise<SecSegmentHistoriePaket | null> => {
          const cloud = await ladeSegmentStrukturAusCloud(isin)
          // Backlog/RPO nachladen wenn Cloud-Eintrag ohne Backlog (Nachkauf-Scan)
          if (cloud?.backlog) return cloud
          const bare = (symbol.includes('.') ? symbol.split('.')[0]! : symbol || ticker).toUpperCase()
          if (!bare || bare.length > 5) return cloud
          try {
            const cik = await cikFuerTicker(bare)
            if (!cik) return cloud
            const backlog = await ladeSecBacklogHistorie(cik)
            if (!backlog) return cloud
            if (!cloud) {
              return {
                produkt: null,
                geo: null,
                kategorien: [],
                zusatz: {
                  mitarbeiterAnzahl: null,
                  auslandsumsatzAnteilPct: null,
                  hauptkunden: [],
                  mitarbeiterHistorie: [],
                  kundenKonzentrationHistorie: [],
                },
                kennzahlen: null,
                backlog,
                berichtJahr: backlog.juengstesJahr,
                anzahl10k: backlog.anzahlJahre,
                geladenAm: new Date().toISOString(),
                quelle: 'sec_edgar',
              }
            }
            return { ...cloud, backlog }
          } catch {
            return cloud
          }
        })()
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
    secStrukturRaw,
    secSegmentHistorie,
    euFundamentalCloud,
    optionsIv,
    arbeitgeber,
  ] = await Promise.all([
    isin.length >= 10 ? ladeDividendenHistorieStat(isin, opts.firmenname) : Promise.resolve(null),
    symbol ? ladeYahooHolders(symbol) : Promise.resolve(null),
    symbol && !symbol.includes('.') ? ladeFinvizKennzahlen(symbol) : Promise.resolve(null),
    ladeInsiderNettoMitEuFallback({
      ticker,
      symbol,
      isin,
      firmenname: opts.firmenname,
      isEu,
    }),
    ticker ? ladeEarningsBeatMissHistorie({ ticker, symbolYahoo: symbol, isin, limit: 8 }) : Promise.resolve(null),
    // ASML (NL) = 20-F; US = 10-K; Ticker ohne Punkt oder ADR-Basis
    !symbol.includes('.') || isEu
      ? ladeSecStrukturExtraktion(symbol.includes('.') ? ticker.replace(/\..*$/, '') : symbol)
      : Promise.resolve(null),
    segmentPromise,
    isEu && isin.length >= 10 ? ladeEuFundamentalAusCloud(isin) : Promise.resolve(null),
    symbol && !symbol.includes('.') ? ladeYahooOptionsIv(symbol) : Promise.resolve(null),
    opts.firmenname.trim() ? ladeArbeitgeberBewertung(opts.firmenname, isEu) : Promise.resolve(null),
  ])

  const secTicker = symbol.includes('.') ? ticker.replace(/\..*$/, '') : symbol
  const [debtMaturitySec, rdKapitalisierungSec] = await Promise.all([
    !secTicker.includes('.') ? ladeDebtMaturityProfil(secTicker).catch(() => null) : Promise.resolve(null),
    !secTicker.includes('.') ? ladeRdKapitalisierung(secTicker).catch(() => null) : Promise.resolve(null),
  ])

  // EU URD/IR: Debt-Maturity, F&E-Aktivierung, Kunden — wenn SEC-XBRL leer
  let debtMaturity = debtMaturitySec
  let rdKapitalisierung = rdKapitalisierungSec
  let secSegmentHistorieMerged = secSegmentHistorie
  if (
    isEu &&
    isin.length >= 10 &&
    (!debtMaturity || !rdKapitalisierung || !(secSegmentHistorie?.zusatz?.hauptkunden?.length))
  ) {
    const urd = await ladeEuUrdNotes({
      isin,
      ticker,
      firmenname: opts.firmenname,
    }).catch(() => null)
    if (urd) {
      if (!debtMaturity && urd.debtMaturity) debtMaturity = urd.debtMaturity
      if (!rdKapitalisierung && urd.rdKapitalisierung) rdKapitalisierung = urd.rdKapitalisierung
      if (urd.hauptkunden.length > 0) {
        const bestehend = secSegmentHistorieMerged?.zusatz?.hauptkunden ?? []
        if (bestehend.length === 0) {
          secSegmentHistorieMerged = secSegmentHistorieMerged
            ? {
                ...secSegmentHistorieMerged,
                zusatz: {
                  ...secSegmentHistorieMerged.zusatz,
                  hauptkunden: urd.hauptkunden,
                },
              }
            : {
                produkt: null,
                geo: null,
                kategorien: [],
                zusatz: {
                  mitarbeiterAnzahl: null,
                  auslandsumsatzAnteilPct: null,
                  hauptkunden: urd.hauptkunden,
                  mitarbeiterHistorie: [],
                  kundenKonzentrationHistorie: [],
                },
                kennzahlen: null,
                backlog: null,
                berichtJahr: urd.debtMaturity?.jahr ?? null,
                anzahl10k: 0,
                geladenAm: new Date().toISOString(),
                quelle: 'eu_urd' as const,
              }
        }
      }
    }
  }

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

  const secStruktur =
    secStrukturRaw ?? secStrukturAusSegmentHistorie(secSegmentHistorieMerged)

  return {
    dividenden,
    holders,
    finviz,
    insiderNetto,
    beatMiss,
    secStruktur,
    secSegmentHistorie: secSegmentHistorieMerged,
    euFundamental,
    optionsIv,
    arbeitgeber,
    debtMaturity,
    rdKapitalisierung,
    geladenAm: new Date().toISOString(),
  }
}

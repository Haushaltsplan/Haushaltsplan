/** Orchestrierung: US → nur SEC EDGAR; EU → Marketscreener + StockAnalysis; Backlog. */

import 'server-only'

import type {
  SecBacklogHistorie,
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
  SecZusatzRisikoFelder,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { brauchtEuGuVFallback } from '@/lib/portfolio-analyse/eu-portfolio-ir-config'
import {
  analyseTickerFuerPosition,
  isinKenntnis,
  loesePortfolioIsin,
} from '@/lib/portfolio-analyse/isin-kenntnisse'
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
import {
  besteSegmentHistorieQuellen,
  bereinigeGeoNachProdukt,
  segmentPaketPlausibel,
} from '@/lib/portfolio-analyse/segment-historie-merge-hilfen'
import { ladeSecSegmentHistorie } from '@/lib/portfolio-analyse/sec-edgar-segment-historie-server'
import { segmentMargeAbdeckung } from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'
import { ergaenzeSegmentHistorieMitMargen } from '@/lib/portfolio-analyse/segment-margen-hilfen'
import { ladeStockanalysisSegmentPaket } from '@/lib/portfolio-analyse/stockanalysis-segment-server'
import {
  normalisiereSegmentPaketGegenUmsatz,
  repariereSegmentPaket,
} from '@/lib/portfolio-analyse/segment-umsatz-abgleich'
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

/** Bare-US-Ticker für SEC (inkl. macrotrendsTicker / Analyse-Ticker). */
function secTickerFuerPosition(opts: {
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
  const kandidaten = [
    k?.macrotrendsTicker?.trim().toUpperCase(),
    analyseTickerFuerPosition(isin, opts.symbolYahoo ?? opts.ticker),
    usTicker(opts),
    opts.ticker?.trim().toUpperCase().split('.')[0],
    opts.symbolYahoo?.trim().toUpperCase().split('.')[0],
  ]
  for (const t of kandidaten) {
    const bare = t?.trim().toUpperCase()
    if (bare && !bare.includes('.') && /^[A-Z0-9]{1,6}$/.test(bare)) return bare
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

/**
 * US-Pfad wie GuV: kein EU-Fallback und resolvierbarer Bare-Ticker.
 * Ohne ISIN, aber Bare-US-Ticker → ebenfalls SEC-first (CIK-Check später).
 */
function istUsSegmentPfad(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
}): { us: boolean; ticker: string | null } {
  const isin = loesePortfolioIsin({
    isin: opts.isin,
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
    firmenname: opts.name,
  })
  const ticker = secTickerFuerPosition({ ...opts, isin })
  if (!ticker) return { us: false, ticker: null }
  if (isin && brauchtEuGuVFallback(isin)) return { us: false, ticker }
  return { us: true, ticker }
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

function anzahlProduktSegmente(historie: SecSegmentHistorie | null | undefined): number {
  return historie?.jahre.at(-1)?.segmente.length ?? 0
}

function auslandAnteilAusGeo(geo: SecSegmentHistorie | null): number | null {
  if (!geo?.jahre.length) return null
  const seg = geo.jahre[geo.jahre.length - 1]!.segmente
  const intl = seg.find((s) =>
    /non.?us|other countr|international|rest of|europe|asia|emea|abroad|foreign|apac/i.test(s.name),
  )
  return intl?.anteilPct ?? null
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
  const auslandAnteil = auslandAnteilAusGeo(geo)

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

async function ladeSecBacklogFuerTicker(ticker: string): Promise<SecBacklogHistorie | null> {
  try {
    const cik = await cikFuerTicker(ticker)
    if (!cik) return null
    const sec = await ladeSecBacklogHistorie(cik)
    // Auch 1 Jahr reicht für backlogLabel (Nachkauf braucht Label + ggf. Wachstum)
    return sec && sec.eintraege.length >= 1 ? sec : null
  } catch {
    return null
  }
}

async function ergaenzeBacklog(
  paket: SecSegmentHistoriePaket,
  opts: {
    ticker?: string | null
    symbolYahoo?: string | null
    isin?: string | null
    name?: string | null
    refresh?: boolean
  },
): Promise<SecSegmentHistoriePaket> {
  if (paket.backlog && !opts.refresh) return paket

  const { us, ticker: secTicker } = istUsSegmentPfad({
    isin: opts.isin,
    name: opts.name ?? '',
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
  })
  const ticker = secTicker ?? usTicker(opts)

  let backlog: SecBacklogHistorie | null = null

  // US: SEC XBRL RPO / Backlog / Deferred Revenue zuerst
  if (us && ticker) {
    backlog = await ladeSecBacklogFuerTicker(ticker)
  }

  // Non-US: Marketbeat / StockAnalysis, dann SEC als Fallback
  if (!backlog && !us) {
    const [mb, sa] = await Promise.all([
      ticker ? ladeMarketbeatBacklogHistorie(ticker, opts.refresh) : Promise.resolve(null),
      ladeStockanalysisBacklogHistorie({ ...opts, refresh: opts.refresh }),
    ])
    backlog = waehleBacklog(sa, mb)
  }

  if (!backlog && !us && ticker) {
    backlog = await ladeSecBacklogFuerTicker(ticker)
  }

  if (!backlog) return paket
  return { ...paket, backlog }
}

function brauchtSecProduktFallback(paket: SecSegmentHistoriePaket | null): boolean {
  return anzahlProduktSegmente(paket?.produkt ?? null) < 2
}

/** EU-Notfall: SEC nur wenn MS/SA &lt; 2 Produktsegmente. */
async function ergaenzeSecProduktFallback(
  paket: SecSegmentHistoriePaket,
  ticker: string,
): Promise<SecSegmentHistoriePaket> {
  if (!brauchtSecProduktFallback(paket)) return paket

  let sec: SecSegmentHistoriePaket | null
  try {
    sec = await ladeSecSegmentHistorie(ticker)
  } catch {
    return paket
  }
  if (!sec?.produkt || anzahlProduktSegmente(sec.produkt) < 2) return paket

  const geo = paket.geo ?? sec.geo ?? null
  const quelleVorher = paket.quelle
  let quelle: SecSegmentHistoriePaket['quelle'] = 'sec_edgar'
  let secErgaenzt = false
  if (geo && (quelleVorher === 'marketscreener' || quelleVorher === 'stockanalysis' || quelleVorher === 'mixed')) {
    quelle = 'mixed'
    secErgaenzt = true
  } else if (quelleVorher === 'mixed') {
    quelle = 'mixed'
    secErgaenzt = true
  }

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
    ...(secErgaenzt ? { secErgaenzt: true } : {}),
  }
}

/** Wenn SEC-Umsatzmix kaum Margen hat: OI von StockAnalysis dazumischen. */
async function ergaenzeUsMargenAusStockanalysis(
  paket: SecSegmentHistoriePaket,
  opts: {
    isin?: string | null
    symbolYahoo?: string | null
    ticker?: string | null
    refresh?: boolean
  },
): Promise<SecSegmentHistoriePaket> {
  const prodCov = segmentMargeAbdeckung(paket.produkt)
  const geoCov = segmentMargeAbdeckung(paket.geo)
  if (prodCov >= 0.5 || geoCov >= 0.5) return paket

  let sa: Awaited<ReturnType<typeof ladeStockanalysisSegmentPaket>> = null
  try {
    sa = await ladeStockanalysisSegmentPaket({
      isin: opts.isin,
      symbolYahoo: opts.symbolYahoo,
      ticker: opts.ticker,
      refresh: opts.refresh,
    })
  } catch {
    return paket
  }
  if (!sa?.produkt && !sa?.geo) return paket

  let produkt = paket.produkt
  let geo = paket.geo
  let gemischt = false

  if (sa.produkt && segmentMargeAbdeckung(sa.produkt) > prodCov) {
    const saCov = segmentMargeAbdeckung(sa.produkt)
    if (produkt) {
      const mit = ergaenzeSegmentHistorieMitMargen(produkt, sa.produkt)
      const mitCov = segmentMargeAbdeckung(mit)
      // Feine SEC-Disaggregation ohne OI → lieber SA-Reporting mit echten Margen
      if (saCov >= 0.5 && mitCov < 0.5) {
        produkt = sa.produkt
        gemischt = true
      } else if (mitCov > prodCov) {
        produkt = mit
        gemischt = true
      }
    } else if (saCov >= 0.5) {
      produkt = sa.produkt
      gemischt = true
    }
  }
  if (geo && sa.geo && segmentMargeAbdeckung(sa.geo) > geoCov) {
    const mit = ergaenzeSegmentHistorieMitMargen(geo, sa.geo)
    if (segmentMargeAbdeckung(mit) > geoCov) {
      geo = mit
      gemischt = true
    }
  } else if (!geo && sa.geo && segmentMargeAbdeckung(sa.geo) >= 0.5) {
    geo = sa.geo
    gemischt = true
  }

  if (!gemischt) return paket
  return {
    ...paket,
    produkt,
    geo,
    quelle: 'mixed',
    secErgaenzt: true,
  }
}

async function ladeMssaPaket(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
  refresh?: boolean
}): Promise<SecSegmentHistoriePaket | null> {
  const [ms, sa] = await Promise.all([
    ladeMarketscreenerSegmentHistorie({
      isin: opts.isin,
      name: opts.name,
      symbolYahoo: opts.symbolYahoo,
      ticker: opts.ticker,
      refresh: opts.refresh,
    }),
    ladeStockanalysisSegmentPaket({
      isin: opts.isin,
      symbolYahoo: opts.symbolYahoo,
      ticker: opts.ticker,
      refresh: opts.refresh,
    }),
  ])
  return mergePakete(ms, sa)
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

  const { us, ticker: secTicker } = istUsSegmentPfad({ ...opts, isin })

  let paket: SecSegmentHistoriePaket | null = null

  if (us && secTicker) {
    let cikOk = false
    try {
      cikOk = Boolean(await cikFuerTicker(secTicker))
    } catch {
      cikOk = false
    }

    if (cikOk) {
      let sec: SecSegmentHistoriePaket | null = null
      try {
        sec = await ladeSecSegmentHistorie(secTicker)
      } catch {
        sec = null
      }
      // US: Segmentumsatz aus SEC; Margen ggf. mit StockAnalysis-OI ergänzen
      if (sec) {
        paket = { ...sec, quelle: 'sec_edgar', geladenAm: new Date().toISOString() }
        paket = await ergaenzeUsMargenAusStockanalysis(paket, {
          isin: isin ?? opts.isin,
          symbolYahoo: opts.symbolYahoo,
          ticker: opts.ticker ?? secTicker,
          refresh: opts.refresh,
        })
      } else {
        paket = leeresPaket('sec_edgar')
      }
    }
  }

  // EU (oder US ohne CIK): Marketscreener + StockAnalysis
  if (!paket && !us) {
    paket = await ladeMssaPaket({
      isin: isin ?? opts.isin,
      name: opts.name,
      symbolYahoo: opts.symbolYahoo,
      ticker: opts.ticker,
      refresh: opts.refresh,
    })
    if (!paket) paket = leeresPaket()

    const fallbackTicker = secTicker ?? usTicker(opts)
    if (fallbackTicker) {
      paket = await ergaenzeSecProduktFallback(paket, fallbackTicker)
    }
  }

  if (!paket) {
    paket = leeresPaket(us ? 'sec_edgar' : 'marketscreener')
  }

  paket = await ergaenzeBacklog(paket, {
    ...opts,
    isin,
    name: opts.name,
    refresh: opts.refresh,
  })

  paket = await ergaenzeUmsatzAbgleich(paket, { ...opts, isin })
  paket = repariereSegmentPaket(paket) ?? paket

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
      const fixed = repariereSegmentPaket(cloud) ?? cloud
      return ergaenzeUmsatzAbgleich(fixed, { ...opts, isin })
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

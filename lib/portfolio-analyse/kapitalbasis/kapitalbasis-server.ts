/**
 * Kapitalbasis laden: alle Quellen parallel holen, feldweise mergen, Kapitalgrößen ableiten.
 *
 * Rangfolge: SEC XBRL (auch 20-F, also inklusive ASML) → Yahoo → StockAnalysis → Macrotrends.
 * Für Titel ohne SEC-Registrierung — Hermès, Sika, Straumann, Halma, Wolters Kluwer,
 * Couche-Tard — trägt Yahoo das Grundgerüst, StockAnalysis füllt Felder, und Macrotrends
 * verlängert die Historie auf die für das ROIIC-Fenster nötigen sieben Jahre.
 */

import 'server-only'

import { cikFuerTicker } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { yahooKennzahlenSymbolKandidaten } from '@/lib/portfolio-analyse/yahoo-kennzahlen-fallback-server'
import { baueAbleitungen } from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-ableitung'
import {
  mergeKapitalbasis,
  type QuellenBeitrag,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-merge'
import {
  KAPITALBASIS_ROHFELDER,
  type KapitalbasisRohfeld,
  type KapitalbasisSerie,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'
import { ladeMacrotrendsKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/macrotrends-kapitalbasis-server'
import { ladeSecKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/sec-xbrl-serie-server'
import { ladeStockanalysisKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/stockanalysis-kapitalbasis-server'
import { ladeYahooKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/yahoo-kapitalbasis-server'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: KapitalbasisSerie | null }>()

export type KapitalbasisAnfrage = {
  symbolYahoo: string
  isin?: string | null
  ticker?: string | null
  firmenname?: string | null
  /** Bekannte SEC-CIK (Whitelist) — spart die Ticker-Auflösung. */
  cik?: string | number | null
}

function basisSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().split('.')[0] ?? ''
}

/**
 * Berichtswährung, wenn keine Quelle sie mitliefert. Yahoo, StockAnalysis und Macrotrends
 * geben bei Nicht-US-Titeln nur Zahlen ohne Währungsangabe zurück — ohne diese Ableitung
 * stünde in der Serie „lokal", was in der Anzeige und bei Vergleichen unbrauchbar ist.
 */
function waehrungAusIsin(isin: string | null | undefined): string | null {
  const land = isin?.trim().toUpperCase().slice(0, 2)
  if (!land) return null
  const map: Record<string, string> = {
    US: 'USD',
    CA: 'CAD',
    GB: 'GBP',
    CH: 'CHF',
    JP: 'JPY',
    DK: 'DKK',
    SE: 'SEK',
    NO: 'NOK',
    AU: 'AUD',
  }
  if (map[land]) return map[land]!
  const euro = ['FR', 'NL', 'DE', 'IE', 'IT', 'ES', 'BE', 'FI', 'AT', 'PT', 'LU']
  return euro.includes(land) ? 'EUR' : null
}

async function loeseCik(anfrage: KapitalbasisAnfrage): Promise<number | null> {
  if (anfrage.cik != null && anfrage.cik !== '') {
    const n = Number(anfrage.cik)
    if (Number.isFinite(n) && n > 0) return n
  }
  for (const kandidat of [anfrage.ticker, anfrage.symbolYahoo]) {
    if (!kandidat) continue
    const cik = await cikFuerTicker(basisSymbol(kandidat))
    if (cik != null) return cik
  }
  return null
}

export async function ladeKapitalbasis(
  anfrage: KapitalbasisAnfrage,
): Promise<KapitalbasisSerie | null> {
  const schluessel = `${anfrage.symbolYahoo}|${anfrage.isin ?? ''}`
  const hit = cache.get(schluessel)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const merke = (data: KapitalbasisSerie | null) => {
    cache.set(schluessel, { at: Date.now(), data })
    return data
  }

  const cik = await loeseCik(anfrage)

  // Das Depot-Symbol taugt nicht immer für Fundamentaldaten: Halma steht als `H11.SG`
  // (Stuttgart) im Bestand, Yahoo führt Bilanzdaten aber nur zur Heimatnotierung.
  const yahooKandidaten = yahooKennzahlenSymbolKandidaten({
    symbolYahoo: anfrage.symbolYahoo,
    isin: anfrage.isin,
  })

  const [sec, yahoo, stockanalysis, macrotrends] = await Promise.all([
    cik != null ? ladeSecKapitalbasis(cik) : Promise.resolve(null),
    ladeYahooKapitalbasis(yahooKandidaten.length > 0 ? yahooKandidaten : [anfrage.symbolYahoo]),
    ladeStockanalysisKapitalbasis({
      symbolYahoo: anfrage.symbolYahoo,
      isin: anfrage.isin,
      ticker: anfrage.ticker,
      firmenname: anfrage.firmenname,
    }),
    ladeMacrotrendsKapitalbasis({
      symbolYahoo: anfrage.symbolYahoo,
      isin: anfrage.isin,
      firmenname: anfrage.firmenname,
    }),
  ])

  const beitraege: QuellenBeitrag[] = []
  if (sec) beitraege.push({ quelle: 'sec_xbrl', jahre: sec.jahre })
  if (yahoo) beitraege.push({ quelle: 'yahoo', jahre: yahoo.jahre })
  if (stockanalysis) beitraege.push({ quelle: 'stockanalysis', jahre: stockanalysis.jahre })
  if (macrotrends) beitraege.push({ quelle: 'macrotrends', jahre: macrotrends.jahre })
  if (beitraege.length === 0) return merke(null)

  const merged = mergeKapitalbasis(beitraege)
  if (merged.jahre.length < 2) return merke(null)

  const fehlendeFelder: KapitalbasisRohfeld[] = KAPITALBASIS_ROHFELDER.filter(
    (feld) => !merged.jahre.some((j) => j[feld] != null),
  )

  return merke({
    symbol: anfrage.symbolYahoo,
    isin: anfrage.isin ?? null,
    waehrung:
      sec?.waehrung ?? stockanalysis?.waehrung ?? waehrungAusIsin(anfrage.isin) ?? 'lokal',
    jahre: merged.jahre,
    ableitungen: baueAbleitungen(merged.jahre),
    beitragendeQuellen: merged.beitragendeQuellen,
    verworfeneQuellen: merged.verworfeneQuellen,
    fehlendeFelder,
  })
}

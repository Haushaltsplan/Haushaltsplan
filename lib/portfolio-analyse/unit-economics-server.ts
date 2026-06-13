/** Unit Economics — LTV/CAC aus SEC 10-Q/10-K und Earnings-Call-Transkripten. */

import 'server-only'

import { ladeUnternehmenCache } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { ladeSecEdgarBerichtVolltext, ladeSecEdgarBerichteHistorie } from '@/lib/portfolio-analyse/sec-edgar-filings-server'
import {
  extrahiereUnitEconomicsAusText,
  mergeUnitEconomicsTreffer,
  type UnitEconomicsTreffer,
} from '@/lib/portfolio-analyse/unit-economics-extraktion'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; daten: UnitEconomicsTreffer }>()

function tickerKey(ticker: string): string {
  return ticker.trim().toUpperCase()
}

async function ausEarningsCall(ticker: string): Promise<UnitEconomicsTreffer | null> {
  const hit = await ladeUnternehmenCache(ticker)
  const roh = hit?.roh?.[0]
  if (!roh?.text || roh.text.length < 200) return null
  return extrahiereUnitEconomicsAusText(roh.text, 'earnings_call', roh.callDatum ?? roh.titel)
}

async function ausSecBericht(ticker: string): Promise<UnitEconomicsTreffer | null> {
  const { cik, berichte } = await ladeSecEdgarBerichteHistorie(ticker, { max: 6 })
  if (cik === 0 || !berichte.length) return null

  const ziel = berichte.find((b) => b.formular === '10-Q') ?? berichte[0]
  const hit = await ladeSecEdgarBerichtVolltext(ticker, ziel.accession)
  if (!hit?.text || hit.text.length < 200) return null

  const quelle = ziel.formular === '10-K' ? 'sec_10k' : 'sec_10q'
  return extrahiereUnitEconomicsAusText(
    hit.text,
    quelle,
    ziel.berichtszeitraum ?? ziel.filingDatum,
  )
}

/**
 * LTV/CAC ist keine Standard-Börsenkennzahl — nur wenn Management sie in Primärquellen nennt.
 * Reihenfolge: Earnings Call (aktueller) → SEC 10-Q/10-K.
 */
export async function ladeUnitEconomics(tickerRaw: string): Promise<UnitEconomicsTreffer> {
  const ticker = tickerKey(tickerRaw)
  if (!ticker) {
    return {
      ltvCac: null,
      nrrPct: null,
      grossRetentionPct: null,
      quelle: null,
      periode: null,
      snippet: null,
      hinweis: 'Ticker fehlt.',
    }
  }

  const cached = cache.get(ticker)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.daten

  const kandidaten: UnitEconomicsTreffer[] = []

  try {
    const ec = await ausEarningsCall(ticker)
    if (ec) kandidaten.push(ec)
  } catch {
    /* SEC */
  }

  const hatLtv = kandidaten.some((k) => k.ltvCac != null)
  if (!hatLtv) {
    try {
      const sec = await ausSecBericht(ticker)
      if (sec) kandidaten.push(sec)
    } catch {
      /* Ende */
    }
  }

  const daten = mergeUnitEconomicsTreffer(kandidaten)
  cache.set(ticker, { at: Date.now(), daten })
  return daten
}

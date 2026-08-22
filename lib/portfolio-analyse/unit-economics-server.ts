/** Unit Economics — LTV/CAC aus SEC 10-Q/10-K und Earnings-Call-Transkripten. */

import 'server-only'

import { ladeUnternehmenCache } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { ladeSecEdgarBerichtVolltext, ladeSecEdgarBerichteHistorie } from '@/lib/portfolio-analyse/sec-edgar-filings-server'
import {
  extrahiereUnitEconomicsAusText,
  mergeUnitEconomicsTreffer,
  type UnitEconomicsTreffer,
} from '@/lib/portfolio-analyse/unit-economics-extraktion'
import { curatedSaasRetention } from '@/lib/portfolio-analyse/saas-retention-curated'

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
  const { cik, berichte } = await ladeSecEdgarBerichteHistorie(ticker, { max: 8 })
  if (cik === 0 || !berichte.length) return null

  const kandidaten: UnitEconomicsTreffer[] = []
  const priorisiert = [
    ...berichte.filter((b) => b.formular === '10-Q'),
    ...berichte.filter((b) => b.formular === '10-K'),
    ...berichte.filter((b) => b.formular !== '10-Q' && b.formular !== '10-K'),
  ].slice(0, 4)

  for (const ziel of priorisiert) {
    try {
      const hit = await ladeSecEdgarBerichtVolltext(ticker, ziel.accession)
      if (!hit?.text || hit.text.length < 200) continue
      const quelle = ziel.formular === '10-K' ? 'sec_10k' : 'sec_10q'
      const treffer = extrahiereUnitEconomicsAusText(
        hit.text,
        quelle,
        ziel.berichtszeitraum ?? ziel.filingDatum,
      )
      if (treffer.nrrPct != null || treffer.ltvCac != null || treffer.grossRetentionPct != null) {
        kandidaten.push(treffer)
        if (treffer.nrrPct != null) break
      }
    } catch {
      /* nächster Filing */
    }
  }

  if (kandidaten.length === 0) return null
  return mergeUnitEconomicsTreffer(kandidaten)
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

  const hatNrrOderLtv = kandidaten.some((k) => k.ltvCac != null || k.nrrPct != null)
  if (!hatNrrOderLtv) {
    try {
      const sec = await ausSecBericht(ticker)
      if (sec) kandidaten.push(sec)
    } catch {
      /* Ende */
    }
  }

  let daten = mergeUnitEconomicsTreffer(kandidaten)

  // Kuratierter Fallback nur wenn Scrape weder NRR noch GRR liefert
  if (daten.nrrPct == null && daten.grossRetentionPct == null) {
    const curated = curatedSaasRetention(ticker)
    if (curated && (curated.nrrPct != null || curated.grossRetentionPct != null)) {
      daten = mergeUnitEconomicsTreffer([daten, curated])
    } else if (curated?.hinweis && !daten.hinweis) {
      daten = { ...daten, hinweis: curated.hinweis, periode: curated.periode }
    }
  }

  // Für Scoring: wenn nur GRR/Renewal da ist und kein NRR — nicht still null lassen bei SaaS,
  // die kein Dollar-NRR berichten (NOW). NRR bleibt null; GRR fließt über kontext.
  cache.set(ticker, { at: Date.now(), daten })
  return daten
}

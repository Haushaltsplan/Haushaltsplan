import 'server-only'

import { ladeEuAdhocEvents } from '@/lib/portfolio-analyse/eu-adhoc-server'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type {
  MaterialEventEintrag,
  MaterialEventsAnfrage,
  MaterialEventsPaket,
} from '@/lib/portfolio-analyse/material-events-types'
import { ladeSec8KMaterialEvents } from '@/lib/portfolio-analyse/sec-edgar-8k-server'

const CACHE_MS = 6 * 60 * 60 * 1000
const CACHE_VERSION = 2
const cache = new Map<string, { at: number; events: MaterialEventEintrag[] }>()

function istUsTicker(ticker: string): boolean {
  return !/\.(PA|AS|DE|SW|L|TO|HM|SG|MU)$/i.test(ticker.trim())
}

function istPrimaerEuIsin(isin: string): boolean {
  if (!isin || isin.length < 12) return false
  const land = isin.slice(0, 2)
  return land !== 'US' && /^[A-Z]{2}$/.test(land)
}

export async function ladeMaterialEvents(anfrage: MaterialEventsAnfrage): Promise<MaterialEventsPaket> {
  const ticker = anfrage.ticker?.trim().toUpperCase() ?? ''
  if (!ticker) {
    return { ok: false, ticker: '', events: [], geladenAm: new Date().toISOString(), fehler: 'Ticker fehlt.' }
  }

  const isin =
    loesePortfolioIsin({
      isin: anfrage.isin,
      ticker,
      firmenname: anfrage.firmenname,
    }) ?? anfrage.isin?.trim().toUpperCase() ?? ''

  const key = `${CACHE_VERSION}|${ticker}|${isin}`
  const hit = cache.get(key)
  if (hit && hit.at + CACHE_MS > Date.now() && !anfrage.force) {
    return {
      ok: hit.events.length > 0,
      ticker,
      events: hit.events,
      geladenAm: new Date().toISOString(),
      hinweis: hit.events.length ? 'SEC 8-K / IR Ad-hoc (Cache)' : null,
    }
  }

  const events: MaterialEventEintrag[] = []

  if (istUsTicker(ticker) && !istPrimaerEuIsin(isin)) {
    events.push(...(await ladeSec8KMaterialEvents(ticker)))
  }

  const eu = await ladeEuAdhocEvents({
    ticker,
    isin,
    firmenname: anfrage.firmenname,
  })
  events.push(...eu)

  events.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))

  cache.set(key, { at: Date.now(), events })

  return {
    ok: events.length > 0,
    ticker,
    events,
    geladenAm: new Date().toISOString(),
    hinweis:
      events.length > 0
        ? istUsTicker(ticker)
          ? 'SEC 8-K Material Events · EU ergänzt falls IR-Treffer'
          : 'Investor Relations — Ad-hoc / Pflichtmitteilungen'
        : 'Keine Material Events in den letzten Filings gefunden.',
    fehler: null,
  }
}

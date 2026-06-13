import 'server-only'

import {
  baueSecBerichtEintrag,
  ladeSecEdgarBerichteHistorie,
  ladeSecEdgarBerichtVolltext,
} from '@/lib/portfolio-analyse/sec-edgar-filings-server'
import type { SecBerichtAnfrage, SecBerichtePaket } from '@/lib/portfolio-analyse/sec-berichte-types'

const serverCache = new Map<string, { at: number; paket: SecBerichtePaket }>()
const CACHE_MS = 12 * 60 * 60 * 1000

function cacheKey(anfrage: SecBerichtAnfrage): string {
  return [
    anfrage.ticker.trim().toUpperCase(),
    anfrage.isin?.trim().toUpperCase() ?? '',
    anfrage.accession?.trim() ?? '',
  ].join('|')
}

function leerPaket(ticker: string, fehler?: string): SecBerichtePaket {
  return {
    ok: false,
    ticker,
    berichte: [],
    geladenAm: new Date().toISOString(),
    ausCache: false,
    fehler: fehler ?? null,
    hinweis: 'Quartals- und Jahresberichte über SEC EDGAR (US-Melder). EU-Titel: Investor Relations.',
  }
}

export async function ladeSecBerichte(anfrage: SecBerichtAnfrage): Promise<SecBerichtePaket> {
  const ticker = anfrage.ticker?.trim() ?? ''
  if (!ticker) return leerPaket('', 'Ticker fehlt.')

  if (anfrage.accession?.trim()) {
    const hit = await ladeSecEdgarBerichtVolltext(ticker, anfrage.accession.trim())
    if (!hit) return leerPaket(ticker, 'Bericht nicht gefunden.')
    return {
      ok: true,
      ticker,
      berichte: [{ ...hit.eintrag, textAuszug: hit.text.slice(0, 12_000), textZeichen: hit.text.length, textVollstaendig: true }],
      geladenAm: new Date().toISOString(),
      ausCache: false,
      hinweis: null,
    }
  }

  const key = cacheKey(anfrage)
  if (!anfrage.force) {
    const cached = serverCache.get(key)
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return { ...cached.paket, ausCache: true }
    }
  }

  try {
    const { cik, berichte, texte } = await ladeSecEdgarBerichteHistorie(ticker)
    if (cik === 0) {
      return {
        ...leerPaket(ticker, 'Kein SEC-CIK — vermutlich kein US-Melder.'),
        hinweis: 'Für EU-Aktien Quartalsberichte auf der Investor-Relations-Seite.',
      }
    }

    const eintraege = berichte.map((f) => {
      const text = texte.get(f.accession)
      return baueSecBerichtEintrag(f, cik, text, false)
    })

    const paket: SecBerichtePaket = {
      ok: eintraege.length > 0,
      ticker,
      berichte: eintraege,
      geladenAm: new Date().toISOString(),
      ausCache: false,
      fehler: eintraege.length === 0 ? 'Keine 10-Q/10-K bei SEC gefunden.' : null,
      hinweis: eintraege.length > 0 ? 'SEC EDGAR · Volltext beim Öffnen eines Berichts' : null,
    }

    serverCache.set(key, { at: Date.now(), paket })
    return paket
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'SEC-Abruf fehlgeschlagen'
    return leerPaket(ticker, msg)
  }
}

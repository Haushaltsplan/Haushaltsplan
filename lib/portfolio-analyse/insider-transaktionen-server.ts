import 'server-only'

import { ladeEuInsiderDealings } from '@/lib/portfolio-analyse/eu-insider-dealing-server'
import type { InsiderTransaktionenPaket } from '@/lib/portfolio-analyse/insider-transaktionen-types'
import { istUsBoersenTicker } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { ladeSecForm4InsiderTransaktionen } from '@/lib/portfolio-analyse/sec-edgar-form4-server'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: InsiderTransaktionenPaket }>()

function summeWert(txs: InsiderTransaktionenPaket['transaktionen'], typ: 'kauf' | 'verkauf'): number | null {
  const vals = txs.filter((t) => t.typ === typ && t.wertUsd != null).map((t) => t.wertUsd!)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0)
}

export async function ladeInsiderTransaktionen(opts: {
  ticker: string
  symbolYahoo?: string | null
  isin?: string | null
  firmenname?: string | null
  force?: boolean
}): Promise<InsiderTransaktionenPaket> {
  const ticker = opts.ticker.trim().toUpperCase()
  const sym = (opts.symbolYahoo ?? ticker).trim().toUpperCase()
  const key = `${sym}|${opts.isin ?? ''}`
  const hit = cache.get(key)
  if (hit && hit.at + CACHE_MS > Date.now() && !opts.force) return hit.data

  const transaktionen = []

  if (istUsBoersenTicker(sym)) {
    transaktionen.push(...(await ladeSecForm4InsiderTransaktionen(sym)))
  }

  const eu = await ladeEuInsiderDealings({
    ticker: sym,
    isin: opts.isin,
    firmenname: opts.firmenname,
  })
  transaktionen.push(...eu)

  transaktionen.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))

  const kaufSummeUsd = summeWert(transaktionen, 'kauf')
  const verkaufSummeUsd = summeWert(transaktionen, 'verkauf')
  const netto =
    kaufSummeUsd != null || verkaufSummeUsd != null
      ? (kaufSummeUsd ?? 0) - (verkaufSummeUsd ?? 0)
      : null

  const paket: InsiderTransaktionenPaket = {
    ok: transaktionen.length > 0,
    ticker,
    transaktionen: transaktionen.slice(0, 20),
    kaufSummeUsd,
    verkaufSummeUsd,
    nettoKaufUsd: netto,
    geladenAm: new Date().toISOString(),
    hinweis:
      transaktionen.length > 0
        ? istUsBoersenTicker(sym)
          ? 'SEC Form 4 (Open-Market P/S) · EU Directors Dealings ergänzt'
          : 'EU Directors Dealings / Stimmrechtsmitteilungen (IR)'
        : istUsBoersenTicker(sym)
          ? 'Keine Form-4 Open-Market-Transaktionen in den letzten Filings.'
          : 'Keine Directors-Dealings-Treffer — EU oft unvollständig.',
    fehler: null,
  }

  cache.set(key, { at: Date.now(), data: paket })
  return paket
}

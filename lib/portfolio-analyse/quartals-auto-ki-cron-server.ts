/**
 * Automatische Erkennung neuer Quartalsberichte / Earnings Calls
 * und KI-Zusammenfassung (Gemini Free Flash) für Whitelist + Watchlist.
 *
 * Nutzt die bestehenden Orchestratoren (`ladeSecBerichte`, `ladeEarningsCallZusammenfassung`)
 * und deren Cloud-Caches — kein neues Schema.
 */

import 'server-only'

import { ladeEarningsCallZusammenfassung } from '@/lib/portfolio-analyse/earnings-call-server'
import { ladeEarningsCallKiCacheFuerTicker } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeSecBerichte } from '@/lib/portfolio-analyse/sec-berichte-server'
import { ladeSecBerichtKiCacheFuerTicker } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
import { ladeNachkaufKandidaten } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import type { WhitelistPosition } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'

export type QuartalsAutoKiJobDetail = {
  ticker: string
  name: string
  art: 'sec' | 'earnings'
  id: string
  ok: boolean
  hinweis?: string
}

export type QuartalsAutoKiErgebnis = {
  kandidaten: number
  geprueft: number
  secNeu: number
  earningsNeu: number
  uebersprungenCache: number
  fehler: string[]
  details: QuartalsAutoKiJobDetail[]
  offset: number
  verbleibend: number
  zeitMs: number
}

function tickerAusPosition(p: WhitelistPosition): { ticker: string; name: string; isin: string } | null {
  const kenntnis = isinKenntnis(p.isin)
  const symbolYahoo = kenntnis?.symbolYahoo ?? p.symbolYahoo ?? null
  const ticker = (symbolYahoo?.replace(/\.[^.]+$/, '') ?? '').trim().toUpperCase()
  if (!ticker) return null
  return {
    ticker,
    name: kenntnis?.name ?? p.name,
    isin: p.isin,
  }
}

async function neuerSecBerichtId(opts: {
  ticker: string
  isin: string
  name: string
}): Promise<string | null> {
  const liste = await ladeSecBerichte({
    ticker: opts.ticker,
    isin: opts.isin,
    firmenname: opts.name,
  })
  if (!liste.ok || liste.berichte.length === 0) return null
  const cache = await ladeSecBerichtKiCacheFuerTicker(opts.ticker)
  for (const b of liste.berichte) {
    const hit = cache.get(b.id)
    if (!hit?.zusammenfassung?.trim()) return b.id
    if (hit.accession && b.accession && hit.accession !== b.accession) return b.id
  }
  return null
}

async function neuesEarningsQuartalId(opts: {
  ticker: string
  isin: string
  name: string
}): Promise<string | null> {
  const liste = await ladeEarningsCallZusammenfassung({
    ticker: opts.ticker,
    isin: opts.isin,
    firmenname: opts.name,
  })
  if (!liste.ok || liste.quartale.length === 0) return null
  const cache = await ladeEarningsCallKiCacheFuerTicker(opts.ticker)
  for (const q of liste.quartale) {
    const hit = cache.get(q.id)
    if (!hit?.zusammenfassung?.trim()) return q.id
    if (hit.transcriptUrl && q.transcriptUrl && hit.transcriptUrl !== q.transcriptUrl) return q.id
  }
  return null
}

/**
 * Prüft Kandidaten ab `offset` und fasst fehlende Berichte/Calls zusammen.
 * Budget: max. Ticker und max. neue KI-Jobs pro Aufruf (Free-Tier schonen).
 */
export async function laufeQuartalsAutoKi(opts?: {
  offset?: number
  maxTicker?: number
  maxKiJobs?: number
  zeitBudgetMs?: number
}): Promise<QuartalsAutoKiErgebnis> {
  const start = Date.now()
  const offset = Math.max(0, opts?.offset ?? 0)
  const maxTicker = Math.max(1, Math.min(12, opts?.maxTicker ?? 4))
  const maxKiJobs = Math.max(1, Math.min(8, opts?.maxKiJobs ?? 3))
  const zeitBudgetMs = Math.max(20_000, opts?.zeitBudgetMs ?? 110_000)

  const kandidaten = await ladeNachkaufKandidaten()
  const slice = kandidaten.slice(offset, offset + maxTicker)

  const details: QuartalsAutoKiJobDetail[] = []
  const fehler: string[] = []
  let geprueft = 0
  let secNeu = 0
  let earningsNeu = 0
  let uebersprungenCache = 0
  let kiJobs = 0

  for (const pos of slice) {
    if (Date.now() - start > zeitBudgetMs) break
    if (kiJobs >= maxKiJobs) break

    const aufgeloest = tickerAusPosition(pos)
    if (!aufgeloest) {
      fehler.push(`${pos.isin}: kein Yahoo-Ticker`)
      continue
    }
    const { ticker, name, isin } = aufgeloest
    geprueft++

    // 1) SEC / IR-Bericht
    if (kiJobs < maxKiJobs && Date.now() - start <= zeitBudgetMs) {
      try {
        const berichtId = await neuerSecBerichtId({ ticker, isin, name })
        if (!berichtId) {
          uebersprungenCache++
        } else {
          const paket = await ladeSecBerichte({
            ticker,
            isin,
            firmenname: name,
            berichtId,
          })
          const hit = paket.berichte.find((b) => b.id === berichtId)
          const ok = Boolean(hit?.zusammenfassung?.trim())
          details.push({
            ticker,
            name,
            art: 'sec',
            id: berichtId,
            ok,
            hinweis: ok ? undefined : paket.fehler ?? 'Keine Zusammenfassung',
          })
          if (ok) {
            secNeu++
            kiJobs++
          } else if (paket.fehler) {
            fehler.push(`${ticker} SEC ${berichtId}: ${paket.fehler}`)
          }
        }
      } catch (e) {
        fehler.push(`${ticker} SEC: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // 2) Earnings Call
    if (kiJobs < maxKiJobs && Date.now() - start <= zeitBudgetMs) {
      try {
        const quartalId = await neuesEarningsQuartalId({ ticker, isin, name })
        if (!quartalId) {
          uebersprungenCache++
        } else {
          const paket = await ladeEarningsCallZusammenfassung({
            ticker,
            isin,
            firmenname: name,
            quartalId,
          })
          const hit = paket.quartale.find((q) => q.id === quartalId)
          const ok = Boolean(hit?.zusammenfassung?.trim())
          details.push({
            ticker,
            name,
            art: 'earnings',
            id: quartalId,
            ok,
            hinweis: ok ? undefined : paket.fehler ?? 'Keine Zusammenfassung',
          })
          if (ok) {
            earningsNeu++
            kiJobs++
          } else if (paket.fehler) {
            fehler.push(`${ticker} Call ${quartalId}: ${paket.fehler}`)
          }
        }
      } catch (e) {
        fehler.push(`${ticker} Call: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  const nextOffset = offset + slice.length
  return {
    kandidaten: kandidaten.length,
    geprueft,
    secNeu,
    earningsNeu,
    uebersprungenCache,
    fehler,
    details,
    offset: nextOffset,
    verbleibend: Math.max(0, kandidaten.length - nextOffset),
    zeitMs: Date.now() - start,
  }
}

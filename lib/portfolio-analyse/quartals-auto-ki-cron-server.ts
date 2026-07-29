/**
 * Automatische Erkennung **neuer** Quartalsberichte / Earnings Calls
 * und KI-Zusammenfassung + Quartals-Diff für Whitelist + Watchlist.
 *
 * Wichtig: Kein Backfill alter Perioden — nur Einträge mit Datum innerhalb
 * des Neu-Fensters (ca. laufendes + Vorquartal). Bewusst, weil ältere Summaries
 * manuell/selektiv gepflegt werden.
 */

import 'server-only'

import { ladeEarningsCallZusammenfassung } from '@/lib/portfolio-analyse/earnings-call-server'
import { ladeEarningsCallKiCacheFuerTicker } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeQuartalsKiDiff } from '@/lib/portfolio-analyse/quartals-ki-diff-server'
import { ladeQuartalsKiDiffCache } from '@/lib/portfolio-analyse/quartals-ki-diff-cache-server'
import { ladeSecBerichte } from '@/lib/portfolio-analyse/sec-berichte-server'
import { ladeSecBerichtKiCacheFuerTicker } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
import { ladeNachkaufKandidaten } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import type { WhitelistPosition } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import type { EarningsCallQuartalEintrag } from '@/lib/portfolio-analyse/earnings-call-types'
import type { SecBerichtEintrag } from '@/lib/portfolio-analyse/sec-berichte-types'

/** Nur Meldungen neuer als dieses Alter (Tage) gelten als „neu“ — kein Alt-Backfill. */
const NEU_MAX_ALTER_TAGE = 100

export type QuartalsAutoKiJobDetail = {
  ticker: string
  name: string
  art: 'sec' | 'earnings' | 'diff_sec' | 'diff_earnings'
  id: string
  ok: boolean
  hinweis?: string
}

export type QuartalsAutoKiErgebnis = {
  kandidaten: number
  geprueft: number
  secNeu: number
  earningsNeu: number
  diffsNeu: number
  uebersprungen: number
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

function tageSeit(isoDatum: string | null | undefined): number | null {
  if (!isoDatum || !/^\d{4}-\d{2}-\d{2}/.test(isoDatum)) return null
  const t = Date.parse(isoDatum.slice(0, 10) + 'T12:00:00Z')
  if (!Number.isFinite(t)) return null
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

/** Ende des Kalenderquartals als Näherung, wenn kein Call-Datum vorliegt. */
function naeherungsDatumAusQuartalId(quartalId: string): string | null {
  const m = /^(\d{4})-Q([1-4])$/i.exec(quartalId.trim())
  if (!m) return null
  const jahr = Number(m[1])
  const q = Number(m[2]) as 1 | 2 | 3 | 4
  const endeMonat = q * 3
  const endeTag = endeMonat === 6 || endeMonat === 9 ? 30 : endeMonat === 3 ? 31 : 31
  return `${jahr}-${String(endeMonat).padStart(2, '0')}-${String(endeTag).padStart(2, '0')}`
}

function istNeuGenug(isoDatum: string | null | undefined): boolean {
  const tage = tageSeit(isoDatum)
  if (tage == null) return false
  return tage >= 0 && tage <= NEU_MAX_ALTER_TAGE
}

function secIstNeu(b: SecBerichtEintrag): boolean {
  return istNeuGenug(b.filingDatum)
}

function earningsIstNeu(q: EarningsCallQuartalEintrag): boolean {
  return istNeuGenug(q.callDatum) || istNeuGenug(naeherungsDatumAusQuartalId(q.id))
}

/** Neuester Bericht im Neu-Fenster ohne KI-Cache (kein Alt-Backfill). */
async function findeNeuenSecBericht(opts: {
  ticker: string
  isin: string
  name: string
}): Promise<{ bericht: SecBerichtEintrag; liste: SecBerichtEintrag[] } | null> {
  const paket = await ladeSecBerichte({
    ticker: opts.ticker,
    isin: opts.isin,
    firmenname: opts.name,
  })
  if (!paket.ok || paket.berichte.length === 0) return null

  const sorted = [...paket.berichte].sort((a, b) =>
    (b.filingDatum ?? '').localeCompare(a.filingDatum ?? ''),
  )
  const cache = await ladeSecBerichtKiCacheFuerTicker(opts.ticker)

  for (const b of sorted) {
    if (!secIstNeu(b)) continue
    const hit = cache.get(b.id)
    if (!hit?.zusammenfassung?.trim()) return { bericht: b, liste: sorted }
    if (hit.accession && b.accession && hit.accession !== b.accession) {
      return { bericht: b, liste: sorted }
    }
  }
  return null
}

/** Neuestes Call-Quartal im Neu-Fenster ohne KI-Cache. */
async function findeNeuenEarningsCall(opts: {
  ticker: string
  isin: string
  name: string
}): Promise<{ quartal: EarningsCallQuartalEintrag; liste: EarningsCallQuartalEintrag[] } | null> {
  const paket = await ladeEarningsCallZusammenfassung({
    ticker: opts.ticker,
    isin: opts.isin,
    firmenname: opts.name,
  })
  if (!paket.ok || paket.quartale.length === 0) return null

  const sorted = [...paket.quartale].sort((a, b) => {
    if (a.jahr !== b.jahr) return b.jahr - a.jahr
    return b.quartal - a.quartal
  })
  const cache = await ladeEarningsCallKiCacheFuerTicker(opts.ticker)

  for (const q of sorted) {
    if (!earningsIstNeu(q)) continue
    const hit = cache.get(q.id)
    if (!hit?.zusammenfassung?.trim()) return { quartal: q, liste: sorted }
    if (hit.transcriptUrl && q.transcriptUrl && hit.transcriptUrl !== q.transcriptUrl) {
      return { quartal: q, liste: sorted }
    }
  }
  return null
}

function vorherSecMitKi(
  liste: SecBerichtEintrag[],
  aktuellId: string,
  cache: Map<string, { zusammenfassung: string }>,
): SecBerichtEintrag | null {
  const sorted = [...liste].sort((a, b) => (b.filingDatum ?? '').localeCompare(a.filingDatum ?? ''))
  const idx = sorted.findIndex((b) => b.id === aktuellId)
  if (idx < 0) return null
  for (let i = idx + 1; i < sorted.length; i++) {
    const c = cache.get(sorted[i].id)
    if (c?.zusammenfassung?.trim() || sorted[i].zusammenfassung?.trim()) return sorted[i]
  }
  return null
}

function vorherEarningsMitKi(
  liste: EarningsCallQuartalEintrag[],
  aktuellId: string,
  cache: Map<string, { zusammenfassung: string }>,
): EarningsCallQuartalEintrag | null {
  const sorted = [...liste].sort((a, b) => {
    if (a.jahr !== b.jahr) return b.jahr - a.jahr
    return b.quartal - a.quartal
  })
  const idx = sorted.findIndex((q) => q.id === aktuellId)
  if (idx < 0) return null
  for (let i = idx + 1; i < sorted.length; i++) {
    const c = cache.get(sorted[i].id)
    if (c?.zusammenfassung?.trim() || sorted[i].zusammenfassung?.trim()) return sorted[i]
  }
  return null
}

async function ggfDiffSec(opts: {
  ticker: string
  name: string
  aktuellId: string
  liste: SecBerichtEintrag[]
}): Promise<QuartalsAutoKiJobDetail | null> {
  const cache = await ladeSecBerichtKiCacheFuerTicker(opts.ticker)
  const vorher = vorherSecMitKi(opts.liste, opts.aktuellId, cache)
  if (!vorher) return null

  const cached = await ladeQuartalsKiDiffCache(opts.ticker, 'sec_bericht', opts.aktuellId, vorher.id)
  if (cached) return null

  const paket = await ladeQuartalsKiDiff({
    ticker: opts.ticker,
    firmenname: opts.name,
    typ: 'sec_bericht',
    aktuellId: opts.aktuellId,
    vorherId: vorher.id,
  })
  return {
    ticker: opts.ticker,
    name: opts.name,
    art: 'diff_sec',
    id: `${vorher.id}→${opts.aktuellId}`,
    ok: Boolean(paket.ok && paket.diff?.trim()),
    hinweis: paket.ok ? undefined : paket.fehler ?? undefined,
  }
}

async function ggfDiffEarnings(opts: {
  ticker: string
  name: string
  aktuellId: string
  liste: EarningsCallQuartalEintrag[]
}): Promise<QuartalsAutoKiJobDetail | null> {
  const cache = await ladeEarningsCallKiCacheFuerTicker(opts.ticker)
  const vorher = vorherEarningsMitKi(opts.liste, opts.aktuellId, cache)
  if (!vorher) return null

  const cached = await ladeQuartalsKiDiffCache(opts.ticker, 'earnings_call', opts.aktuellId, vorher.id)
  if (cached) return null

  const paket = await ladeQuartalsKiDiff({
    ticker: opts.ticker,
    firmenname: opts.name,
    typ: 'earnings_call',
    aktuellId: opts.aktuellId,
    vorherId: vorher.id,
  })
  return {
    ticker: opts.ticker,
    name: opts.name,
    art: 'diff_earnings',
    id: `${vorher.id}→${opts.aktuellId}`,
    ok: Boolean(paket.ok && paket.diff?.trim()),
    hinweis: paket.ok ? undefined : paket.fehler ?? undefined,
  }
}

/**
 * Prüft Kandidaten ab `offset`: nur **neue** Berichte/Calls (≤ NEU_MAX_ALTER_TAGE),
 * fasst sie zusammen und erzeugt bei Bedarf den Quartals-Diff zum Vorquartal.
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
  let diffsNeu = 0
  let uebersprungen = 0
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

    // 1) Neuer SEC / IR-Bericht
    if (kiJobs < maxKiJobs && Date.now() - start <= zeitBudgetMs) {
      try {
        const fund = await findeNeuenSecBericht({ ticker, isin, name })
        if (!fund) {
          uebersprungen++
        } else {
          const paket = await ladeSecBerichte({
            ticker,
            isin,
            firmenname: name,
            berichtId: fund.bericht.id,
          })
          const hit = paket.berichte.find((b) => b.id === fund.bericht.id)
          const ok = Boolean(hit?.zusammenfassung?.trim())
          details.push({
            ticker,
            name,
            art: 'sec',
            id: fund.bericht.id,
            ok,
            hinweis: ok
              ? `neu (${fund.bericht.filingDatum ?? 'ohne Datum'})`
              : paket.fehler ?? 'Keine Zusammenfassung',
          })
          if (ok) {
            secNeu++
            kiJobs++
            // Diff zum vorherigen Bericht mit KI
            if (kiJobs < maxKiJobs && Date.now() - start <= zeitBudgetMs) {
              const diff = await ggfDiffSec({
                ticker,
                name,
                aktuellId: fund.bericht.id,
                liste: fund.liste,
              })
              if (diff) {
                details.push(diff)
                if (diff.ok) {
                  diffsNeu++
                  kiJobs++
                } else if (diff.hinweis) {
                  fehler.push(`${ticker} Diff SEC: ${diff.hinweis}`)
                }
              }
            }
          } else if (paket.fehler) {
            fehler.push(`${ticker} SEC ${fund.bericht.id}: ${paket.fehler}`)
          }
        }
      } catch (e) {
        fehler.push(`${ticker} SEC: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // 2) Neuer Earnings Call
    if (kiJobs < maxKiJobs && Date.now() - start <= zeitBudgetMs) {
      try {
        const fund = await findeNeuenEarningsCall({ ticker, isin, name })
        if (!fund) {
          uebersprungen++
        } else {
          const paket = await ladeEarningsCallZusammenfassung({
            ticker,
            isin,
            firmenname: name,
            quartalId: fund.quartal.id,
          })
          const hit = paket.quartale.find((q) => q.id === fund.quartal.id)
          const ok = Boolean(hit?.zusammenfassung?.trim())
          details.push({
            ticker,
            name,
            art: 'earnings',
            id: fund.quartal.id,
            ok,
            hinweis: ok
              ? `neu (${fund.quartal.callDatum ?? fund.quartal.id})`
              : paket.fehler ?? 'Keine Zusammenfassung',
          })
          if (ok) {
            earningsNeu++
            kiJobs++
            if (kiJobs < maxKiJobs && Date.now() - start <= zeitBudgetMs) {
              const diff = await ggfDiffEarnings({
                ticker,
                name,
                aktuellId: fund.quartal.id,
                liste: fund.liste,
              })
              if (diff) {
                details.push(diff)
                if (diff.ok) {
                  diffsNeu++
                  kiJobs++
                } else if (diff.hinweis) {
                  fehler.push(`${ticker} Diff Call: ${diff.hinweis}`)
                }
              }
            }
          } else if (paket.fehler) {
            fehler.push(`${ticker} Call ${fund.quartal.id}: ${paket.fehler}`)
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
    diffsNeu,
    uebersprungen,
    fehler,
    details,
    offset: nextOffset,
    verbleibend: Math.max(0, kandidaten.length - nextOffset),
    zeitMs: Date.now() - start,
  }
}

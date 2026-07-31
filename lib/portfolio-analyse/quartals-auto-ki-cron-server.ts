/**
 * Automatische Erkennung **neuer** Quartalsberichte / Earnings Calls
 * und KI-Zusammenfassung + Quartals-Diff fÃ¼r Whitelist + Watchlist.
 *
 * Cursor lÃ¤uft tickerweise: zuerst Earnings Call, dann SEC/IR.
 * Bei erschÃ¶pftem KI-Kontingent: sofort stoppen â€” Fortschritt wird persistiert
 * und am nÃ¤chsten Tag exakt dort fortgesetzt.
 */

import 'server-only'

import { istKiKontingentErschoepft } from '@/lib/ki-coach-backend'
import { ladeEarningsCallZusammenfassung } from '@/lib/portfolio-analyse/earnings-call-server'
import { ladeEarningsCallKiCacheFuerTicker } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { aufloeseEarningsCallKontext } from '@/lib/portfolio-analyse/earnings-call-kenntnisse'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeQuartalsKiDiff } from '@/lib/portfolio-analyse/quartals-ki-diff-server'
import { ladeQuartalsKiDiffCache } from '@/lib/portfolio-analyse/quartals-ki-diff-cache-server'
import type { QuartalsAutoKiPhase } from '@/lib/portfolio-analyse/quartals-auto-ki-fortschritt-server'
import { ladeSecBerichte } from '@/lib/portfolio-analyse/sec-berichte-server'
import { ladeSecBerichtKiCacheFuerTicker } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
import { ladeNachkaufKandidaten } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import type { WhitelistPosition } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import type { EarningsCallQuartalEintrag } from '@/lib/portfolio-analyse/earnings-call-types'
import type { SecBerichtEintrag } from '@/lib/portfolio-analyse/sec-berichte-types'

/** Nur Meldungen neuer als dieses Alter (Tage) gelten als â€žneuâ€œ â€” kein Alt-Backfill. */
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
  /** NÃ¤chster Kandidaten-Index (0-basiert). */
  resumeOffset: number
  resumePhase: QuartalsAutoKiPhase
  quotaErschoepft: boolean
  pauseGrund: string | null
  /** Ein kompletter Durchlauf Ã¼ber alle Kandidaten war fertig â†’ Offset wieder 0. */
  durchlaufFertig: boolean
  zeitMs: number
}

type Aufgeloest = {
  ticker: string
  earningsTicker: string
  name: string
  isin: string
}

type SchrittErgebnis = {
  quota: boolean
  pauseGrund?: string
}

function tickerAusPosition(p: WhitelistPosition): Aufgeloest | null {
  const kenntnis = isinKenntnis(p.isin)
  const symbolYahoo = kenntnis?.symbolYahoo ?? p.symbolYahoo ?? null
  const ticker = (symbolYahoo?.replace(/\.[^.]+$/, '') ?? '').trim().toUpperCase()
  if (!ticker) return null
  const name = kenntnis?.name ?? p.name
  const kontext = aufloeseEarningsCallKontext({ ticker, isin: p.isin, firmenname: name })
  const earningsTicker = (kontext.foolTicker || ticker).trim().toUpperCase()
  return { ticker, earningsTicker, name, isin: p.isin }
}

function tageSeit(isoDatum: string | null | undefined): number | null {
  if (!isoDatum || !/^\d{4}-\d{2}-\d{2}/.test(isoDatum)) return null
  const t = Date.parse(isoDatum.slice(0, 10) + 'T12:00:00Z')
  if (!Number.isFinite(t)) return null
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

function naeherungsDatumAusQuartalId(quartalId: string): string | null {
  const m = /^(\d{4})-Q([1-4])/i.exec(quartalId.trim())
  if (!m) return null
  const jahr = Number(m[1])
  const q = Number(m[2]) as 1 | 2 | 3 | 4
  const endeMonat = q * 3
  const endeTag = endeMonat === 6 || endeMonat === 9 ? 30 : 31
  return `${jahr}-${String(endeMonat).padStart(2, '0')}-${String(endeTag).padStart(2, '0')}`
}

function istNeuGenug(isoDatum: string | null | undefined): boolean {
  const tage = tageSeit(isoDatum)
  if (tage == null) return false
  return tage >= -3 && tage <= NEU_MAX_ALTER_TAGE
}

function secIstNeu(b: SecBerichtEintrag): boolean {
  return istNeuGenug(b.filingDatum)
}

function earningsIstNeu(q: EarningsCallQuartalEintrag): boolean {
  return istNeuGenug(q.callDatum) || istNeuGenug(naeherungsDatumAusQuartalId(q.id))
}

function sortiereEarnings(liste: EarningsCallQuartalEintrag[]): EarningsCallQuartalEintrag[] {
  return [...liste].sort((a, b) => {
    if (a.jahr !== b.jahr) return b.jahr - a.jahr
    return b.quartal - a.quartal
  })
}

function quotaAusText(text: string | null | undefined): SchrittErgebnis | null {
  if (!text || !istKiKontingentErschoepft(text)) return null
  return { quota: true, pauseGrund: text.slice(0, 240) }
}

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

async function findeNeuenEarningsCall(opts: {
  ticker: string
  earningsTicker: string
  isin: string
  name: string
}): Promise<{ quartal: EarningsCallQuartalEintrag; liste: EarningsCallQuartalEintrag[] } | null> {
  const basis = {
    ticker: opts.ticker,
    isin: opts.isin,
    firmenname: opts.name,
  }

  let paket = await ladeEarningsCallZusammenfassung(basis)
  let sorted = sortiereEarnings(paket.ok ? paket.quartale : [])

  if (!sorted.some(earningsIstNeu)) {
    paket = await ladeEarningsCallZusammenfassung({ ...basis, force: true })
    sorted = sortiereEarnings(paket.ok ? paket.quartale : [])
  }

  if (!paket.ok || sorted.length === 0) return null

  const cache = await ladeEarningsCallKiCacheFuerTicker(opts.earningsTicker)

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
  const sorted = sortiereEarnings(liste)
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
}): Promise<{ detail: QuartalsAutoKiJobDetail | null; quota?: SchrittErgebnis }> {
  const cache = await ladeSecBerichtKiCacheFuerTicker(opts.ticker)
  const vorher = vorherSecMitKi(opts.liste, opts.aktuellId, cache)
  if (!vorher) return { detail: null }

  const cached = await ladeQuartalsKiDiffCache(opts.ticker, 'sec_bericht', opts.aktuellId, vorher.id)
  if (cached) return { detail: null }

  const paket = await ladeQuartalsKiDiff({
    ticker: opts.ticker,
    firmenname: opts.name,
    typ: 'sec_bericht',
    aktuellId: opts.aktuellId,
    vorherId: vorher.id,
  })
  const q = quotaAusText(paket.fehler)
  if (q) return { detail: null, quota: q }

  return {
    detail: {
      ticker: opts.ticker,
      name: opts.name,
      art: 'diff_sec',
      id: `${vorher.id}â†’${opts.aktuellId}`,
      ok: Boolean(paket.ok && paket.diff?.trim()),
      hinweis: paket.ok ? undefined : paket.fehler ?? undefined,
    },
  }
}

async function ggfDiffEarnings(opts: {
  earningsTicker: string
  name: string
  aktuellId: string
  liste: EarningsCallQuartalEintrag[]
}): Promise<{ detail: QuartalsAutoKiJobDetail | null; quota?: SchrittErgebnis }> {
  const cache = await ladeEarningsCallKiCacheFuerTicker(opts.earningsTicker)
  const vorher = vorherEarningsMitKi(opts.liste, opts.aktuellId, cache)
  if (!vorher) return { detail: null }

  const cached = await ladeQuartalsKiDiffCache(
    opts.earningsTicker,
    'earnings_call',
    opts.aktuellId,
    vorher.id,
  )
  if (cached) return { detail: null }

  const paket = await ladeQuartalsKiDiff({
    ticker: opts.earningsTicker,
    firmenname: opts.name,
    typ: 'earnings_call',
    aktuellId: opts.aktuellId,
    vorherId: vorher.id,
  })
  const q = quotaAusText(paket.fehler)
  if (q) return { detail: null, quota: q }

  return {
    detail: {
      ticker: opts.earningsTicker,
      name: opts.name,
      art: 'diff_earnings',
      id: `${vorher.id}â†’${opts.aktuellId}`,
      ok: Boolean(paket.ok && paket.diff?.trim()),
      hinweis: paket.ok ? undefined : paket.fehler ?? undefined,
    },
  }
}

type LaufState = {
  start: number
  maxKiJobs: number
  zeitBudgetMs: number
  details: QuartalsAutoKiJobDetail[]
  fehler: string[]
  secNeu: number
  earningsNeu: number
  diffsNeu: number
  uebersprungen: number
  kiJobs: number
  geprueft: number
}

function budgetOk(s: LaufState): boolean {
  return s.kiJobs < s.maxKiJobs && Date.now() - s.start <= s.zeitBudgetMs
}

async function verarbeiteEarningsCall(pos: Aufgeloest, s: LaufState): Promise<SchrittErgebnis> {
  const { ticker, earningsTicker, name, isin } = pos
  s.geprueft++
  try {
    const fund = await findeNeuenEarningsCall({ ticker, earningsTicker, isin, name })
    if (!fund) {
      s.uebersprungen++
      return { quota: false }
    }
    const paket = await ladeEarningsCallZusammenfassung({
      ticker,
      isin,
      firmenname: name,
      quartalId: fund.quartal.id,
    })
    const q = quotaAusText(paket.fehler)
    if (q) {
      s.fehler.push(`${earningsTicker} Call ${fund.quartal.id}: ${paket.fehler}`)
      return q
    }
    const hit = paket.quartale.find((x) => x.id === fund.quartal.id)
    const ok = Boolean(hit?.zusammenfassung?.trim())
    s.details.push({
      ticker: earningsTicker,
      name,
      art: 'earnings',
      id: fund.quartal.id,
      ok,
      hinweis: ok
        ? `neu (${fund.quartal.callDatum ?? fund.quartal.id})`
        : paket.fehler ?? 'Keine Zusammenfassung',
    })
    if (ok) {
      s.earningsNeu++
      s.kiJobs++
      if (budgetOk(s)) {
        const diff = await ggfDiffEarnings({
          earningsTicker,
          name,
          aktuellId: fund.quartal.id,
          liste: fund.liste,
        })
        if (diff.quota) {
          s.fehler.push(`${earningsTicker} Diff Call: ${diff.quota.pauseGrund}`)
          return diff.quota
        }
        if (diff.detail) {
          s.details.push(diff.detail)
          if (diff.detail.ok) {
            s.diffsNeu++
            s.kiJobs++
          } else if (diff.detail.hinweis) {
            s.fehler.push(`${earningsTicker} Diff Call: ${diff.detail.hinweis}`)
            const dq = quotaAusText(diff.detail.hinweis)
            if (dq) return dq
          }
        }
      }
    } else if (paket.fehler) {
      s.fehler.push(`${earningsTicker} Call ${fund.quartal.id}: ${paket.fehler}`)
      const q2 = quotaAusText(paket.fehler)
      if (q2) return q2
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    s.fehler.push(`${earningsTicker} Call: ${msg}`)
    const q = quotaAusText(msg)
    if (q) return q
  }
  return { quota: false }
}

async function verarbeiteSecBericht(pos: Aufgeloest, s: LaufState): Promise<SchrittErgebnis> {
  const { ticker, name, isin } = pos
  s.geprueft++
  try {
    const fund = await findeNeuenSecBericht({ ticker, isin, name })
    if (!fund) {
      s.uebersprungen++
      return { quota: false }
    }
    const paket = await ladeSecBerichte({
      ticker,
      isin,
      firmenname: name,
      berichtId: fund.bericht.id,
    })
    const q = quotaAusText(paket.fehler)
    if (q) {
      s.fehler.push(`${ticker} SEC ${fund.bericht.id}: ${paket.fehler}`)
      return q
    }
    const hit = paket.berichte.find((b) => b.id === fund.bericht.id)
    const ok = Boolean(hit?.zusammenfassung?.trim())
    s.details.push({
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
      s.secNeu++
      s.kiJobs++
      if (budgetOk(s)) {
        const diff = await ggfDiffSec({
          ticker,
          name,
          aktuellId: fund.bericht.id,
          liste: fund.liste,
        })
        if (diff.quota) {
          s.fehler.push(`${ticker} Diff SEC: ${diff.quota.pauseGrund}`)
          return diff.quota
        }
        if (diff.detail) {
          s.details.push(diff.detail)
          if (diff.detail.ok) {
            s.diffsNeu++
            s.kiJobs++
          } else if (diff.detail.hinweis) {
            s.fehler.push(`${ticker} Diff SEC: ${diff.detail.hinweis}`)
            const dq = quotaAusText(diff.detail.hinweis)
            if (dq) return dq
          }
        }
      }
    } else if (paket.fehler) {
      s.fehler.push(`${ticker} SEC ${fund.bericht.id}: ${paket.fehler}`)
      const q2 = quotaAusText(paket.fehler)
      if (q2) return q2
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    s.fehler.push(`${ticker} SEC: ${msg}`)
    const q = quotaAusText(msg)
    if (q) return q
  }
  return { quota: false }
}

/**
 * LÃ¤uft ab `resumeOffset` / `resumePhase` tickerweise weiter.
 * Bei Quota: Cursor bleibt auf dem aktuellen Ticker+Phase stehen.
 */
export async function laufeQuartalsAutoKi(opts?: {
  resumeOffset?: number
  resumePhase?: QuartalsAutoKiPhase
  maxKiJobs?: number
  zeitBudgetMs?: number
  /** Max. abgeschlossene Ticker (Earnings+SEC), nicht Roh-Schritte. */
  maxTicker?: number
}): Promise<QuartalsAutoKiErgebnis> {
  const start = Date.now()
  const maxKiJobs = Math.max(1, Math.min(8, opts?.maxKiJobs ?? 4))
  const zeitBudgetMs = Math.max(20_000, opts?.zeitBudgetMs ?? 110_000)
  const maxTicker = Math.max(1, Math.min(20, opts?.maxTicker ?? 8))

  const kandidaten = await ladeNachkaufKandidaten()
  const n = kandidaten.length

  let resumeOffset = Math.max(0, opts?.resumeOffset ?? 0)
  let resumePhase: QuartalsAutoKiPhase = opts?.resumePhase === 'sec' ? 'sec' : 'earnings'
  if (n === 0) {
    return {
      kandidaten: 0,
      geprueft: 0,
      secNeu: 0,
      earningsNeu: 0,
      diffsNeu: 0,
      uebersprungen: 0,
      fehler: [],
      details: [],
      resumeOffset: 0,
      resumePhase: 'earnings',
      quotaErschoepft: false,
      pauseGrund: null,
      durchlaufFertig: true,
      zeitMs: Date.now() - start,
    }
  }
  if (resumeOffset >= n) {
    resumeOffset = 0
    resumePhase = 'earnings'
  }

  const s: LaufState = {
    start,
    maxKiJobs,
    zeitBudgetMs,
    details: [],
    fehler: [],
    secNeu: 0,
    earningsNeu: 0,
    diffsNeu: 0,
    uebersprungen: 0,
    kiJobs: 0,
    geprueft: 0,
  }

  let tickerFertig = 0
  let durchlaufFertig = false
  let quotaErschoepft = false
  let pauseGrund: string | null = null
  const startOffset = resumeOffset

  while (budgetOk(s) && tickerFertig < maxTicker && !quotaErschoepft) {
    const roh = kandidaten[resumeOffset]
    const pos = tickerAusPosition(roh)
    if (!pos) {
      s.fehler.push(`${roh.isin}: kein Yahoo-Ticker`)
      resumeOffset = (resumeOffset + 1) % n
      resumePhase = 'earnings'
      tickerFertig++
      if (resumeOffset === startOffset && resumePhase === 'earnings' && tickerFertig > 0) {
        durchlaufFertig = true
        break
      }
      continue
    }

    if (resumePhase === 'earnings') {
      const ergebnis = await verarbeiteEarningsCall(pos, s)
      if (ergebnis.quota) {
        quotaErschoepft = true
        pauseGrund = ergebnis.pauseGrund ?? 'KI-Kontingent erschÃ¶pft'
        break
      }
      resumePhase = 'sec'
      if (!budgetOk(s)) break
    }

    if (resumePhase === 'sec') {
      const ergebnis = await verarbeiteSecBericht(pos, s)
      if (ergebnis.quota) {
        quotaErschoepft = true
        pauseGrund = ergebnis.pauseGrund ?? 'KI-Kontingent erschÃ¶pft'
        break
      }
      const vorher = resumeOffset
      resumeOffset = (resumeOffset + 1) % n
      resumePhase = 'earnings'
      tickerFertig++
      if (resumeOffset === startOffset && vorher !== resumeOffset) {
        // ZurÃ¼ck am Start â†’ ein voller Umlauf
        durchlaufFertig = true
        break
      }
      if (resumeOffset === 0 && startOffset === 0 && tickerFertig >= n) {
        durchlaufFertig = true
        break
      }
    }
  }

  if (durchlaufFertig) {
    resumeOffset = 0
    resumePhase = 'earnings'
  }

  return {
    kandidaten: n,
    geprueft: s.geprueft,
    secNeu: s.secNeu,
    earningsNeu: s.earningsNeu,
    diffsNeu: s.diffsNeu,
    uebersprungen: s.uebersprungen,
    fehler: s.fehler,
    details: s.details,
    resumeOffset,
    resumePhase,
    quotaErschoepft,
    pauseGrund,
    durchlaufFertig,
    zeitMs: Date.now() - start,
  }
}

/** Earnings Beat/Miss-Historie — letzte N Quartale vs. Schätzung. */

import 'server-only'

import {
  beatMissAusSurprisePercent,
  beatMissProzent,
  formatBeatMissProzent,
} from '@/lib/portfolio-analyse/earnings-beat-miss'
import type { QuartalsPrognoseMetrik } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import { formatEpsUsd, formatKompaktUsd } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import { ladeFinnhubBeatMissHistorie } from '@/lib/portfolio-analyse/finnhub-beat-miss-historie-server'
import { ladeMarketbeatBeatMissHistorie } from '@/lib/portfolio-analyse/marketbeat-beat-miss-historie-server'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: EarningsBeatMissPaket }>()

export type BeatMissMetrik = {
  ist: number | null
  schaetzung: number | null
  surprisePct: number | null
  anzeige: string | null
}

export type BeatMissQuartal = {
  quartalLabel: string
  period: string | null
  eps: BeatMissMetrik
  umsatz: BeatMissMetrik
}

export type BeatMissQuelle = 'marketbeat' | 'finnhub' | 'kombiniert'

export type EarningsBeatMissPaket = {
  ok: boolean
  ticker: string
  quelle: BeatMissQuelle | null
  quartale: BeatMissQuartal[]
  epsBeatRatePct: number | null
  umsatzBeatRatePct: number | null
  epsBeats: number
  umsatzBeats: number
  bewertbarEps: number
  bewertbarUmsatz: number
  /** Letzte 12 Quartale */
  agg12?: BeatMissAggregate | null
  /** Letzte 20 Quartale */
  agg20?: BeatMissAggregate | null
  streak?: BeatMissStreak | null
  guidanceHinweis: string
  geladenAm: string
  fehler?: string | null
}

export type BeatMissAggregate = {
  fenster: 12 | 20
  epsBeatRatePct: number | null
  umsatzBeatRatePct: number | null
  epsBeats: number
  umsatzBeats: number
  bewertbarEps: number
  bewertbarUmsatz: number
}

export type BeatMissStreak = {
  eps: 'beat' | 'miss' | 'mixed' | null
  epsLaenge: number
  umsatz: 'beat' | 'miss' | 'mixed' | null
  umsatzLaenge: number
}

function metrikZeile(
  metrik: QuartalsPrognoseMetrik,
  ist: number | null | undefined,
  schaetzung: number | null | undefined,
  surpriseOverride?: number | null,
): BeatMissMetrik {
  const istVal = ist != null && Number.isFinite(ist) ? ist : null
  const schVal = schaetzung != null && Number.isFinite(schaetzung) ? schaetzung : null
  const surprisePct =
    surpriseOverride != null
      ? beatMissAusSurprisePercent(surpriseOverride) ?? beatMissProzent(istVal, schVal)
      : beatMissProzent(istVal, schVal)
  return {
    ist: istVal,
    schaetzung: schVal,
    surprisePct,
    anzeige: formatBeatMissProzent(surprisePct),
  }
}

function istBeat(m: BeatMissMetrik): boolean {
  return m.surprisePct != null && m.surprisePct > 0.05
}

function istMiss(m: BeatMissMetrik): boolean {
  return m.surprisePct != null && m.surprisePct < -0.05
}

function berechneAggregate(quartale: BeatMissQuartal[], fenster: 12 | 20): BeatMissAggregate {
  const slice = quartale.slice(0, fenster)
  let epsBeats = 0
  let umsatzBeats = 0
  let bewertbarEps = 0
  let bewertbarUmsatz = 0
  for (const q of slice) {
    if (q.eps.ist != null && q.eps.schaetzung != null) {
      bewertbarEps++
      if (istBeat(q.eps)) epsBeats++
    }
    if (q.umsatz.ist != null && q.umsatz.schaetzung != null) {
      bewertbarUmsatz++
      if (istBeat(q.umsatz)) umsatzBeats++
    }
  }
  return {
    fenster,
    epsBeatRatePct: bewertbarEps > 0 ? Math.round((epsBeats / bewertbarEps) * 100) : null,
    umsatzBeatRatePct: bewertbarUmsatz > 0 ? Math.round((umsatzBeats / bewertbarUmsatz) * 100) : null,
    epsBeats,
    umsatzBeats,
    bewertbarEps,
    bewertbarUmsatz,
  }
}

function berechneStreak(quartale: BeatMissQuartal[]): BeatMissStreak {
  const streakFuer = (pick: (q: BeatMissQuartal) => BeatMissMetrik): { art: 'beat' | 'miss' | 'mixed' | null; laenge: number } => {
    let art: 'beat' | 'miss' | null = null
    let laenge = 0
    for (const q of quartale) {
      const m = pick(q)
      if (m.ist == null || m.schaetzung == null) continue
      const cur = istBeat(m) ? 'beat' : istMiss(m) ? 'miss' : null
      if (!cur) break
      if (art == null) art = cur
      else if (art !== cur) return { art: 'mixed', laenge }
      laenge++
    }
    return { art, laenge }
  }
  const eps = streakFuer((q) => q.eps)
  const umsatz = streakFuer((q) => q.umsatz)
  return {
    eps: eps.art,
    epsLaenge: eps.laenge,
    umsatz: umsatz.art,
    umsatzLaenge: umsatz.laenge,
  }
}

function baueGuidanceHinweis(
  epsBeats: number,
  bewertbarEps: number,
  umsatzBeats: number,
  bewertbarUmsatz: number,
): string {
  if (bewertbarEps === 0 && bewertbarUmsatz === 0) {
    return 'Keine vergleichbaren Schätzungen gefunden (MarketBeat / Finnhub).'
  }
  const parts: string[] = []
  if (bewertbarEps > 0) {
    const rate = Math.round((epsBeats / bewertbarEps) * 100)
    if (rate >= 75) parts.push(`EPS: ${epsBeats}/${bewertbarEps} Beats (${rate}%) — Management guidet eher konservativ`)
    else if (rate <= 35) parts.push(`EPS: ${epsBeats}/${bewertbarEps} Beats (${rate}%) — häufige Misses, Guidance prüfen`)
    else parts.push(`EPS: ${epsBeats}/${bewertbarEps} Beats (${rate}%)`)
  }
  if (bewertbarUmsatz > 0) {
    const rate = Math.round((umsatzBeats / bewertbarUmsatz) * 100)
    parts.push(`Umsatz: ${umsatzBeats}/${bewertbarUmsatz} Beats (${rate}%)`)
  }
  return parts.join(' · ')
}

function mergeQuartale(
  mb: Awaited<ReturnType<typeof ladeMarketbeatBeatMissHistorie>>,
  fh: Awaited<ReturnType<typeof ladeFinnhubBeatMissHistorie>>,
  limit: number,
): { quartale: BeatMissQuartal[]; quelle: BeatMissQuelle | null } {
  const byLabel = new Map<string, BeatMissQuartal>()

  for (const row of mb) {
    byLabel.set(row.quartalLabel, {
      quartalLabel: row.quartalLabel,
      period: row.period,
      eps: metrikZeile('eps', row.epsIst, row.epsSchaetzung),
      umsatz: metrikZeile('umsatz', row.umsatzIst, row.umsatzSchaetzung),
    })
  }

  for (const row of fh) {
    const prev = byLabel.get(row.quartalLabel)
    const eps = metrikZeile('eps', row.epsIst, row.epsSchaetzung, row.surprisePercent)
    if (prev) {
      if (prev.eps.ist == null && prev.eps.schaetzung == null) prev.eps = eps
      else if (prev.eps.schaetzung == null && eps.schaetzung != null) {
        prev.eps = metrikZeile('eps', prev.eps.ist ?? eps.ist, eps.schaetzung, row.surprisePercent)
      }
    } else {
      byLabel.set(row.quartalLabel, {
        quartalLabel: row.quartalLabel,
        period: row.period,
        eps,
        umsatz: metrikZeile('umsatz', null, null),
      })
    }
  }

  const quartale = [...byLabel.values()]
    .sort((a, b) => (b.period ?? b.quartalLabel).localeCompare(a.period ?? a.quartalLabel))
    .slice(0, limit)

  let quelle: BeatMissQuelle | null = null
  if (mb.length && fh.length) quelle = 'kombiniert'
  else if (mb.length) quelle = 'marketbeat'
  else if (fh.length) quelle = 'finnhub'

  return { quartale, quelle }
}

export async function ladeEarningsBeatMissHistorie(opts: {
  ticker: string
  symbolYahoo?: string | null
  isin?: string | null
  limit?: number
  force?: boolean
}): Promise<EarningsBeatMissPaket> {
  const ticker = opts.ticker.trim().toUpperCase()
  const limit = opts.limit ?? 8
  const fetchLimit = Math.max(limit, 20)
  const key = `${ticker}|${opts.symbolYahoo ?? ''}|${opts.isin ?? ''}|${limit}`
  const hit = cache.get(key)
  if (hit && hit.at + CACHE_MS > Date.now() && !opts.force) return hit.data

  try {
    const [mb, fh] = await Promise.all([
      ladeMarketbeatBeatMissHistorie({ ticker, symbolYahoo: opts.symbolYahoo, limit: fetchLimit }),
      ladeFinnhubBeatMissHistorie({
        ticker,
        symbolYahoo: opts.symbolYahoo,
        isin: opts.isin,
        limit: fetchLimit,
      }),
    ])

    const { quartale: quartaleAlle, quelle } = mergeQuartale(mb, fh, fetchLimit)
    const quartale = quartaleAlle.slice(0, limit)

    let epsBeats = 0
    let umsatzBeats = 0
    let bewertbarEps = 0
    let bewertbarUmsatz = 0
    for (const q of quartale) {
      if (q.eps.ist != null && q.eps.schaetzung != null) {
        bewertbarEps++
        if (istBeat(q.eps)) epsBeats++
      }
      if (q.umsatz.ist != null && q.umsatz.schaetzung != null) {
        bewertbarUmsatz++
        if (istBeat(q.umsatz)) umsatzBeats++
      }
    }

    const paket: EarningsBeatMissPaket = {
      ok: quartale.length > 0,
      ticker,
      quelle,
      quartale,
      epsBeatRatePct: bewertbarEps > 0 ? Math.round((epsBeats / bewertbarEps) * 100) : null,
      umsatzBeatRatePct: bewertbarUmsatz > 0 ? Math.round((umsatzBeats / bewertbarUmsatz) * 100) : null,
      epsBeats,
      umsatzBeats,
      bewertbarEps,
      bewertbarUmsatz,
      agg12: quartaleAlle.length >= 4 ? berechneAggregate(quartaleAlle, 12) : null,
      agg20: quartaleAlle.length >= 8 ? berechneAggregate(quartaleAlle, 20) : null,
      streak: quartaleAlle.length > 0 ? berechneStreak(quartaleAlle) : null,
      guidanceHinweis: baueGuidanceHinweis(epsBeats, bewertbarEps, umsatzBeats, bewertbarUmsatz),
      geladenAm: new Date().toISOString(),
    }
    cache.set(key, { at: Date.now(), data: paket })
    return paket
  } catch (e) {
    return {
      ok: false,
      ticker,
      quelle: null,
      quartale: [],
      epsBeatRatePct: null,
      umsatzBeatRatePct: null,
      epsBeats: 0,
      umsatzBeats: 0,
      bewertbarEps: 0,
      bewertbarUmsatz: 0,
      guidanceHinweis: '',
      geladenAm: new Date().toISOString(),
      fehler: e instanceof Error ? e.message : 'Beat/Miss-Historie fehlgeschlagen',
    }
  }
}

export function formatBeatMissIst(metrik: QuartalsPrognoseMetrik, v: number): string {
  return metrik === 'eps' ? formatEpsUsd(v) : formatKompaktUsd(v)
}

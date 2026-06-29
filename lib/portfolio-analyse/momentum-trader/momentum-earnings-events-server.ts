/**
 * Earnings-Events: Gap/RVOL aus Bars berechnen und Historie pflegen.
 */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { reichereEventsMitEpsSurprise } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-enrich-server'
import { findeEarningsReaktionsBar } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-bar'
import {
  ladeHistorischeEarningsTermine,
  standardHistorieVonIso,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-historie-server'
import {
  ladeBerichtszeitFuerEarningsDatum,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-termine-server'
import {
  ladeMomentumBars,
  ladeMomentumEarningsEventsFuerSymbol,
  speichereMomentumEarningsEvents,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import {
  berechneGapPct,
  berechneRvol,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import type {
  MomentumBarDaily,
  MomentumEarningsEvent,
  MomentumEarningsZeit,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const PAUSE_MS = 2_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

import {
  primaeresAnzeigeSymbol,
  primaeresEarningsSymbol,
  symbolKandidatenFuerEarnings,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'

export function berechneEventAusBars(
  symbol: string,
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
  bars: MomentumBarDaily[],
): MomentumEarningsEvent | null {
  const reaktion = findeEarningsReaktionsBar(bars, earningsDate, timeBmoAmc)
  if (!reaktion) return null

  const bar = bars[reaktion.barIdx]
  const gapPct = berechneGapPct(bar, reaktion.prevClose)
  const rvol = berechneRvol(bars, reaktion.barIdx)

  return {
    symbol,
    earningsDate,
    timeBmoAmc: reaktion.effektiveZeit,
    epsEstimate: null,
    epsActual: null,
    revenueEstimate: null,
    revenueActual: null,
    surpriseEpsPct: null,
    surpriseRevPct: null,
    guidanceFlag: 'unknown',
    pricePrevClose: reaktion.prevClose,
    openGap: bar.open,
    closeDay1: bar.close,
    gapPct,
    rvol,
  }
}

export function medianGapAbsPct(events: MomentumEarningsEvent[]): number | null {
  const gaps = events.map((e) => e.gapPct).filter((g): g is number => g != null && Number.isFinite(g))
  if (gaps.length < 2) return null
  const abs = gaps.map((g) => Math.abs(g)).sort((a, b) => a - b)
  const mid = Math.floor(abs.length / 2)
  return abs.length % 2 === 0 ? (abs[mid - 1] + abs[mid]) / 2 : abs[mid]
}

/** Median oder Einzel-Event-Fallback für Pre-Event-Scoring. */
export function gapVolatilitaetSchaetzung(events: MomentumEarningsEvent[]): {
  medianGapPct: number | null
  eventsMitGap: number
  beatRatePct: number | null
  avgSurprisePct: number | null
} {
  const mitGap = events.filter((e) => e.gapPct != null && Number.isFinite(e.gapPct))
  const median = medianGapAbsPct(events)
  const fallback =
    median ??
    (mitGap.length === 1 && mitGap[0].gapPct != null ? Math.abs(mitGap[0].gapPct) : null)

  const surprises = events
    .map((e) => e.surpriseEpsPct)
    .filter((s): s is number => s != null && Number.isFinite(s))
  const beats = surprises.filter((s) => s > 0).length

  return {
    medianGapPct: fallback,
    eventsMitGap: mitGap.length,
    beatRatePct: surprises.length > 0 ? Math.round((beats / surprises.length) * 100) : null,
    avgSurprisePct:
      surprises.length > 0
        ? Math.round((surprises.reduce((a, b) => a + b, 0) / surprises.length) * 10) / 10
        : null,
  }
}

export async function ladeBarsFuerEarningsGap(
  eintrag: MomentumWatchlistEintrag,
  vonBars: string,
  heute: string,
): Promise<MomentumBarDaily[]> {
  const earningsSym = primaeresEarningsSymbol(eintrag)
  const anzeige = primaeresAnzeigeSymbol(eintrag)
  const tryOrder = [
    earningsSym,
    anzeige,
    ...eintrag.symbolCandidates.map((s) => s.trim().toUpperCase()),
    eintrag.symbolYahoo?.trim().toUpperCase(),
  ].filter((s, i, a): s is string => Boolean(s) && a.indexOf(s) === i)

  let best: MomentumBarDaily[] = []
  for (const sym of tryOrder) {
    const bars = await ladeMomentumBars(sym, vonBars, heute)
    if (bars.length > best.length) best = bars
    if (bars.length >= 40 && sym === earningsSym) break
  }
  return best
}

/** Einzelner Watchlist-Titel: Termine + Bars → Events (3 Jahre, MarketBeat-Batch). */
export async function backfillEarningsEventsFuerEintrag(
  e: MomentumWatchlistEintrag,
): Promise<{ geschrieben: number; fehler: string[] }> {
  return backfillEarningsEventsFuerWatchlist([e])
}

/** DivvyDiary + MarketBeat (3J) + Bars → momentum_earnings_events. */
export async function backfillEarningsEventsFuerWatchlist(
  watchlist: MomentumWatchlistEintrag[],
): Promise<{ geschrieben: number; fehler: string[] }> {
  const heute = heuteIsoUtc()
  const von = standardHistorieVonIso()
  const vonBars = addDaysIso(heute, -500)
  const fehler: string[] = []
  let geschrieben = 0

  for (let i = 0; i < watchlist.length; i++) {
    const e = watchlist[i]
    const anzeige = primaeresAnzeigeSymbol(e)
    const earningsSym = primaeresEarningsSymbol(e)
    const storeSymbol = earningsSym ?? anzeige
    if (!storeSymbol || !earningsSym) {
      fehler.push(e.isin + ': kein Symbol')
      continue
    }

    if (i > 0) await sleep(PAUSE_MS)

    try {
      const termine = (await ladeHistorischeEarningsTermine(e, von, heute)).filter(
        (t) => t.terminDatumIso <= heute,
      )
      const bars = await ladeBarsFuerEarningsGap(e, vonBars, heute)
      if (bars.length < 5) {
        fehler.push((anzeige ?? storeSymbol) + ': zu wenig Bars für Backfill (auch ' + earningsSym + ' probiert)')
        continue
      }

      const events: MomentumEarningsEvent[] = []
      for (const t of termine) {
        let zeit = t.timeBmoAmc
        if (zeit === 'unknown') {
          zeit = await ladeBerichtszeitFuerEarningsDatum(earningsSym, t.terminDatumIso, earningsSym)
        }
        const ev = berechneEventAusBars(storeSymbol, t.terminDatumIso, zeit, bars)
        if (ev) events.push(ev)
      }

      const angereichert = await reichereEventsMitEpsSurprise(events, earningsSym)

      if (angereichert.length > 0) {
        geschrieben += await speichereMomentumEarningsEvents(angereichert)
        const mitGap = angereichert.filter((ev) => ev.gapPct != null)
        if (mitGap.length < 4 && termine.length > mitGap.length) {
          fehler.push(
            storeSymbol +
              ': nur ' +
              mitGap.length +
              ' Gap-Events — ggf. mehr Bars oder US-Ticker prüfen (' +
              earningsSym +
              ')',
          )
        }
      } else if (termine.length > 0) {
        fehler.push(storeSymbol + ': ' + termine.length + ' Termine, aber keine Gap-Events aus Bars berechenbar')
      }
    } catch (err) {
      fehler.push(e.isin + ': ' + String(err))
    }
  }

  return { geschrieben, fehler }
}

/** Events für Watchlist-Titel (Anzeige- + US-Ticker). */
export async function ladeEarningsEventsFuerWatchlistEintrag(
  eintrag: MomentumWatchlistEintrag,
): Promise<MomentumEarningsEvent[]> {
  const sym = primaeresAnzeigeSymbol(eintrag)
  const earn = primaeresEarningsSymbol(eintrag)
  const listen = await Promise.all([
    sym ? ladeMomentumEarningsEventsFuerSymbol(sym) : Promise.resolve([]),
    earn && earn !== sym ? ladeMomentumEarningsEventsFuerSymbol(earn) : Promise.resolve([]),
  ])
  const map = new Map<string, MomentumEarningsEvent>()
  for (const ev of [...listen[0], ...listen[1]]) {
    const prev = map.get(ev.earningsDate)
    if (!prev || (ev.gapPct != null && prev.gapPct == null)) map.set(ev.earningsDate, ev)
  }
  return [...map.values()].sort((a, b) => b.earningsDate.localeCompare(a.earningsDate))
}

export async function ladeMedianGapFuerSymbol(symbol: string): Promise<number | null> {
  const events = await ladeMomentumEarningsEventsFuerSymbol(symbol)
  return medianGapAbsPct(events)
}

/** Tage bis zum nächsten Earnings (null wenn keins). */
export function tageBisNaechstesEarnings(
  earningsDate: string | null | undefined,
  heute = heuteIsoUtc(),
): number | null {
  if (!earningsDate || earningsDate < heute) return null
  return tageZwischenIso(heute, earningsDate)
}

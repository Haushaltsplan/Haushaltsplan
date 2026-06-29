/**
 * Earnings-Events: Gap/RVOL aus Bars berechnen und Historie pflegen.
 */

import 'server-only'

import { heuteIsoUtc, isoVorJahren, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeDivvydiaryEarningsTermine } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
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

function primaeresSymbol(e: MomentumWatchlistEintrag): string | null {
  return e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
}

function findeBarAbDatum(bars: MomentumBarDaily[], abDatum: string): number | null {
  const idx = bars.findIndex((b) => b.handelstag >= abDatum)
  return idx >= 0 ? idx : null
}

export function berechneEventAusBars(
  symbol: string,
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
  bars: MomentumBarDaily[],
): MomentumEarningsEvent | null {
  const barIdx = findeBarAbDatum(bars, earningsDate)
  if (barIdx == null || barIdx < 1) return null

  const bar = bars[barIdx]
  const prevClose = bars[barIdx - 1].close
  const gapPct = berechneGapPct(bar, prevClose)
  const rvol = berechneRvol(bars, barIdx)

  return {
    symbol,
    earningsDate,
    timeBmoAmc,
    epsEstimate: null,
    epsActual: null,
    revenueEstimate: null,
    revenueActual: null,
    surpriseEpsPct: null,
    surpriseRevPct: null,
    guidanceFlag: 'unknown',
    pricePrevClose: prevClose,
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

/** DivvyDiary-Historie (1 Jahr) + Bars → momentum_earnings_events. */
export async function backfillEarningsEventsFuerWatchlist(
  watchlist: MomentumWatchlistEintrag[],
): Promise<{ geschrieben: number; fehler: string[] }> {
  const heute = heuteIsoUtc()
  const von = isoVorJahren(1)
  const vonBars = addDaysIso(heute, -400)
  const fehler: string[] = []
  let geschrieben = 0

  for (let i = 0; i < watchlist.length; i++) {
    const e = watchlist[i]
    const symbol = primaeresSymbol(e)
    if (!symbol) {
      fehler.push(e.isin + ': kein Symbol')
      continue
    }

    if (i > 0) await sleep(PAUSE_MS)

    try {
      const name = isinKenntnis(e.isin)?.name ?? e.name
      const termine = await ladeDivvydiaryEarningsTermine(e.isin, name, von, heute)
      const bars = await ladeMomentumBars(symbol, vonBars, heute)
      if (bars.length < 5) {
        fehler.push(symbol + ': zu wenig Bars für Backfill')
        continue
      }

      const events: MomentumEarningsEvent[] = []
      for (const t of termine) {
        if (t.terminDatumIso > heute) continue
        const ev = berechneEventAusBars(symbol, t.terminDatumIso, 'unknown', bars)
        if (ev) events.push(ev)
      }

      if (events.length > 0) {
        geschrieben += await speichereMomentumEarningsEvents(events)
      }
    } catch (err) {
      fehler.push(e.isin + ': ' + String(err))
    }
  }

  return { geschrieben, fehler }
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

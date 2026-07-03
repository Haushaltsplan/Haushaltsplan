/**
 * Playbook-Stats — Backtest ausführen, speichern, für Erfolgs-Kalibrierung laden.
 */

import 'server-only'

import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  BACKTEST_LOOKBACK_TAGE,
  BACKTEST_MIN_SAMPLES_GLOBAL,
  PLAYBOOK_MIN_BACKTEST_TREFFER_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  ladeMomentumBars,
  ladeMomentumEarningsEventsFuerSymbole,
  ladeMomentumEarningsKalenderFuerSymbole,
  momentumSupabaseKonfiguriert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import {
  fuehrePlaybookBacktestAus,
  type BacktestEingabe,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-backtest-server'
import { sektorEtfSymbol } from '@/lib/portfolio-analyse/momentum-trader/momentum-sektor-etf-server'
import { primaeresAnzeigeSymbol } from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'
import { MOMENTUM_REGIME_SYMBOLS } from '@/lib/portfolio-analyse/momentum-trader/momentum-universe'
import type {
  MomentumPlaybook,
  MomentumPlaybookStat,
  MomentumPlaybookStatsPaket,
  MomentumScanEintrag,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { holeSektorenBatch } from '@/lib/portfolio-analyse/sektor-batch-server'

const TABLE_STATS = 'momentum_playbook_stats' as const
const SPY_SYMBOL = MOMENTUM_REGIME_SYMBOLS[0]

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

type StatsDbZeile = {
  playbook: string
  symbol: string
  wins: number
  losses: number
  timeouts: number
  treffer_pct: number | null
  fenster_tage: number
  berechnet_am: string
}

function dbZuStat(row: StatsDbZeile): MomentumPlaybookStat {
  return {
    playbook: row.playbook as MomentumPlaybook,
    symbol: row.symbol,
    wins: row.wins,
    losses: row.losses,
    timeouts: row.timeouts,
    sampleSize: row.wins + row.losses + row.timeouts,
    trefferPct: row.treffer_pct != null ? Number(row.treffer_pct) : null,
    fensterTage: row.fenster_tage,
    berechnetAm: row.berechnet_am,
  }
}

function statZuDb(s: MomentumPlaybookStat): StatsDbZeile {
  return {
    playbook: s.playbook,
    symbol: s.symbol,
    wins: s.wins,
    losses: s.losses,
    timeouts: s.timeouts,
    treffer_pct: s.trefferPct,
    fenster_tage: s.fensterTage,
    berechnet_am: s.berechnetAm,
  }
}

export type MomentumPlaybookStatsLookup = {
  /** Global (symbol leer) */
  global: Map<MomentumPlaybook, MomentumPlaybookStat>
  /** Pro Symbol */
  symbol: Map<string, MomentumPlaybookStat>
}

export function baueStatsLookup(stats: MomentumPlaybookStat[]): MomentumPlaybookStatsLookup {
  const global = new Map<MomentumPlaybook, MomentumPlaybookStat>()
  const symbol = new Map<string, MomentumPlaybookStat>()
  for (const s of stats) {
    if (!s.symbol) global.set(s.playbook, s)
    else symbol.set(s.playbook + '|' + s.symbol, s)
  }
  return { global, symbol }
}

/** Beste verfügbare Statistik für Playbook + optionales Symbol. */
export function findePlaybookStat(
  lookup: MomentumPlaybookStatsLookup | null,
  playbook: MomentumPlaybook,
  symbol: string,
): MomentumPlaybookStat | null {
  if (!lookup) return null
  const sym = lookup.symbol.get(playbook + '|' + symbol)
  if (sym && sym.sampleSize >= 5) return sym
  return lookup.global.get(playbook) ?? sym ?? null
}

/** Playbook aktiv wenn genug Backtest-Daten fehlen oder Trefferquote OK. */
export function istPlaybookBacktestAktiv(
  lookup: MomentumPlaybookStatsLookup | null,
  playbook: MomentumPlaybook,
): boolean {
  if (!lookup) return true
  const stat = lookup.global.get(playbook)
  if (!stat || stat.sampleSize < BACKTEST_MIN_SAMPLES_GLOBAL) return true
  if (stat.trefferPct == null) return true
  return stat.trefferPct >= PLAYBOOK_MIN_BACKTEST_TREFFER_PCT
}

/** Schwache Playbooks pausieren (nach Erfolgs-Kalibrierung). */
export function wendePlaybookDeaktivierungAn(
  ergebnisse: MomentumScanEintrag[],
  lookup: MomentumPlaybookStatsLookup | null,
): MomentumScanEintrag[] {
  if (!lookup) return ergebnisse
  return ergebnisse.map((e) => {
    if (istPlaybookBacktestAktiv(lookup, e.playbook)) return e
    const stat = lookup.global.get(e.playbook)
    if (!stat) return e
    const grund =
      'Backtest ' +
      stat.wins +
      '/' +
      stat.sampleSize +
      ' (' +
      stat.trefferPct +
      '%) unter ' +
      PLAYBOOK_MIN_BACKTEST_TREFFER_PCT +
      '% — pausiert'
    return {
      ...e,
      indikatoren: {
        ...e.indikatoren,
        playbookDeaktiviert: true,
        playbookDeaktiviertGrund: grund,
        erfolgIstAktiv: false,
        handlungKurz: 'Pausiert — schwache historische Trefferquote',
      },
    }
  })
}

export async function ladePlaybookStats(): Promise<MomentumPlaybookStatsPaket> {
  if (!momentumSupabaseKonfiguriert()) {
    return { stats: [], berechnetAm: null, fensterTage: BACKTEST_LOOKBACK_TAGE }
  }
  const { data, error } = await createSupabaseAdmin()
    .from(TABLE_STATS)
    .select('*')
    .order('playbook')
  if (error || !data?.length) {
    return { stats: [], berechnetAm: null, fensterTage: BACKTEST_LOOKBACK_TAGE }
  }
  const stats = (data as StatsDbZeile[]).map(dbZuStat)
  const berechnetAm = stats.reduce<string | null>((max, s) => {
    if (!max || s.berechnetAm > max) return s.berechnetAm
    return max
  }, null)
  const fensterTage = stats[0]?.fensterTage ?? BACKTEST_LOOKBACK_TAGE
  return { stats, berechnetAm, fensterTage }
}

export async function speicherePlaybookStats(stats: MomentumPlaybookStat[]): Promise<number> {
  if (!momentumSupabaseKonfiguriert() || stats.length === 0) return 0
  const { error } = await createSupabaseAdmin()
    .from(TABLE_STATS)
    .upsert(stats.map(statZuDb), { onConflict: 'playbook,symbol' })
  if (error) throw new Error(error.message)
  return stats.length
}

async function baueBacktestEingaben(
  watchlist: MomentumWatchlistEintrag[],
  fensterTage: number,
): Promise<BacktestEingabe[]> {
  const heute = heuteIsoUtc()
  const vonBars = addDaysIso(heute, -fensterTage - 120)

  const sektorMap = await holeSektorenBatch(
    watchlist.map((e) => ({ isin: e.isin, symbolYahoo: e.symbolYahoo, name: e.name })),
  )
  const spyBars = await ladeMomentumBars(SPY_SYMBOL, vonBars, heute)
  const symbole = watchlist
    .map((e) => primaeresAnzeigeSymbol(e))
    .filter((s): s is string => Boolean(s))
  if (symbole.length === 0) return []

  const [kalender, events] = await Promise.all([
    ladeMomentumEarningsKalenderFuerSymbole(symbole),
    ladeMomentumEarningsEventsFuerSymbole(symbole, { seitIso: vonBars }),
  ])

  const sectorEtfs = new Set<string>()
  for (const e of watchlist) {
    const sym = primaeresAnzeigeSymbol(e)
    if (!sym) continue
    const sektor = sektorMap[e.isin]?.sektor ?? sektorMap[sym]?.sektor ?? null
    const etf = sektorEtfSymbol(sektor)
    if (etf) sectorEtfs.add(etf)
  }
  const sectorBarsCache = new Map<string, Awaited<ReturnType<typeof ladeMomentumBars>>>()
  await Promise.all(
    [...sectorEtfs].map(async (etf) => {
      sectorBarsCache.set(etf, await ladeMomentumBars(etf, vonBars, heute))
    }),
  )

  const eingaben: BacktestEingabe[] = []
  for (const e of watchlist) {
    const sym = primaeresAnzeigeSymbol(e)
    if (!sym) continue
    const bars = await ladeMomentumBars(sym, vonBars, heute)
    if (bars.length < 60) continue
    const sektor = sektorMap[e.isin]?.sektor ?? sektorMap[sym]?.sektor ?? null
    const etf = sektorEtfSymbol(sektor)
    eingaben.push({
      symbol: sym,
      bars,
      spyBars,
      sectorBars: etf ? (sectorBarsCache.get(etf) ?? []) : [],
      sectorEtf: etf,
      kalender,
      events: events.filter((ev) => ev.symbol === sym),
    })
  }
  return eingaben
}

/** Backtest über Watchlist ausführen und in DB speichern. */
export async function berechneUndSpeicherePlaybookStats(
  watchlist: MomentumWatchlistEintrag[],
  fensterTage = BACKTEST_LOOKBACK_TAGE,
): Promise<MomentumPlaybookStatsPaket> {
  const eingaben = await baueBacktestEingaben(watchlist, fensterTage)
  if (eingaben.length === 0) {
    return { stats: [], berechnetAm: null, fensterTage }
  }
  const stats = fuehrePlaybookBacktestAus(eingaben, fensterTage)
  await speicherePlaybookStats(stats)
  const berechnetAm = stats[0]?.berechnetAm ?? new Date().toISOString()
  return { stats, berechnetAm, fensterTage }
}

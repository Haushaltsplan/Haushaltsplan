/**
 * Top-Signal-Tracking — archiviert aktive Signale und wertet Forward-Outcomes aus.
 */

import 'server-only'

import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { simuliereTradeOutcome } from '@/lib/portfolio-analyse/momentum-trader/momentum-backtest-outcome'
import {
  BACKTEST_HOLD_TAGE,
  TRADE_TOP_MIN_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { ladeMomentumBars } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import type {
  MomentumAmpel,
  MomentumBarDaily,
  MomentumPlaybook,
  MomentumRichtung,
  MomentumScanEintrag,
  MomentumTopSignalEintrag,
  MomentumTopSignalOutcome,
  MomentumTopSignalPlaybookStat,
  MomentumTopSignalTracking,
  MomentumTrade,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const TABLE = 'momentum_top_signals' as const
const FENSTER_TAGE = 365

type TopSignalDbZeile = {
  symbol: string
  playbook: string
  scan_date: string
  direction: string
  score: number
  ampel: string
  erfolg_pct: number
  entry_price: number
  stop_price: number
  target_price: number
  outcome: string
}

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function alsZahl(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function istTopSignal(e: MomentumScanEintrag): boolean {
  if (e.indikatoren.erfolgIstAktiv !== true) return false
  if (e.indikatoren.konflikt === true) return false
  if (e.indikatoren.playbookDeaktiviert === true) return false
  const pct = alsZahl(e.indikatoren.erfolgWahrscheinlichkeitPct)
  if (pct != null && pct < TRADE_TOP_MIN_PCT) return false
  const r = e.indikatoren.richtung ?? e.indikatoren.erfolgRichtung
  if (r !== 'long' && r !== 'short') return false
  const entry = alsZahl(e.indikatoren.entryPrice)
  const stop = alsZahl(e.indikatoren.stopPrice)
  const target = alsZahl(e.indikatoren.targetPrice)
  return entry != null && stop != null && target != null && entry > 0
}

function scanZuTopSignalZeile(e: MomentumScanEintrag): Record<string, unknown> | null {
  if (!istTopSignal(e)) return null
  const r = (e.indikatoren.richtung ?? e.indikatoren.erfolgRichtung) as MomentumRichtung
  const pct = alsZahl(e.indikatoren.erfolgWahrscheinlichkeitPct) ?? 0
  return {
    symbol: e.symbol.trim().toUpperCase(),
    playbook: e.playbook,
    scan_date: e.scanDate,
    direction: r,
    score: e.score,
    ampel: e.ampel,
    erfolg_pct: Math.round(pct),
    entry_price: e.indikatoren.entryPrice,
    stop_price: e.indikatoren.stopPrice,
    target_price: e.indikatoren.targetPrice,
    outcome: 'pending',
  }
}

function findeEntryBarIdx(bars: MomentumBarDaily[], scanDate: string): number {
  return bars.findIndex((b) => b.handelstag >= scanDate)
}

function dbZuEintrag(
  row: TopSignalDbZeile,
  journal: MomentumTrade | null,
): MomentumTopSignalEintrag {
  return {
    symbol: row.symbol,
    playbook: row.playbook as MomentumPlaybook,
    scanDate: row.scan_date,
    direction: row.direction as MomentumRichtung,
    score: row.score,
    ampel: row.ampel as MomentumAmpel,
    erfolgPct: row.erfolg_pct,
    entryPrice: Number(row.entry_price),
    stopPrice: Number(row.stop_price),
    targetPrice: Number(row.target_price),
    outcome: row.outcome as MomentumTopSignalOutcome,
    imJournal: journal != null,
    journalPnlEur: journal?.pnlEur ?? null,
    journalGeschlossen: journal != null && journal.exitPrice != null && journal.pnlEur != null,
  }
}

function findeJournalTrade(
  trades: MomentumTrade[],
  symbol: string,
  playbook: MomentumPlaybook,
  scanDate: string,
): MomentumTrade | null {
  const sym = symbol.trim().toUpperCase()
  return (
    trades.find(
      (t) =>
        t.symbol.trim().toUpperCase() === sym &&
        t.playbook === playbook &&
        (t.scanDate === scanDate ||
          t.entryDate === scanDate ||
          (t.ausScan && t.entryDate >= scanDate && t.entryDate <= addDaysIso(scanDate, 3))),
    ) ?? null
  )
}

/** Top-Signale nach Scan archivieren (upsert). */
export async function archiviereTopSignale(ergebnisse: MomentumScanEintrag[]): Promise<number> {
  if (!istKonfiguriert()) return 0
  const zeilen = ergebnisse.map(scanZuTopSignalZeile).filter((z): z is Record<string, unknown> => z != null)
  if (zeilen.length === 0) return 0

  const { error } = await createSupabaseAdmin()
    .from(TABLE)
    .upsert(zeilen, { onConflict: 'symbol,playbook,scan_date', ignoreDuplicates: true })
  if (error) {
    console.warn('[top-signal] Archivieren:', error.message)
    return 0
  }
  return zeilen.length
}

/** Historische Top-Signale aus momentum_scan_results nachziehen. */
export async function synchronisiereTopSignaleAusScanResults(symbole: string[], seitIso: string): Promise<number> {
  if (!istKonfiguriert() || symbole.length === 0) return 0
  const norm = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))]

  const { data, error } = await createSupabaseAdmin()
    .from('momentum_scan_results')
    .select('scan_date, symbol, playbook, score, ampel, indikatoren')
    .in('symbol', norm)
    .gte('scan_date', seitIso)
    .order('scan_date', { ascending: true })

  if (error || !data?.length) return 0

  const zeilen: Record<string, unknown>[] = []
  for (const row of data as Array<{
    scan_date: string
    symbol: string
    playbook: string
    score: number
    ampel: string
    indikatoren: Record<string, unknown>
  }>) {
    const ind = row.indikatoren ?? {}
    const e: MomentumScanEintrag = {
      scanDate: row.scan_date,
      symbol: row.symbol,
      playbook: row.playbook as MomentumPlaybook,
      score: row.score,
      ampel: row.ampel as MomentumAmpel,
      gatesPassed: [],
      gatesFailed: [],
      indikatoren: ind as MomentumScanEintrag['indikatoren'],
    }
    const z = scanZuTopSignalZeile(e)
    if (z) zeilen.push(z)
  }

  if (zeilen.length === 0) return 0

  const { error: upsertErr } = await createSupabaseAdmin()
    .from(TABLE)
    .upsert(zeilen, { onConflict: 'symbol,playbook,scan_date', ignoreDuplicates: true })
  if (upsertErr) {
    console.warn('[top-signal] Sync aus scan_results:', upsertErr.message)
    return 0
  }
  return zeilen.length
}

/** Ausstehende Signale per Bar-Simulation auflösen. */
export async function loeseTopSignalOutcomes(symbole: string[]): Promise<number> {
  if (!istKonfiguriert() || symbole.length === 0) return 0
  const norm = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))]

  const { data, error } = await createSupabaseAdmin()
    .from(TABLE)
    .select('*')
    .in('symbol', norm)
    .eq('outcome', 'pending')
    .order('scan_date', { ascending: true })

  if (error || !data?.length) return 0

  const barsCache = new Map<string, MomentumBarDaily[]>()
  let resolved = 0
  const jetzt = new Date().toISOString()

  for (const row of data as TopSignalDbZeile[]) {
    let bars = barsCache.get(row.symbol)
    if (!bars) {
      bars = await ladeMomentumBars(row.symbol)
      barsCache.set(row.symbol, bars)
    }
    const entryIdx = findeEntryBarIdx(bars, row.scan_date)
    if (entryIdx < 0 || entryIdx + BACKTEST_HOLD_TAGE >= bars.length) continue

    const outcome = simuliereTradeOutcome(
      bars,
      entryIdx,
      Number(row.entry_price),
      Number(row.stop_price),
      Number(row.target_price),
      row.direction as MomentumRichtung,
      BACKTEST_HOLD_TAGE,
    )

    const { error: updErr } = await createSupabaseAdmin()
      .from(TABLE)
      .update({ outcome, outcome_resolved_am: jetzt })
      .eq('symbol', row.symbol)
      .eq('playbook', row.playbook)
      .eq('scan_date', row.scan_date)
      .eq('outcome', 'pending')

    if (!updErr) resolved++
  }

  return resolved
}

async function ladeTopSignaleDb(symbole: string[], seitIso: string): Promise<TopSignalDbZeile[]> {
  if (!istKonfiguriert() || symbole.length === 0) return []
  const norm = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))]

  const { data, error } = await createSupabaseAdmin()
    .from(TABLE)
    .select('*')
    .in('symbol', norm)
    .gte('scan_date', seitIso)
    .order('scan_date', { ascending: false })

  if (error || !data) return []
  return data as TopSignalDbZeile[]
}

/** Vollständiges Top-Signal-Tracking inkl. Journal-Vergleich. */
export async function berechneTopSignalTracking(
  symbole: string[],
  trades: MomentumTrade[] = [],
): Promise<MomentumTopSignalTracking> {
  const heute = heuteIsoUtc()
  const seitIso = addDaysIso(heute, -FENSTER_TAGE)

  await synchronisiereTopSignaleAusScanResults(symbole, seitIso)
  await loeseTopSignalOutcomes(symbole)

  const rows = await ladeTopSignaleDb(symbole, seitIso)
  const eintraege: MomentumTopSignalEintrag[] = rows.map((row) =>
    dbZuEintrag(row, findeJournalTrade(trades, row.symbol, row.playbook as MomentumPlaybook, row.scan_date)),
  )

  const ausgewertet = eintraege.filter((e) => e.outcome !== 'pending')
  const gewinne = ausgewertet.filter((e) => e.outcome === 'win').length
  const verluste = ausgewertet.filter((e) => e.outcome === 'loss').length
  const timeouts = ausgewertet.filter((e) => e.outcome === 'timeout').length
  const trefferquotePct =
    ausgewertet.length > 0 ? Math.round((gewinne / ausgewertet.length) * 100) : null

  const avgVorhersagePct =
    ausgewertet.length > 0
      ? Math.round(ausgewertet.reduce((s, e) => s + e.erfolgPct, 0) / ausgewertet.length)
      : null
  const kalibrierungsDeltaPct =
    trefferquotePct != null && avgVorhersagePct != null ? trefferquotePct - avgVorhersagePct : null

  const journalEintraege = eintraege.filter((e) => e.imJournal)
  const journalGeschlossen = journalEintraege.filter((e) => e.journalGeschlossen)
  const journalWins = journalGeschlossen.filter((e) => (e.journalPnlEur ?? 0) > 0).length
  const journalWinRatePct =
    journalGeschlossen.length > 0 ? Math.round((journalWins / journalGeschlossen.length) * 100) : null
  const journalPnlEur =
    journalGeschlossen.length > 0
      ? Math.round(journalGeschlossen.reduce((s, e) => s + (e.journalPnlEur ?? 0), 0) * 100) / 100
      : null

  const nachPlaybook: Partial<Record<MomentumPlaybook, MomentumTopSignalPlaybookStat>> = {}
  for (const e of ausgewertet) {
    const cur = nachPlaybook[e.playbook] ?? { signale: 0, gewinne: 0, trefferPct: null }
    cur.signale++
    if (e.outcome === 'win') cur.gewinne++
    cur.trefferPct = cur.signale > 0 ? Math.round((cur.gewinne / cur.signale) * 100) : null
    nachPlaybook[e.playbook] = cur
  }

  return {
    fensterTage: FENSTER_TAGE,
    signaleGesamt: eintraege.length,
    ausgewertet: ausgewertet.length,
    ausstehend: eintraege.length - ausgewertet.length,
    gewinne,
    verluste,
    timeouts,
    trefferquotePct,
    avgVorhersagePct,
    kalibrierungsDeltaPct,
    journalSignale: journalEintraege.length,
    journalGeschlossen: journalGeschlossen.length,
    journalWinRatePct,
    journalPnlEur,
    nachPlaybook,
    eintraege: eintraege.slice(0, 40),
  }
}

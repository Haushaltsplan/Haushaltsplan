/** Nachkauf-Radar — Supabase-Persistenz (Service Role, server-only). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  NachkaufAmpel,
  NachkaufDeepResearch,
  NachkaufScanEintrag,
} from './nachkauf-radar-types'

const TABLE_SCAN = 'nachkauf_radar_scan' as const
const TABLE_DEEP = 'nachkauf_radar_deep_research' as const

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function admin() {
  return createSupabaseAdmin()
}

// ---------------------------------------------------------------------------
// Scan — lesen
// ---------------------------------------------------------------------------

export async function ladeNachkaufScanAusCloud(): Promise<NachkaufScanEintrag[]> {
  if (!istKonfiguriert()) return []
  try {
    const { data, error } = await admin()
      .from(TABLE_SCAN)
      .select('*')
      .order('score', { ascending: false })
    if (error) {
      console.warn('[nachkauf-radar] Scan laden:', error.message)
      return []
    }
    return (data ?? []).map(dbZeileZuEintrag)
  } catch (e) {
    console.warn('[nachkauf-radar] Scan laden fehlgeschlagen:', e)
    return []
  }
}

export async function ladeNachkaufScanDatum(): Promise<string | null> {
  if (!istKonfiguriert()) return null
  try {
    const { data, error } = await admin()
      .from(TABLE_SCAN)
      .select('gescannt_am')
      .order('gescannt_am', { ascending: false })
      .limit(1)
    if (error || !data?.length) return null
    return (data[0] as { gescannt_am: string }).gescannt_am
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Scan — schreiben
// ---------------------------------------------------------------------------

export async function speichereNachkaufScanEintraege(eintraege: NachkaufScanEintrag[]): Promise<void> {
  if (!istKonfiguriert() || eintraege.length === 0) return
  try {
    const zeilen = eintraege.map(eintragZuDbZeile)
    const { error } = await admin()
      .from(TABLE_SCAN)
      .upsert(zeilen, { onConflict: 'ticker' })
    if (error) console.warn('[nachkauf-radar] Scan speichern:', error.message)
  } catch (e) {
    console.warn('[nachkauf-radar] Scan speichern fehlgeschlagen:', e)
  }
}

// ---------------------------------------------------------------------------
// Deep Research — lesen
// ---------------------------------------------------------------------------

export async function ladeDeepResearchFuerTicker(ticker: string): Promise<NachkaufDeepResearch | null> {
  if (!istKonfiguriert()) return null
  try {
    const { data, error } = await admin()
      .from(TABLE_DEEP)
      .select('ticker, isin, memo, erstellt_am')
      .eq('ticker', ticker.trim().toUpperCase())
      .maybeSingle()
    if (error || !data) return null
    const r = data as { ticker: string; isin: string; memo: string; erstellt_am: string }
    return { ticker: r.ticker, isin: r.isin, memo: r.memo, erstellt_am: r.erstellt_am }
  } catch {
    return null
  }
}

export async function ladeAlleDeepResearch(): Promise<Map<string, NachkaufDeepResearch>> {
  const out = new Map<string, NachkaufDeepResearch>()
  if (!istKonfiguriert()) return out
  try {
    const { data, error } = await admin()
      .from(TABLE_DEEP)
      .select('ticker, isin, memo, erstellt_am')
    if (error) return out
    for (const r of data ?? []) {
      const row = r as { ticker: string; isin: string; memo: string; erstellt_am: string }
      out.set(row.ticker.toUpperCase(), {
        ticker: row.ticker,
        isin: row.isin,
        memo: row.memo,
        erstellt_am: row.erstellt_am,
      })
    }
  } catch {
    // ignore
  }
  return out
}

// ---------------------------------------------------------------------------
// Deep Research — schreiben
// ---------------------------------------------------------------------------

export async function speichereDeepResearch(dr: NachkaufDeepResearch): Promise<void> {
  if (!istKonfiguriert()) return
  try {
    const { error } = await admin()
      .from(TABLE_DEEP)
      .upsert(
        {
          ticker: dr.ticker.trim().toUpperCase(),
          isin: dr.isin ?? '',
          memo: dr.memo,
          erstellt_am: dr.erstellt_am,
        },
        { onConflict: 'ticker' },
      )
    if (error) console.warn('[nachkauf-radar] Deep Research speichern:', error.message)
  } catch (e) {
    console.warn('[nachkauf-radar] Deep Research speichern fehlgeschlagen:', e)
  }
}

// ---------------------------------------------------------------------------
// Konvertierung DB ↔ Typ
// ---------------------------------------------------------------------------

type DbZeile = {
  ticker: string
  isin: string
  name: string
  ampel: string
  score: number
  mantra_ampel: string | null
  mantra_score_pct: number | null
  sell_trigger_ok: boolean
  ki_begruendung: string | null
  fcf_yield_pct: number | null
  forward_pe: number | null
  drawdown_52w_pct: number | null
  gescannt_am: string
}

function dbZeileZuEintrag(r: DbZeile): NachkaufScanEintrag {
  return {
    ticker: r.ticker,
    isin: r.isin ?? '',
    name: r.name ?? r.ticker,
    ampel: r.ampel as NachkaufAmpel,
    score: r.score ?? 0,
    scoreDetail: { mantraScore: 0, bewertungsScore: 0, sellTriggerPenalty: 0, gesamt: r.score ?? 0 },
    bewertung: {
      fcfYieldPct: r.fcf_yield_pct ?? null,
      forwardPe: r.forward_pe ?? null,
      drawdown52wPct: r.drawdown_52w_pct ?? null,
    },
    mantraAmpel: r.mantra_ampel ?? null,
    mantraScorePct: r.mantra_score_pct ?? null,
    sellTriggerOk: r.sell_trigger_ok ?? true,
    kiBegruendung: r.ki_begruendung ?? null,
    gescannt_am: r.gescannt_am,
    tiefenAnalyse: null,
  }
}

function eintragZuDbZeile(e: NachkaufScanEintrag): Record<string, unknown> {
  return {
    ticker: e.ticker.trim().toUpperCase(),
    isin: e.isin ?? '',
    name: e.name,
    ampel: e.ampel,
    score: e.score,
    mantra_ampel: e.mantraAmpel ?? null,
    mantra_score_pct: e.mantraScorePct ?? null,
    sell_trigger_ok: e.sellTriggerOk,
    ki_begruendung: e.kiBegruendung ?? null,
    fcf_yield_pct: e.bewertung.fcfYieldPct ?? null,
    forward_pe: e.bewertung.forwardPe ?? null,
    drawdown_52w_pct: e.bewertung.drawdown52wPct ?? null,
    gescannt_am: e.gescannt_am,
  }
}

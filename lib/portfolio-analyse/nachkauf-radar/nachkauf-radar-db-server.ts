/** Nachkauf-Radar — Supabase-Persistenz (Service Role, server-only). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  NachkaufAmpel,
  NachkaufDeepResearch,
  NachkaufScanEintrag,
} from './nachkauf-radar-types'

// ---------------------------------------------------------------------------
// Depot-Gewichte aus Buchungen berechnen
// ---------------------------------------------------------------------------

export type DepotGewicht = {
  /** Netto investiertes Kapital (Käufe − Verkäufe) in EUR. */
  investiertEur: number
  /** Anteil am Gesamt-Depot-Einstandswert (0–100). */
  anteilPct: number
}

/**
 * Lädt die aktuellen Depot-Gewichte aus dem neuesten Portfolio-Snapshot.
 *
 * Der Snapshot enthält für jede Position den aktuellen Marktwert (`wertEur`),
 * sodass die Gewichte den echten Depot-Anteil widerspiegeln — nicht den Einstandswert.
 *
 * Gibt eine Map<ISIN (upper), DepotGewicht> zurück.
 */
export async function ladeDepotGewichte(): Promise<Map<string, DepotGewicht>> {
  const out = new Map<string, DepotGewicht>()
  if (!istKonfiguriert()) return out

  try {
    const { data, error } = await admin()
      .from('portfolio_analyse_snapshot')
      .select('depotwert_eur, positionen')
      .order('erfasst_am', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return out

    const snapshot = data as {
      depotwert_eur: number | null
      positionen: Array<{ isin?: string | null; wertEur?: number; assetKlasse?: string }>
    }

    const positionen = snapshot.positionen ?? []

    // Gesamtwert: Snapshot-Wert bevorzugen; Fallback: Summe der Positionen
    const gesamtEur =
      snapshot.depotwert_eur ??
      positionen.reduce((s, p) => s + (p.wertEur ?? 0), 0)

    if (gesamtEur <= 0) return out

    for (const pos of positionen) {
      const isin = pos.isin?.trim().toUpperCase()
      if (!isin || !pos.wertEur || pos.wertEur <= 0) continue
      out.set(isin, {
        investiertEur: pos.wertEur,
        anteilPct: Math.round((pos.wertEur / gesamtEur) * 1000) / 10, // 1 Nachkomma
      })
    }
  } catch (e) {
    console.warn('[nachkauf-radar] Depot-Gewichte laden fehlgeschlagen:', e)
  }

  return out
}

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
    // Depot-Gewichte werden nach dem DB-Laden dynamisch ergänzt (ladeDepotGewichte)
    depotGewichtPct: null,
    klumpenrisiko: false,
  }
}

/** Reichert Scan-Einträge mit aktuellen Depot-Gewichten an (In-place). */
export async function ergaenzeDepotGewichte(eintraege: NachkaufScanEintrag[]): Promise<void> {
  const gewichte = await ladeDepotGewichte()
  for (const e of eintraege) {
    const g = gewichte.get(e.isin.toUpperCase())
    e.depotGewichtPct = g?.anteilPct ?? null
    e.klumpenrisiko = (g?.anteilPct ?? 0) >= 15
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

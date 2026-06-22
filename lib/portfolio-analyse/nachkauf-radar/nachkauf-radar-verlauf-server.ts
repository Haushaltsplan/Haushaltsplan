/** Score-Verlauf Persistenz — archiviert jeden Monats-Scan für Sparklines. */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { NachkaufScanEintrag, ScoreVerlaufPunkt } from './nachkauf-radar-types'

const TABLE = 'nachkauf_radar_scan_verlauf' as const

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function admin() {
  return createSupabaseAdmin()
}

/** Speichert einen Scan-Snapshot in der Verlauf-Tabelle (einmal pro Scan-Lauf). */
export async function speichereVerlaufPunkte(eintraege: NachkaufScanEintrag[]): Promise<void> {
  if (!istKonfiguriert() || eintraege.length === 0) return
  try {
    const zeilen = eintraege.map((e) => ({
      ticker: e.ticker.trim().toUpperCase(),
      score: e.score,
      ampel: e.ampel,
      mantra_ampel: e.mantraAmpel ?? null,
      fcf_yield_pct: e.bewertung.fcfYieldPct ?? null,
      forward_pe: e.bewertung.forwardPe ?? null,
      gescannt_am: e.gescannt_am,
    }))
    const { error } = await admin().from(TABLE).insert(zeilen)
    if (error) console.warn('[nachkauf-verlauf] Speichern fehlgeschlagen:', error.message)
  } catch (e) {
    console.warn('[nachkauf-verlauf] Fehler:', e)
  }
}

/** Lädt den Score-Verlauf für alle Ticker der letzten 13 Monate. */
export async function ladeScoreVerlauf(): Promise<Map<string, ScoreVerlaufPunkt[]>> {
  const out = new Map<string, ScoreVerlaufPunkt[]>()
  if (!istKonfiguriert()) return out

  try {
    const vor13Monaten = new Date()
    vor13Monaten.setMonth(vor13Monaten.getMonth() - 13)

    const { data, error } = await admin()
      .from(TABLE)
      .select('ticker, score, ampel, gescannt_am')
      .gte('gescannt_am', vor13Monaten.toISOString())
      .order('gescannt_am', { ascending: true })

    if (error || !data) return out

    for (const row of data as Array<{ ticker: string; score: number; ampel: string; gescannt_am: string }>) {
      const key = row.ticker.toUpperCase()
      const arr = out.get(key) ?? []
      arr.push({
        datum: row.gescannt_am.slice(0, 10),
        score: row.score,
        ampel: row.ampel as ScoreVerlaufPunkt['ampel'],
      })
      out.set(key, arr)
    }
  } catch (e) {
    console.warn('[nachkauf-verlauf] Laden fehlgeschlagen:', e)
  }

  return out
}

/** Reichert Scan-Einträge mit dem historischen Score-Verlauf an (In-place). */
export async function ergaenzeScoreVerlauf(eintraege: NachkaufScanEintrag[]): Promise<void> {
  const verlaufMap = await ladeScoreVerlauf()
  for (const e of eintraege) {
    e.scoreVerlauf = verlaufMap.get(e.ticker.toUpperCase()) ?? []
  }
}

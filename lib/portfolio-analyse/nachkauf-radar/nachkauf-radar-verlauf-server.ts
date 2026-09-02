/** Score-Verlauf Persistenz — archiviert jeden Monats-Scan für Sparklines. */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireOwnerUserId } from '@/lib/request-owner'
import type { NachkaufScanEintrag, ScoreVerlaufPunkt } from './nachkauf-radar-types'

const TABLE = 'nachkauf_radar_scan_verlauf' as const

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function admin() {
  return createSupabaseAdmin()
}

/** Speichert einen Scan-Snapshot — max. ein Punkt pro Ticker und Kalendertag (UTC). */
export async function speichereVerlaufPunkte(eintraege: NachkaufScanEintrag[]): Promise<void> {
  if (!istKonfiguriert() || eintraege.length === 0) return
  try {
    const tickers = [...new Set(eintraege.map((e) => e.ticker.trim().toUpperCase()))]
    const tage = [
      ...new Set(
        eintraege.map((e) => {
          const iso = e.gescannt_am?.slice(0, 10)
          return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
            ? iso
            : new Date().toISOString().slice(0, 10)
        }),
      ),
    ]

    // Alte Duplikate / heutige Rescans für dieselben Ticker+Tage entfernen
    for (const tag of tage) {
      const tagStart = `${tag}T00:00:00.000Z`
      const tagEnd = new Date(Date.parse(tagStart) + 24 * 60 * 60 * 1000).toISOString()
      const { error: delErr } = await admin()
        .from(TABLE)
        .delete()
        .eq('owner_user_id', requireOwnerUserId())
        .in('ticker', tickers)
        .gte('gescannt_am', tagStart)
        .lt('gescannt_am', tagEnd)
      if (delErr) console.warn('[nachkauf-verlauf] Dedup-Delete:', delErr.message)
    }

    const zeilen = eintraege.map((e) => ({
      owner_user_id: requireOwnerUserId(),
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

/** Lädt den Score-Verlauf für alle Ticker der letzten 13 Monate (1 Punkt/Tag). */
export async function ladeScoreVerlauf(): Promise<Map<string, ScoreVerlaufPunkt[]>> {
  const out = new Map<string, ScoreVerlaufPunkt[]>()
  if (!istKonfiguriert()) return out

  try {
    const vor13Monaten = new Date()
    vor13Monaten.setMonth(vor13Monaten.getMonth() - 13)

    const { data, error } = await admin()
      .from(TABLE)
      .select('ticker, score, ampel, gescannt_am')
      .eq('owner_user_id', requireOwnerUserId())
      .gte('gescannt_am', vor13Monaten.toISOString())
      .order('gescannt_am', { ascending: true })

    if (error || !data) return out

    for (const row of data as Array<{ ticker: string; score: number; ampel: string; gescannt_am: string }>) {
      const key = row.ticker.toUpperCase()
      const datum = row.gescannt_am.slice(0, 10)
      const arr = out.get(key) ?? []
      const last = arr[arr.length - 1]
      if (last && last.datum === datum) {
        // Späterer Insert am selben Tag überschreibt (Dedup für Altbestand)
        last.score = row.score
        last.ampel = row.ampel as ScoreVerlaufPunkt['ampel']
      } else {
        arr.push({
          datum,
          score: row.score,
          ampel: row.ampel as ScoreVerlaufPunkt['ampel'],
        })
      }
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

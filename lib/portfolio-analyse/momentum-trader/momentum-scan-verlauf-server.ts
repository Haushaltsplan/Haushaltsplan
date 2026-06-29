import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  MomentumAmpel,
  MomentumPlaybook,
  MomentumScanEintrag,
  MomentumScoreVerlaufPunkt,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TABLE = 'momentum_scan_verlauf' as const

export type { MomentumScoreVerlaufPunkt }

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

/** Scan-Snapshot für Sparklines archivieren. */
export async function speichereMomentumScanVerlauf(ergebnisse: MomentumScanEintrag[]): Promise<void> {
  if (!istKonfiguriert() || ergebnisse.length === 0) return
  try {
    const zeilen = ergebnisse.map((e) => ({
      symbol: e.symbol.trim().toUpperCase(),
      playbook: e.playbook,
      scan_date: e.scanDate,
      score: e.score,
      ampel: e.ampel,
    }))
    const { error } = await createSupabaseAdmin().from(TABLE).insert(zeilen)
    if (error) console.warn('[momentum-verlauf] Speichern:', error.message)
  } catch (e) {
    console.warn('[momentum-verlauf] Fehler:', e)
  }
}

/** Letzte N Punkte je Symbol (alle Playbooks). */
export async function ladeMomentumScoreVerlauf(
  symbole: string[],
  limitProSymbol = 14,
): Promise<Map<string, MomentumScoreVerlaufPunkt[]>> {
  const out = new Map<string, MomentumScoreVerlaufPunkt[]>()
  if (!istKonfiguriert() || symbole.length === 0) return out

  const norm = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const vor90 = new Date()
  vor90.setDate(vor90.getDate() - 90)

  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('symbol, playbook, scan_date, score, ampel')
      .in('symbol', norm)
      .gte('scan_date', vor90.toISOString().slice(0, 10))
      .order('scan_date', { ascending: true })

    if (error || !data) return out

    for (const row of data as Array<{
      symbol: string
      playbook: string
      scan_date: string
      score: number
      ampel: string
    }>) {
      const key = row.symbol.toUpperCase()
      const arr = out.get(key) ?? []
      arr.push({
        datum: row.scan_date,
        score: row.score,
        ampel: row.ampel as MomentumAmpel,
        playbook: row.playbook as MomentumPlaybook,
      })
      out.set(key, arr)
    }

    for (const [sym, arr] of out) {
      out.set(sym, arr.slice(-limitProSymbol))
    }
  } catch (e) {
    console.warn('[momentum-verlauf] Laden:', e)
  }

  return out
}

export type MomentumScanVerlaufRohPunkt = MomentumScoreVerlaufPunkt

/** Vollständiger Scan-Verlauf je Symbol (für Katalysator-Tracking). */
export async function ladeMomentumScanVerlaufRoh(
  symbole: string[],
  seitIso: string,
): Promise<Map<string, MomentumScanVerlaufRohPunkt[]>> {
  const out = new Map<string, MomentumScanVerlaufRohPunkt[]>()
  if (!istKonfiguriert() || symbole.length === 0) return out

  const norm = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))]

  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('symbol, playbook, scan_date, score, ampel')
      .in('symbol', norm)
      .gte('scan_date', seitIso)
      .order('scan_date', { ascending: true })

    if (error || !data) return out

    for (const row of data as Array<{
      symbol: string
      playbook: string
      scan_date: string
      score: number
      ampel: string
    }>) {
      const key = row.symbol.toUpperCase()
      const arr = out.get(key) ?? []
      arr.push({
        datum: row.scan_date,
        score: row.score,
        ampel: row.ampel as MomentumAmpel,
        playbook: row.playbook as MomentumPlaybook,
      })
      out.set(key, arr)
    }
  } catch (e) {
    console.warn('[momentum-verlauf] Roh-Laden:', e)
  }

  return out
}

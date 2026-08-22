/** Mantra-Score-Verlauf — Supabase-Snapshots (server-only). */

import 'server-only'

import type { FundamentalMantraAudit } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const TABLE = 'fundamental_mantra_verlauf' as const

export type MantraVerlaufPunkt = {
  periodeIso: string
  periodeLabel: string
  ampel: string
  ampelScorePct: number | null
  scoreMantra: number | null
  sellTriggerOk: boolean
  erfuellt: number
  nichtErfuellt: number
  erfasstAm: string
}

function istCloudOk(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

/** Aktuelles Quartal als Perioden-Schlüssel (YYYY-Qn). */
export function mantraPeriodeIsoAusDatum(d = new Date()): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1
  return `${d.getUTCFullYear()}-Q${q}`
}

export function periodeLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-Q([1-4])$/)
  if (!m) return iso
  return `Q${m[2]}/${m[1]}`
}

function scoreMantraAusAudit(mantra: FundamentalMantraAudit): number | null {
  const sum = mantra.zusammenfassung
  const effektivErfuellt = sum.erfuellt + sum.qualitativ * 0.5
  const effektivBewertbar = sum.bewertbar + sum.qualitativ * 0.5
  if (effektivBewertbar < 1) return null
  return Math.round((effektivErfuellt / effektivBewertbar) * 50)
}

function sellTriggerOk(mantra: FundamentalMantraAudit): boolean {
  return !mantra.sellTriggerWatch.some((s) => s.status === 'warnung')
}

export async function speichereMantraVerlaufSnapshot(opts: {
  ticker: string
  isin?: string | null
  mantra: FundamentalMantraAudit
  periodeIso?: string
}): Promise<void> {
  if (!istCloudOk()) return

  const ticker = opts.ticker.trim().toUpperCase()
  if (!ticker) return

  const periodeIso = opts.periodeIso ?? mantraPeriodeIsoAusDatum()
  const scoreMantra = scoreMantraAusAudit(opts.mantra)

  try {
    const { error } = await createSupabaseAdmin()
      .from(TABLE)
      .upsert(
        {
          ticker,
          periode_iso: periodeIso,
          isin: opts.isin?.trim().toUpperCase() || null,
          ampel: opts.mantra.ampel,
          ampel_score_pct: opts.mantra.ampelScorePct,
          score_mantra: scoreMantra,
          sell_trigger_ok: sellTriggerOk(opts.mantra),
          erfuellt: opts.mantra.zusammenfassung.erfuellt,
          nicht_erfuellt: opts.mantra.zusammenfassung.nichtErfuellt,
          qualitativ: opts.mantra.zusammenfassung.qualitativ,
          keine_daten: opts.mantra.zusammenfassung.keineDaten,
          erfasst_am: new Date().toISOString(),
        },
        { onConflict: 'ticker,periode_iso' },
      )
    if (error) console.warn('[mantra-verlauf] speichern', ticker, error.message)
  } catch (e) {
    console.warn('[mantra-verlauf] speichern fehlgeschlagen', e)
  }
}

export async function ladeMantraVerlauf(ticker: string): Promise<MantraVerlaufPunkt[]> {
  if (!istCloudOk()) return []

  const t = ticker.trim().toUpperCase()
  if (!t) return []

  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE)
      .select('*')
      .eq('ticker', t)
      .order('periode_iso', { ascending: true })
      .limit(16)

    if (error || !data) return []

    return (data as Array<Record<string, unknown>>).map((row) => ({
      periodeIso: String(row.periode_iso),
      periodeLabel: periodeLabel(String(row.periode_iso)),
      ampel: String(row.ampel),
      ampelScorePct: row.ampel_score_pct != null ? Number(row.ampel_score_pct) : null,
      scoreMantra: row.score_mantra != null ? Number(row.score_mantra) : null,
      sellTriggerOk: row.sell_trigger_ok !== false,
      erfuellt: Number(row.erfuellt ?? 0),
      nichtErfuellt: Number(row.nicht_erfuellt ?? 0),
      erfasstAm: String(row.erfasst_am),
    }))
  } catch {
    return []
  }
}
